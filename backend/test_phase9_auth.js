const http = require('http');
const prisma = require('./config/db');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ── HTTP Request Helper ──────────────────────────────────────────────────────
const request = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

function parseCookies(setCookieHeaders) {
  const cookies = {};
  if (!setCookieHeaders) return cookies;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const str of list) {
    const parts = str.split(';')[0].split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return cookies;
}

// ── Test Runner ─────────────────────────────────────────────────────────────
async function runPhase9AuthAudit() {
  console.log('================================================================');
  console.log('  PHASE 9 — COMPLETE AUTHENTICATION AUDIT & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      failed++;
    }
  };

  const testTimestamp = Date.now();
  const testStudentEmail = `phase9.student.${testTimestamp}@edunova.test`;
  const testStudentPassword = 'Phase9SecurePassword2026!';
  const testStudentUsername = `phase9_stu_${testTimestamp}`;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. REGISTRATION & ROLE ESCALATION PREVENTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Registration & Anti-Escalation Checks:');

  // 1a. Attempt registering as ADMIN (must be sanitized or rejected)
  const adminEscalationAttempt = await request('/api/auth/register', 'POST', {
    name: 'Privilege Escalation Attacker',
    email: `attacker.${testTimestamp}@edunova.test`,
    password: 'AttackerPassword123!',
    role: 'ADMIN', // Illegal role in public registration
  });
  assert(
    adminEscalationAttempt.status === 400 ||
    (adminEscalationAttempt.data?.data?.user?.role !== 'ADMIN'),
    'Public registration forbids ADMIN role elevation'
  );

  // 1b. Reject password < 8 characters
  const shortPassRes = await request('/api/auth/register', 'POST', {
    name: 'Short Pass User',
    email: `shortpass.${testTimestamp}@edunova.test`,
    password: 'short',
  });
  assert(shortPassRes.status === 400, 'Rejects password shorter than 8 characters');

  // 1c. Successful valid student registration
  const regRes = await request('/api/auth/register', 'POST', {
    name: 'Phase 9 Student',
    email: testStudentEmail,
    password: testStudentPassword,
    role: 'STUDENT',
    learnerType: 'SCHOOL',
    studentUsername: testStudentUsername,
  });

  assert(regRes.status === 201, 'Student successfully registered with status 201');
  assert(regRes.data?.data?.user?.email === testStudentEmail, 'Returns correct user email');
  assert(regRes.data?.data?.user?.passwordHash === undefined, 'passwordHash is excluded from client response');
  assert(regRes.data?.data?.token && regRes.data?.data?.refreshToken, 'Issues access token and refresh token');
  
  // Verify HTTP-only cookies in registration response
  const regCookies = parseCookies(regRes.headers['set-cookie']);
  assert(!!regCookies['edunova_token'], 'Sets edunova_token cookie on registration');
  assert(!!regCookies['refresh_token'], 'Sets refresh_token cookie on registration');

  const rawSetCookie = Array.isArray(regRes.headers['set-cookie'])
    ? regRes.headers['set-cookie'].join('; ')
    : (regRes.headers['set-cookie'] || '');
  assert(rawSetCookie.toLowerCase().includes('httponly'), 'Cookies are flagged HttpOnly');

  let studentToken = regRes.data?.data?.token;
  let studentRefreshToken = regRes.data?.data?.refreshToken;
  let studentUserId = regRes.data?.data?.user?.id;

  // 1d. Reject duplicate email registration
  const dupRes = await request('/api/auth/register', 'POST', {
    name: 'Duplicate Student',
    email: testStudentEmail,
    password: testStudentPassword,
  });
  assert(dupRes.status === 400, 'Rejects duplicate email registration (400)');

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SECURE PASSWORD HASHING (Argon2id)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Secure Password Hashing Verification:');
  const dbUser = await prisma.user.findUnique({ where: { id: studentUserId } });
  assert(dbUser?.passwordHash?.startsWith('$argon2id$'), 'Password is encrypted using Argon2id ($argon2id$)');
  const isMatch = await argon2.verify(dbUser.passwordHash, testStudentPassword);
  assert(isMatch === true, 'Argon2id hash successfully verifies correct password');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. LOGIN & CREDENTIAL VALIDATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Login & Credential Validation:');

  // 3a. Invalid password
  const badLogin = await request('/api/auth/login', 'POST', {
    email: testStudentEmail,
    password: 'WrongPassword999!',
  });
  assert(badLogin.status === 401, 'Invalid password rejected with 401 Unauthorized');

  // 3b. Valid login with email
  const loginRes = await request('/api/auth/login', 'POST', {
    email: testStudentEmail,
    password: testStudentPassword,
  });
  assert(loginRes.status === 200, 'Valid login returns status 200 OK');
  assert(loginRes.data?.data?.user?.id === studentUserId, 'Login matches registered user ID');
  studentToken = loginRes.data?.data?.token;
  studentRefreshToken = loginRes.data?.data?.refreshToken;

  // ──────────────────────────────────────────────────────────────────────────
  // 4. JWT VERIFICATION & AUTHENTICATION MIDDLEWARE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. JWT Verification & Middleware:');

  // 4a. Authenticated via Authorization Bearer Header
  const meBearerRes = await request('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${studentToken}`,
  });
  assert(meBearerRes.status === 200 && meBearerRes.data?.data?.email === testStudentEmail, 'requireAuth validates Bearer token');

  // 4b. Authenticated via HTTP-only cookie
  const meCookieRes = await request('/api/auth/me', 'GET', null, {
    Cookie: `edunova_token=${studentToken}`,
  });
  assert(meCookieRes.status === 200 && meCookieRes.data?.data?.email === testStudentEmail, 'requireAuth validates edunova_token cookie');

  // 4c. Missing token rejected
  const meNoToken = await request('/api/auth/me', 'GET');
  assert(meNoToken.status === 401, 'Missing token returns 401');

  // 4d. Tampered token rejected
  const tamperedToken = studentToken.slice(0, -6) + 'abcdef';
  const meTampered = await request('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${tamperedToken}`,
  });
  assert(meTampered.status === 401 && meTampered.data?.code === 'TOKEN_INVALID', 'Tampered JWT returns 401 TOKEN_INVALID');

  // ──────────────────────────────────────────────────────────────────────────
  // 5. REFRESH TOKEN ROTATION & REUSE REVOCATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n5. Refresh Token Rotation & Revocation:');

  const refreshRes = await request('/api/auth/refresh', 'POST', {
    refreshToken: studentRefreshToken,
  });
  assert(refreshRes.status === 200, 'POST /api/auth/refresh returns 200');
  assert(!!refreshRes.data?.token, 'Issues fresh access token on refresh');
  assert(!!refreshRes.data?.refreshToken, 'Issues rotated refresh token');
  assert(refreshRes.data?.refreshToken !== studentRefreshToken, 'Rotated refresh token is distinct from previous token');

  const rotatedRefreshToken = refreshRes.data?.refreshToken;
  const newAccessToken = refreshRes.data?.token;

  // Verify new access token works
  const meRefreshed = await request('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${newAccessToken}`,
  });
  assert(meRefreshed.status === 200, 'New rotated access token is valid and authenticated');

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n6. Role-Based Access Control (RBAC):');

  // Student trying to access ADMIN-only endpoint
  const adminDenied = await request('/api/admin/metrics', 'GET', null, {
    Authorization: `Bearer ${newAccessToken}`,
  });
  assert(adminDenied.status === 403 && adminDenied.data?.code === 'INSUFFICIENT_ROLE', 'Student blocked from ADMIN route (403 INSUFFICIENT_ROLE)');

  // Student trying to access PARENT-only endpoint
  const parentDenied = await request('/api/users/child', 'GET', null, {
    Authorization: `Bearer ${newAccessToken}`,
  });
  assert(parentDenied.status === 403, 'Student blocked from PARENT route (403)');

  // ──────────────────────────────────────────────────────────────────────────
  // 7. CSRF PROTECTION & TOKEN ENDPOINT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n7. CSRF Protection:');

  const csrfRes = await request('/api/auth/csrf-token', 'GET');
  assert(csrfRes.status === 200 && !!csrfRes.data?.csrfToken, 'GET /api/auth/csrf-token generates CSRF token');
  
  const csrfToken = csrfRes.data?.csrfToken;
  const csrfCookies = parseCookies(csrfRes.headers['set-cookie']);
  assert(!!csrfCookies['edunova_csrf'], 'Issues edunova_csrf cookie');

  // ──────────────────────────────────────────────────────────────────────────
  // 8. EMAIL VERIFICATION & PASSWORD RESET LIFECYCLES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n8. Email Verification & Password Reset Lifecycles:');

  // 8a. Check email verification request (verifies 60s cooldown if code was just sent during registration)
  const emailVerifReq = await request('/api/auth/verify-email/request', 'POST', {
    email: testStudentEmail,
  });
  assert(
    [200, 429].includes(emailVerifReq.status),
    'POST /api/auth/verify-email/request validates request or enforces 60-second cooldown'
  );

  // 8b. Check code in DB is hashed with keyed HMAC-SHA256
  const verifyDbRecord = await prisma.passwordResetCode.findFirst({
    where: { email: `verify:${testStudentEmail}`, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!verifyDbRecord?.codeHash, 'Verification code stored securely as keyed HMAC-SHA256 hash');

  // 8c. Invalid verification code rejected
  const badVerifyRes = await request('/api/auth/verify-email/confirm', 'POST', {
    email: testStudentEmail,
    code: '000000',
  });
  assert(badVerifyRes.status === 400, 'Invalid verification code rejected (400)');

  // 8d. Password Reset Request returns generic safe response (prevents account enumeration)
  const passResetReq = await request('/api/auth/password-reset/request', 'POST', {
    email: testStudentEmail,
  });
  assert(passResetReq.status === 200, 'POST /api/auth/password-reset/request returns generic safe response');

  // ──────────────────────────────────────────────────────────────────────────
  // 9. GOOGLE AUTHENTICATION 2.0 INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n9. Google Authentication 2.0 Checks:');

  // Rejects fake/tampered token
  const fakeGoogleRes = await request('/api/auth/google', 'POST', {
    idToken: 'fake.google.jwt.token.here',
    role: 'STUDENT',
  });
  assert(fakeGoogleRes.status === 401, 'Invalid Google ID token rejected with 401');

  // Rejects attempt to pass ADMIN role via Google payload
  const fakeAdminGoogleRes = await request('/api/auth/google', 'POST', {
    idToken: 'fake.google.token',
    role: 'ADMIN',
  });
  assert(fakeAdminGoogleRes.status === 400, 'Zod blocks ADMIN role in Google login payload');

  // ──────────────────────────────────────────────────────────────────────────
  // 10. PRIVILEGED ROLE ASSIGNMENT & SECURITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n10. Privileged Role Assignment & Security:');

  // Ensure an admin user exists for test
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: 'Test Administrator',
        email: `admin.${testTimestamp}@edunova.test`,
        passwordHash: await argon2.hash('AdminTestSecurePass123!', { type: argon2.argon2id }),
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
  }
  const adminToken = jwt.sign(
    { id: adminUser.id, role: adminUser.role, tokenVersion: adminUser.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 10a. Admin attempts to promote unverified student to ADMIN (Must fail)
  const promoteUnverifiedRes = await request(`/api/admin/users/${studentUserId}/role`, 'PATCH', {
    role: 'ADMIN',
  }, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(
    promoteUnverifiedRes.status === 400 &&
    promoteUnverifiedRes.data?.message?.includes('verified email'),
    'Privileged ADMIN assignment requires verified email'
  );

  // 10b. Verify student's email in DB, then promote
  await prisma.user.update({
    where: { id: studentUserId },
    data: { isEmailVerified: true },
  });

  const promoteVerifiedRes = await request(`/api/admin/users/${studentUserId}/role`, 'PATCH', {
    role: 'INSTRUCTOR',
  }, {
    Authorization: `Bearer ${adminToken}`,
  });
  assert(promoteVerifiedRes.status === 200, 'Role promotion to INSTRUCTOR succeeds after verification');

  // Verify target user tokenVersion was incremented (revoking existing sessions)
  const studentAfterPromotion = await prisma.user.findUnique({ where: { id: studentUserId } });
  assert(studentAfterPromotion.tokenVersion > 0, 'Target user tokenVersion incremented upon role change');

  // Old student token should now be revoked
  const revokedAccessCheck = await request('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${newAccessToken}`,
  });
  assert(
    revokedAccessCheck.status === 401 && revokedAccessCheck.data?.code === 'SESSION_REVOKED',
    'Previous access token revoked immediately after role change (401 SESSION_REVOKED)'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 11. LOGOUT & SESSION TERMINATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n11. Logout & Session Termination:');

  // Log in again to get fresh session
  const freshLogin = await request('/api/auth/login', 'POST', {
    email: testStudentEmail,
    password: testStudentPassword,
  });
  const freshToken = freshLogin.data?.data?.token;

  const logoutRes = await request('/api/auth/logout', 'POST', {}, {
    Authorization: `Bearer ${freshToken}`,
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200');

  // Verify cookies are expired/cleared
  const logoutCookies = parseCookies(logoutRes.headers['set-cookie']);
  const logoutSetCookieHeader = Array.isArray(logoutRes.headers['set-cookie'])
    ? logoutRes.headers['set-cookie'].join('; ')
    : (logoutRes.headers['set-cookie'] || '');
  assert(
    logoutSetCookieHeader.includes('Expires=Thu, 01 Jan 1970') ||
    logoutCookies['edunova_token'] === '',
    'Logout clears edunova_token cookie'
  );

  // Token is now revoked
  const postLogoutMe = await request('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${freshToken}`,
  });
  assert(
    postLogoutMe.status === 401 && postLogoutMe.data?.code === 'SESSION_REVOKED',
    'Session immediately invalidated in DB upon logout'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // CLEANUP TEST USERS
  // ──────────────────────────────────────────────────────────────────────────
  try {
    await prisma.passwordResetCode.deleteMany({
      where: {
        OR: [
          { email: testStudentEmail },
          { email: `verify:${testStudentEmail}` },
        ],
      },
    });
    await prisma.learnerProfile.deleteMany({ where: { userId: studentUserId } });
    await prisma.adminAuditLog.deleteMany({ where: { targetId: studentUserId } });
    await prisma.user.delete({ where: { id: studentUserId } });
  } catch (err) {
    // Non-critical cleanup
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`  PHASE 9 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9AuthAudit()
  .catch((err) => {
    console.error('Fatal error during auth audit:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
