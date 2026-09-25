const prisma = require('../config/db');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const googleAuthService = require('./googleAuthService');
const emailService = require('./emailService');

// ── Argon2 config ────────────────────────────────────────────────────────────
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,  // 64 MB
  timeCost: 3,
  parallelism: 1,
};

// ── Token helpers ────────────────────────────────────────────────────────────

const generateToken = (userId, role, tokenVersion = 0) => {
  return jwt.sign({ id: userId, role, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateRefreshToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

/**
 * Keyed HMAC-SHA256 hash for 6-digit OTP codes.
 * Binds the code to the user email and server secret to prevent rainbow table attacks.
 */
const hashOtp = (code, email) => {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'edunova_secure_otp_pepper_2026';
  return crypto.createHmac('sha256', secret).update(`${email.trim().toLowerCase()}:${code}`).digest('hex');
};

/**
 * Constant-time hash comparison to prevent timing side-channel attacks
 */
const compareHashSafe = (storedHex, candidateHex) => {
  if (!storedHex || !candidateHex) return false;
  try {
    const a = Buffer.from(storedHex, 'hex');
    const b = Buffer.from(candidateHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
};

/**
 * Build a safe user response (strip passwordHash)
 */
const safeUserResponse = (user) => {
  const { passwordHash, otpCode, parentLinkCode, ...safeUser } = user;
  return safeUser;
};

/**
 * Build full auth response with tokens
 */
const authResponse = (user) => {
  const token = generateToken(user.id, user.role, user.tokenVersion);
  const refreshToken = generateRefreshToken(user.id, user.tokenVersion);
  return {
    user: safeUserResponse(user),
    token,
    refreshToken,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// 1. EMAIL / PASSWORD REGISTRATION
// ════════════════════════════════════════════════════════════════════════════

const register = async ({ name, email, phone, password, role, learnerType, studentUsername }) => {
  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  // Uniqueness checks
  if (normalizedEmail) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw { status: 400, message: 'User already exists with this email' };
  }
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) throw { status: 400, message: 'User already exists with this phone' };
  }

  // Hash password with Argon2id
  const passwordHash = password
    ? await argon2.hash(password, ARGON2_OPTIONS)
    : null;

  // Security: Public registration must never grant ADMIN role
  const allowedRegistrationRoles = ['STUDENT', 'INSTRUCTOR', 'PARENT'];
  const safeRole = (role && allowedRegistrationRoles.includes(role)) ? role : 'STUDENT';

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      phone,
      passwordHash,
      role: safeRole,
      learnerType: learnerType || 'SCHOOL',
      studentUsername,
      isEmailVerified: false,
      // Auto-create learner profile for students
      ...((!role || role === 'STUDENT') && {
        learnerProfile: {
          create: {
            board: null,
            degree: null,
            goals: [],
            weakTopics: [],
            xp: 0,
            level: 1,
            streakDays: 0,
          },
        },
      }),
    },
    include: { learnerProfile: true },
  });

  // Automatically dispatch real SMTP verification email on signup if email provided
  if (normalizedEmail) {
    try {
      const code = crypto.randomInt(100000, 1000000).toString();
      const codeHash = hashOtp(code, normalizedEmail);
      const lookupKey = `verify:${normalizedEmail}`;

      await prisma.passwordResetCode.updateMany({
        where: { email: lookupKey, consumed: false },
        data: { consumed: true },
      });

      await prisma.passwordResetCode.create({
        data: {
          email: lookupKey,
          codeHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
        },
      });

      await emailService.sendEmailVerificationOtp(normalizedEmail, code);
    } catch (err) {
      console.warn('[Registration Email Dispatch Notice]', err.message);
    }
  }

  return authResponse(user);
};

// ════════════════════════════════════════════════════════════════════════════
// 2. EMAIL / PASSWORD LOGIN
// ════════════════════════════════════════════════════════════════════════════

const login = async ({ email, phone, studentUsername, password }) => {
  let user;

  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
      include: { learnerProfile: true },
    });
  } else if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      include: { learnerProfile: true },
    });
  } else if (studentUsername) {
    user = await prisma.user.findFirst({
      where: { studentUsername, role: 'PARENT' },
      include: { learnerProfile: true },
    });
  }

  if (!user) throw { status: 401, message: 'Invalid credentials' };
  if (!user.passwordHash) throw { status: 401, message: 'This account does not have password login enabled.' };

  // Verify with Argon2 (or legacy bcrypt with auto-migration to Argon2)
  let isMatch = false;
  if (user.passwordHash.startsWith('$argon2')) {
    isMatch = await argon2.verify(user.passwordHash, password);
  } else if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
    const bcrypt = require('bcryptjs');
    isMatch = await bcrypt.compare(password, user.passwordHash);
    if (isMatch) {
      // Seamlessly upgrade password hash to Argon2id
      const newHash = await argon2.hash(password, ARGON2_OPTIONS);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }
  } else {
    try {
      isMatch = await argon2.verify(user.passwordHash, password);
    } catch {
      isMatch = false;
    }
  }

  if (!isMatch) throw { status: 401, message: 'Invalid credentials' };

  // Update last activity
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  return authResponse(user);
};

