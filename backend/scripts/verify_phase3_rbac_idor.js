require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const http = require('http');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const PORT = process.env.PORT || 5000;

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function verifyPhase3() {
  console.log('=================================================================');
  console.log('PHASE 3 VERIFICATION: CENTRALIZED RBAC & IDOR SECURITY TEST SUITE');
  console.log('=================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup Test Accounts: 2 Students, 2 Instructors, 1 Parent, 1 Admin
    // -------------------------------------------------------------
    console.log('[Setup] Preparing isolated test accounts in PostgreSQL...');

    // Student A
    let studentA = await prisma.user.findFirst({ where: { email: 'student_a@edunova.com' } });
    if (!studentA) {
      studentA = await prisma.user.create({
        data: {
          name: 'Student A',
          email: 'student_a@edunova.com',
          role: 'STUDENT',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Student B (Target for IDOR attacks)
    let studentB = await prisma.user.findFirst({ where: { email: 'student_b@edunova.com' } });
    if (!studentB) {
      studentB = await prisma.user.create({
        data: {
          name: 'Student B',
          email: 'student_b@edunova.com',
          role: 'STUDENT',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Instructor A
    let instructorA = await prisma.user.findFirst({ where: { email: 'instructor_a@edunova.com' } });
    if (!instructorA) {
      instructorA = await prisma.user.create({
        data: {
          name: 'Instructor A',
          email: 'instructor_a@edunova.com',
          role: 'INSTRUCTOR',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Instructor B (Owns Course B)
    let instructorB = await prisma.user.findFirst({ where: { email: 'instructor_b@edunova.com' } });
    if (!instructorB) {
      instructorB = await prisma.user.create({
        data: {
          name: 'Instructor B',
          email: 'instructor_b@edunova.com',
          role: 'INSTRUCTOR',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Parent linked ONLY to Student A
    let parentUser = await prisma.user.findFirst({ where: { email: 'parent_strict@edunova.com' } });
    if (!parentUser) {
      parentUser = await prisma.user.create({
        data: {
          name: 'Parent Strict',
          email: 'parent_strict@edunova.com',
          role: 'PARENT',
          studentUsername: studentA.email,
          passwordHash: 'dummyhash123',
        },
      });
    } else {
      parentUser = await prisma.user.update({
        where: { id: parentUser.id },
        data: { studentUsername: studentA.email },
      });
    }

    // Admin
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Admin Global',
          email: 'admin_global@edunova.com',
          role: 'ADMIN',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Course B owned by Instructor B
    let courseB = await prisma.course.findFirst({ where: { title: 'Security Architecture B' } });
    if (!courseB) {
      courseB = await prisma.course.create({
        data: {
          title: 'Security Architecture B',
          description: 'Protected course owned by Instructor B',
          category: 'Security',
          instructorId: instructorB.id,
          difficulty: 'ADVANCED',
          isPublished: true,
        },
      });
    }

    // Private Conversation between Student A and Admin (Student B is NOT a member)
    let privateConv = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: { some: { userId: studentA.id } },
      },
    });
    if (!privateConv) {
      privateConv = await prisma.conversation.create({
        data: {
          type: 'DIRECT',
          members: {
            create: [
              { userId: studentA.id, role: 'MEMBER' },
              { userId: admin.id, role: 'ADMIN' },
            ],
          },
        },
      });
    }

    const tokenStudentA = generateToken(studentA);
    const tokenStudentB = generateToken(studentB);
    const tokenInstructorA = generateToken(instructorA);
    const tokenInstructorB = generateToken(instructorB);
    const tokenParent = generateToken(parentUser);
    const tokenAdmin = generateToken(admin);

    console.log('[Setup] Test identities active.\n');

    // -------------------------------------------------------------
    // TEST SECTION 1: Unauthenticated Requests (401)
    // -------------------------------------------------------------
    console.log('--- TEST SECTION 1: Unauthenticated Endpoint Access ---');
    const noToken1 = await makeRequest('GET', '/api/users/profile');
    assert(noToken1.statusCode === 401, 'GET /api/users/profile rejects unauthenticated request with 401');

    const noToken2 = await makeRequest('GET', '/api/analytics/overview');
    assert(noToken2.statusCode === 401, 'GET /api/analytics/overview rejects unauthenticated request with 401');

    const noToken3 = await makeRequest('GET', '/api/admin/metrics');
    assert(noToken3.statusCode === 401, 'GET /api/admin/metrics rejects unauthenticated request with 401');

    // -------------------------------------------------------------
    // TEST SECTION 2: Role Authorization Checks (403)
    // -------------------------------------------------------------
    console.log('\n--- TEST SECTION 2: Role Authorization Restrictions ---');
    const studentToAdmin = await makeRequest('GET', '/api/admin/metrics', { Authorization: `Bearer ${tokenStudentA}` });
    assert(studentToAdmin.statusCode === 403, 'Student calling /api/admin/metrics returns 403 Forbidden');

    const studentToInstructor = await makeRequest('GET', '/api/instructor/dashboard', { Authorization: `Bearer ${tokenStudentA}` });
    assert(studentToInstructor.statusCode === 403, 'Student calling /api/instructor/dashboard returns 403 Forbidden');

    const parentToInstructor = await makeRequest('GET', '/api/instructor/courses', { Authorization: `Bearer ${tokenParent}` });
    assert(parentToInstructor.statusCode === 403, 'Parent calling /api/instructor/courses returns 403 Forbidden');

    const instructorToAdmin = await makeRequest('GET', '/api/admin/users', { Authorization: `Bearer ${tokenInstructorA}` });
    assert(instructorToAdmin.statusCode === 403, 'Instructor calling /api/admin/users returns 403 Forbidden');

    // -------------------------------------------------------------
    // TEST SECTION 3: IDOR on Student Analytics
    // -------------------------------------------------------------
    console.log('\n--- TEST SECTION 3: IDOR on Student Analytics & Records ---');
    // Student A accessing their own analytics -> 200
    const studentOwnAnalytics = await makeRequest('GET', `/api/analytics/student/${studentA.id}`, { Authorization: `Bearer ${tokenStudentA}` });
    assert(studentOwnAnalytics.statusCode === 200, 'Student A can access their own analytics (HTTP 200)');

    // Student A trying to access Student B's analytics -> 403 IDOR blocked
    const studentAtoStudentB = await makeRequest('GET', `/api/analytics/student/${studentB.id}`, { Authorization: `Bearer ${tokenStudentA}` });
    assert(studentAtoStudentB.statusCode === 403, 'IDOR PREVENTED: Student A blocked from viewing Student B analytics (HTTP 403)');

    // Parent accessing linked Student A's analytics -> 200
    const parentToStudentA = await makeRequest('GET', `/api/analytics/student/${studentA.id}`, { Authorization: `Bearer ${tokenParent}` });
    assert(parentToStudentA.statusCode === 200, 'Parent can access linked child Student A analytics (HTTP 200)');

    // Parent trying to access unlinked Student B's analytics -> 403 IDOR blocked
    const parentToStudentB = await makeRequest('GET', `/api/analytics/student/${studentB.id}`, { Authorization: `Bearer ${tokenParent}` });
    assert(parentToStudentB.statusCode === 403, 'IDOR PREVENTED: Parent blocked from accessing unlinked Student B analytics (HTTP 403)');

    // -------------------------------------------------------------
    // TEST SECTION 4: IDOR on Course Management
    // -------------------------------------------------------------
    console.log('\n--- TEST SECTION 4: IDOR on Course Ownership & Management ---');
    // Instructor B updating their own Course B -> 200
    const instructorBUpdate = await makeRequest(
      'PATCH',
      `/api/instructor/courses/${courseB.id}`,
      { Authorization: `Bearer ${tokenInstructorB}` },
      { title: 'Security Architecture B - Revised' }
    );
    assert(instructorBUpdate.statusCode === 200, 'Instructor B can update their own course (HTTP 200)');

    // Instructor A trying to update Instructor B's Course B -> 403 IDOR blocked
    const instructorAUpdateB = await makeRequest(
      'PATCH',
      `/api/instructor/courses/${courseB.id}`,
      { Authorization: `Bearer ${tokenInstructorA}` },
      { title: 'Hacked by Instructor A' }
    );
    assert(instructorAUpdateB.statusCode === 403, 'IDOR PREVENTED: Instructor A blocked from editing Instructor B course (HTTP 403)');

    // Instructor A trying to add a module to Instructor B's Course B -> 403 IDOR blocked
    const instructorAAddModule = await makeRequest(
      'POST',
      `/api/courses/${courseB.id}/modules`,
      { Authorization: `Bearer ${tokenInstructorA}` },
      { title: 'Malicious Injected Module', duration: 15 }
    );
    assert(instructorAAddModule.statusCode === 403, 'IDOR PREVENTED: Instructor A blocked from adding module to Instructor B course (HTTP 403)');

    // Admin can manage Course B (Administrative override) -> 200
    const adminCourseUpdate = await makeRequest(
      'PUT',
      `/api/courses/${courseB.id}`,
      { Authorization: `Bearer ${tokenAdmin}` },
      { title: 'Security Architecture B - Verified by Admin' }
    );
    assert(adminCourseUpdate.statusCode === 200, 'Admin can manage courses across all instructors (HTTP 200)');

    // -------------------------------------------------------------
    // TEST SECTION 5: IDOR on Private Conversations
    // -------------------------------------------------------------
    console.log('\n--- TEST SECTION 5: IDOR on Private Conversations & Chat ---');
    // Student A (member) can read conversation messages -> 200
    const memberRead = await makeRequest('GET', `/api/conversations/${privateConv.id}/messages`, {
      Authorization: `Bearer ${tokenStudentA}`,
    });
    assert(memberRead.statusCode === 200, 'Conversation member (Student A) can read messages (HTTP 200)');

    // Student B (non-member) trying to read private conversation messages -> 403 IDOR blocked
    const nonMemberRead = await makeRequest('GET', `/api/conversations/${privateConv.id}/messages`, {
      Authorization: `Bearer ${tokenStudentB}`,
    });
    assert(nonMemberRead.statusCode === 403, 'IDOR PREVENTED: Non-member (Student B) blocked from reading private conversation (HTTP 403)');

    // Student B (non-member) trying to send message to private conversation -> 403 IDOR blocked
    const nonMemberSend = await makeRequest(
      'POST',
      `/api/conversations/${privateConv.id}/messages`,
      { Authorization: `Bearer ${tokenStudentB}` },
      { content: 'Eavesdropping payload test' }
    );
    assert(nonMemberSend.statusCode === 403, 'IDOR PREVENTED: Non-member (Student B) blocked from sending message to private conversation (HTTP 403)');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n=================================================================');
    console.log(`TEST RUN COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('=================================================================');

    if (passedTests === totalTests) {
      console.log('🎉 ALL CENTRALIZED RBAC & IDOR SECURITY TESTS PASSED SUCCESSFULLY!');
    } else {
      console.error(`⚠️ ${totalTests - passedTests} TESTS FAILED.`);
    }

  } catch (err) {
    console.error('Fatal error during Phase 3 verification:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase3();