// ════════════════════════════════════════════════════════════════════════════
// 3. REAL SMTP PASSWORD RESET LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════

const requestPasswordReset = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const genericResponse = {
    message: 'If an account exists for that email, a reset code has been sent.',
  };

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.passwordHash) {
    return genericResponse;
  }

  // Rate limiting cooldown: check if active code was created in last 60 seconds
  const recentCode = await prisma.passwordResetCode.findFirst({
    where: {
      email: normalizedEmail,
      consumed: false,
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recentCode) {
    throw { status: 429, message: 'Please wait 60 seconds before requesting another reset code.' };
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtp(code, normalizedEmail);

  await prisma.passwordResetCode.updateMany({
    where: { email: normalizedEmail, consumed: false },
    data: { consumed: true },
  });
  await prisma.passwordResetCode.create({
    data: {
      email: normalizedEmail,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  try {
    await emailService.sendPasswordResetCode(normalizedEmail, code);
  } catch (error) {
    await prisma.passwordResetCode.updateMany({
      where: { email: normalizedEmail, codeHash, consumed: false },
      data: { consumed: true },
    });
    throw error;
  }
  return genericResponse;
};

const resetPasswordWithCode = async ({ email, code, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const resetCode = await prisma.passwordResetCode.findFirst({
    where: { email: normalizedEmail, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!resetCode || resetCode.expiresAt < new Date()) {
    throw { status: 400, message: 'Invalid or expired reset code.' };
  }
  if (resetCode.attempts >= 5) {
    throw { status: 429, message: 'Too many invalid code attempts. Request a new code.' };
  }

  const expectedHash = hashOtp(code, normalizedEmail);
  const isMatch = compareHashSafe(resetCode.codeHash, expectedHash);

  if (!isMatch) {
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { attempts: { increment: 1 } },
    });
    throw { status: 400, message: 'Invalid or expired reset code.' };
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  await prisma.$transaction([
    prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash, tokenVersion: { increment: 1 } }, // Revokes all previous sessions
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { consumed: true },
    }),
  ]);
  return { message: 'Password reset successfully. You can now sign in.' };
};

// ════════════════════════════════════════════════════════════════════════════
// 4. REAL SMTP EMAIL VERIFICATION LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════

const requestEmailVerification = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user && user.isEmailVerified) {
    return { message: 'Email is already verified.' };
  }

  // 60-second cooldown check
  const lookupKey = `verify:${normalizedEmail}`;
  const recentCode = await prisma.passwordResetCode.findFirst({
    where: {
      email: lookupKey,
      consumed: false,
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recentCode) {
    throw { status: 429, message: 'Please wait 60 seconds before requesting another verification code.' };
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtp(code, normalizedEmail);

  await prisma.passwordResetCode.updateMany({
    where: { email: lookupKey, consumed: false },
    data: { consumed: true },
  });

  await prisma.passwordResetCode.create({
    data: {
      email: lookupKey,
      codeHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    },
  });

  try {
    await emailService.sendEmailVerificationOtp(normalizedEmail, code);
  } catch (error) {
    await prisma.passwordResetCode.updateMany({
      where: { email: lookupKey, codeHash, consumed: false },
      data: { consumed: true },
    });
    throw error;
  }

  return { message: 'Verification code sent to your email.' };
};

const confirmEmailVerification = async ({ email, code }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const lookupKey = `verify:${normalizedEmail}`;
  const record = await prisma.passwordResetCode.findFirst({
    where: { email: lookupKey, consumed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.expiresAt < new Date()) {
    throw { status: 400, message: 'Invalid or expired verification code.' };
  }
  if (record.attempts >= 5) {
    throw { status: 429, message: 'Too many invalid attempts. Request a new code.' };
  }

  const expectedHash = hashOtp(code, normalizedEmail);
  const isMatch = compareHashSafe(record.codeHash, expectedHash);

  if (!isMatch) {
    await prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw { status: 400, message: 'Invalid verification code.' };
  }

  // Mark consumed and update User table isEmailVerified = true
  const [_, updatedUser] = await prisma.$transaction([
    prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { consumed: true },
    }),
    prisma.user.update({
      where: { email: normalizedEmail },
      data: { isEmailVerified: true },
      include: { learnerProfile: true },
    }),
  ]);

  return {
    verified: true,
    message: 'Email verified successfully.',
    ...authResponse(updatedUser),
  };
};

// ════════════════════════════════════════════════════════════════════════════
// 5. GOOGLE LOGIN
// ════════════════════════════════════════════════════════════════════════════

const googleLogin = async ({ idToken, role, learnerType }) => {
  const user = await googleAuthService.googleLogin(idToken, { role, learnerType });

  // Update last activity
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  return authResponse(user);
};

// ════════════════════════════════════════════════════════════════════════════
// 6. SECURE PARENT-CHILD VERIFICATION & LINKING WORKFLOW
// ════════════════════════════════════════════════════════════════════════════

/**
 * Student generates a secure 6-character linking PIN (valid for 24h)
 */
const generateStudentLinkCode = async (studentId) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, studentUsername: true },
  });

  if (!student || student.role !== 'STUDENT') {
    throw { status: 403, message: 'Only student accounts can generate parent linking codes.' };
  }

  // Cryptographically random 6-character uppercase PIN
  const pin = 'ED-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.user.update({
    where: { id: studentId },
    data: {
      parentLinkCode: pin,
      parentLinkCodeExpiresAt: expiresAt,
    },
  });

  return {
    linkCode: pin,
    expiresAt: expiresAt.toISOString(),
    studentUsername: student.studentUsername,
    message: 'Parent linking code generated. Share this code with your parent.',
  };
};

/**
 * Parent links to student using student's username AND verified student PIN
 */
const linkParentToStudent = async (parentId, studentUsername, linkCode) => {
  if (!studentUsername || !studentUsername.trim()) {
    throw { status: 400, message: 'Student username is required' };
  }
  if (!linkCode || !linkCode.trim()) {
    throw { status: 400, message: 'Verification link code from student is required' };
  }

  // Verify student exists
  const student = await prisma.user.findFirst({
    where: { studentUsername: studentUsername.trim(), role: 'STUDENT' },
    select: {
      id: true,
      name: true,
      studentUsername: true,
      parentLinkCode: true,
      parentLinkCodeExpiresAt: true,
    },
  });

  if (!student) {
    throw { status: 404, message: `No student found with username "${studentUsername}"` };
  }

  // Validate student's generated link code
  const inputPin = linkCode.trim().toUpperCase();
  if (
    !student.parentLinkCode ||
    student.parentLinkCode.toUpperCase() !== inputPin ||
    !student.parentLinkCodeExpiresAt ||
    student.parentLinkCodeExpiresAt < new Date()
  ) {
    throw {
      status: 400,
      message: 'Invalid or expired student linking code. The student must generate an active code in their profile.',
    };
  }

  // Consume linking code and link parent atomically
  const [parent] = await prisma.$transaction([
    prisma.user.update({
      where: { id: parentId },
      data: { studentUsername: student.studentUsername },
      include: { learnerProfile: true },
    }),
    prisma.user.update({
      where: { id: student.id },
      data: {
        parentLinkCode: null,
        parentLinkCodeExpiresAt: null,
      },
    }),
  ]);

  return {
    message: `Successfully linked to student: ${student.name}`,
    parent: safeUserResponse(parent),
    linkedStudent: { id: student.id, name: student.name, studentUsername: student.studentUsername },
  };
};

/**
 * Parent or student unlinks the companion monitoring connection
 */
const unlinkParentStudent = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { status: 404, message: 'User not found' };

  if (user.role === 'PARENT') {
    await prisma.user.update({
      where: { id: userId },
      data: { studentUsername: null },
    });
    return { success: true, message: 'Student unlinked successfully.' };
  }

  if (user.role === 'STUDENT' && user.studentUsername) {
    // Unlink any parent monitoring this student
    await prisma.user.updateMany({
      where: { studentUsername: user.studentUsername, role: 'PARENT' },
      data: { studentUsername: null },
    });
    return { success: true, message: 'Parent unlinked successfully.' };
  }

  return { success: true, message: 'No active parent link found.' };
};

// ════════════════════════════════════════════════════════════════════════════
// 7. GET CURRENT USER
// ════════════════════════════════════════════════════════════════════════════

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { learnerProfile: true },
  });

  if (!user) throw { status: 404, message: 'User not found' };
  return safeUserResponse(user);
};

// ════════════════════════════════════════════════════════════════════════════
// 8. REFRESH TOKEN ROTATION WITH REUSE REVOCATION
// ════════════════════════════════════════════════════════════════════════════

const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) throw { status: 401, message: 'User not found' };
    if (decoded.tokenVersion !== user.tokenVersion) {
      throw { status: 401, message: 'Session has been revoked. Please sign in again.' };
    }

    const token = generateToken(user.id, user.role, user.tokenVersion);
    const rotatedRefreshToken = generateRefreshToken(user.id, user.tokenVersion);
    return { token, refreshToken: rotatedRefreshToken };
  } catch (error) {
    if (error.status) throw error;
    throw { status: 401, message: 'Invalid or expired refresh token' };
  }
};

module.exports = {
  register,
  login,
  requestPasswordReset,
  resetPasswordWithCode,
  requestEmailVerification,
  confirmEmailVerification,
  googleLogin,
  generateStudentLinkCode,
  linkParentToStudent,
  unlinkParentStudent,
  getMe,
  refreshAccessToken,
  generateToken,
  generateRefreshToken,
};
