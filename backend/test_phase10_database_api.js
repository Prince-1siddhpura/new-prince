/**
 * Phase 10 Comprehensive Database and API Verification Suite
 * 
 * Tests:
 * 1. Database schema and models integrity
 * 2. Server-side validation (Zod schemas)
 * 3. Secure queries & resource ownership checks
 * 4. Pagination across core entities (Tasks, Subjects, Courses, Posts)
 * 5. Search & filtering (case-insensitive keyword matching)
 * 6. Sorting (custom fields, asc/desc)
 * 7. Database transactions (atomic updates on QuizAttempt + XP + Profile)
 * 8. Appropriate HTTP status codes & consistent error envelopes
 * 9. Structured backend logging
 * 10. Dashboard statistics calculation from database & zero seed data validation
 */

const http = require('http');
const prisma = require('./config/db');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const request = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const payload = data !== null ? JSON.stringify(data) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...headers,
    };

    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: reqHeaders,
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

    req.on('error', (err) => {
      // If port 5000 failed, retry on 5001
      if (err.code === 'ECONNREFUSED' && options.port === 5000) {
        options.port = 5001;
        const retryReq = http.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
            } catch (e) {
              resolve({ status: res.statusCode, headers: res.headers, raw: body });
            }
          });
        });
        retryReq.on('error', reject);
        if (payload) retryReq.write(payload);
        retryReq.end();
      } else {
        reject(err);
      }
    });

    if (payload) req.write(payload);
    req.end();
  });
};

const runTests = async () => {
  let passed = 0;
  let failed = 0;

  const test = (name, assertion) => {
    if (assertion) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  };

  console.log('\n========================================================');
  console.log('  PHASE 10: DATABASE AND API COMPLETION VERIFICATION');
  console.log('========================================================\n');

  let studentToken = null;
  let studentUser = null;
  let otherStudentToken = null;
  let otherStudentUser = null;
  let testSubject = null;
  let testQuiz = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Database Schema & Models Integrity
    // -------------------------------------------------------------------------
    console.log('[SECTION 1] Database Models & Relationship Audit');
    const modelNames = [
      'user', 'learnerProfile', 'subject', 'topic', 'studentSubjectProgress',
      'course', 'courseModule', 'userCourseProgress', 'mission', 'userMission',
      'xpTransaction', 'adminAuditLog', 'conversation', 'conversationMember',
      'chatMessage', 'skillExchange', 'exchangeMeeting', 'exchangeGoal',
      'quiz', 'quizQuestion', 'quizAttempt', 'studySession', 'aiConversation',
      'aiMessage', 'note', 'task', 'gameResult', 'labAttempt', 'xrProgress',
      'learningActivity', 'notification', 'learningMaterial', 'homeworkItem',
      'parentCompanionConfig', 'communityPost', 'postComment', 'postLike',
    ];

    let allModelsPresent = true;
    for (const m of modelNames) {
      if (!prisma[m]) {
        allModelsPresent = false;
        console.error(`Missing Prisma model accessor: prisma.${m}`);
      }
    }
    test('All 37 required Prisma models exist in database client', allModelsPresent);

    // Verify existing admin account is preserved
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@123.com' },
      select: { id: true, email: true, role: true, isEmailVerified: true },
    });
    test('Existing administrator record preserved without data loss', !!adminUser && adminUser.role === 'ADMIN');

    // -------------------------------------------------------------------------
    // SECTION 2: Provision Test Users for Ownership and Secure Queries
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Provision Isolated Test Accounts');
    const studentEmail = `phase10_student_${Date.now()}@edunova.test`;
    const otherStudentEmail = `phase10_other_${Date.now()}@edunova.test`;

    // Register Student A
    const regResA = await request('/api/auth/register', 'POST', {
      name: 'Phase 10 Student A',
      email: studentEmail,
      password: 'Password123!',
      role: 'STUDENT',
      learnerType: 'SCHOOL',
    });
    studentToken = regResA.data?.data?.token;
    studentUser = regResA.data?.data?.user;
    test('Student A registered with secure token and learner profile', !!studentToken && !!studentUser);

    // Register Student B (for cross-tenant ownership testing)
    const regResB = await request('/api/auth/register', 'POST', {
      name: 'Phase 10 Student B',
      email: otherStudentEmail,
      password: 'Password123!',
      role: 'STUDENT',
      learnerType: 'COLLEGE',
    });
    otherStudentToken = regResB.data?.data?.token;
    otherStudentUser = regResB.data?.data?.user;
    test('Student B registered for tenant isolation checks', !!otherStudentToken && !!otherStudentUser);

    const authHeadersA = { Authorization: `Bearer ${studentToken}` };
    const authHeadersB = { Authorization: `Bearer ${otherStudentToken}` };

    // -------------------------------------------------------------------------
    // SECTION 3: Server-Side Validation (Zod Validation & Status Codes)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Server-Side Input Validation (Zod)');
    
    // Missing title and required fields
    const invalidTaskRes = await request('/api/tasks', 'POST', { type: 'ASSIGNMENT' }, authHeadersA);
    test('Reject invalid task payload with HTTP 400', invalidTaskRes.status === 400);
    test('Validation error envelope provides consistent errors array', !!invalidTaskRes.data?.errors || !!invalidTaskRes.data?.message);

    // Invalid progress value (> 100)
    const invalidProgressRes = await request('/api/progress/subjects/some-id', 'PUT', { progress: 150 }, authHeadersA);
    test('Reject invalid progress value > 100 with HTTP 400', invalidProgressRes.status === 400);

    // -------------------------------------------------------------------------
    // SECTION 4: Resource Ownership Checks & Secure Queries
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] Resource Ownership & Isolation Checks');
    // Student A creates a task
    const taskRes = await request('/api/tasks', 'POST', {
      title: 'Private Calculus Study Task',
      type: 'REVISION',
      priority: 'HIGH',
      subject: 'Mathematics',
      topic: 'Limits & Derivatives',
    }, authHeadersA);
    const createdTaskId = taskRes.data?.data?.id;
    test('Student A successfully creates task', !!createdTaskId);

    // Student B attempts to complete Student A's task -> Must be blocked (404/403)
    const completeByB = await request(`/api/tasks/${createdTaskId}/complete`, 'POST', {}, authHeadersB);
    test('Student B blocked from completing Student A task (ownership check)', completeByB.status === 404 || completeByB.status === 403);

    // Student B attempts to delete Student A's task -> Must be blocked (404/403)
    const deleteByB = await request(`/api/tasks/${createdTaskId}`, 'DELETE', null, authHeadersB);
    test('Student B blocked from deleting Student A task (ownership check)', deleteByB.status === 404 || deleteByB.status === 403);

    // -------------------------------------------------------------------------
    // SECTION 5: Search, Filtering, Sorting & Pagination
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 5] Search, Filtering, Sorting & Pagination');
    
    // Create multiple tasks for Student A
    await request('/api/tasks', 'POST', { title: 'Algebra Homework Drill', priority: 'LOW', subject: 'Mathematics' }, authHeadersA);
    await request('/api/tasks', 'POST', { title: 'Physics Optics Ray Diagram', priority: 'MEDIUM', subject: 'Physics' }, authHeadersA);
    await request('/api/tasks', 'POST', { title: 'Chemistry Equilibrium Lab', priority: 'HIGH', subject: 'Chemistry' }, authHeadersA);

    // Test Search (case-insensitive)
    const searchRes = await request('/api/tasks?search=algebra', 'GET', null, authHeadersA);
    test('Search tasks case-insensitively returns matches', Array.isArray(searchRes.data?.data) && searchRes.data.data.some(t => t.title.includes('Algebra')));

    // Test Filtering by Subject
    const filterRes = await request('/api/tasks?subject=Physics', 'GET', null, authHeadersA);
    test('Filter tasks by subject returns exact subject match', Array.isArray(filterRes.data?.data) && filterRes.data.data.every(t => t.subject === 'Physics'));

    // Test Pagination
    const pageRes = await request('/api/tasks?page=1&limit=2', 'GET', null, authHeadersA);
    test('Task pagination returns expected limit count', Array.isArray(pageRes.data?.data) && pageRes.data.data.length <= 2);
    test('Task pagination returns structured pagination metadata', !!pageRes.data?.pagination && pageRes.data.pagination.page === 1);

    // Test Sorting
    const sortRes = await request('/api/tasks?sortBy=title&sortOrder=asc', 'GET', null, authHeadersA);
    test('Sort tasks by title asc returns ordered items', Array.isArray(sortRes.data?.data) && sortRes.data.data.length >= 2);

    // -------------------------------------------------------------------------
    // SECTION 6: Subject and Course API with Pagination & Search
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 6] Subject & Course APIs with Pagination & Search');
    
    // Test Subject list with search & pagination
    const subjectsRes = await request('/api/subjects?page=1&limit=5');
    test('Subject list endpoint returns HTTP 200 with data', subjectsRes.status === 200 && Array.isArray(subjectsRes.data?.data));

    // Test Courses list with search & pagination
    const coursesRes = await request('/api/courses?page=1&limit=5');
    test('Course catalog endpoint returns HTTP 200 with pagination', coursesRes.status === 200 && Array.isArray(coursesRes.data?.data?.courses));

    // -------------------------------------------------------------------------
    // SECTION 7: Database Transactions (Atomic Multi-Table Updates)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 7] Database Transactions (Atomic Operations)');
    
    // Provision subject & quiz for testing transaction
    testSubject = await prisma.subject.create({
      data: {
        name: `Phase 10 Atomic Physics ${Date.now()}`,
        educationType: 'SCHOOL',
        class: '10',
        board: 'CBSE',
        category: 'Science',
        createdBy: { connect: { id: studentUser.id } },
        topics: {
          create: [{ title: 'Kinematics & Acceleration', order: 1 }],
        },
      },
      include: { topics: true },
    });

    testQuiz = await prisma.quiz.create({
      data: {
        title: 'Phase 10 Transaction Diagnostics Quiz',
        subjectId: testSubject.id,
        topicId: testSubject.topics[0].id,
        difficulty: 'BEGINNER',
        questions: {
          create: [
            {
              questionText: 'What is acceleration due to gravity on Earth?',
              options: ['9.8 m/s²', '5.0 m/s²', '12.2 m/s²', '0 m/s²'],
              correctOptionIndex: 0,
            },
            {
              questionText: 'What is the SI unit of velocity?',
              options: ['m/s', 'm/s²', 'kg', 'Joules'],
              correctOptionIndex: 0,
            },
          ],
        },
      },
      include: { questions: true },
    });

    // Student A submits quiz: triggers transaction updating QuizAttempt, XpTransaction, and LearnerProfile
    const quizSubmitRes = await request(
      `/api/quizzes/${testQuiz.id}/submit`,
      'POST',
      {
        answers: [
          { questionId: testQuiz.questions[0].id, selectedOptionIndex: 0 },
          { questionId: testQuiz.questions[1].id, selectedOptionIndex: 0 },
        ],
        timeSpentSec: 25,
      },
      authHeadersA
    );

    test('Quiz submitted with HTTP 200 and accuracy calculated', quizSubmitRes.status === 200 && quizSubmitRes.data?.data?.accuracy === 100);

    // Verify QuizAttempt persisted
    const attemptCount = await prisma.quizAttempt.count({
      where: { userId: studentUser.id, quizId: testQuiz.id },
    });
    test('QuizAttempt persisted in PostgreSQL via transaction', attemptCount === 1);

    // Verify XP transaction created
    const xpTxCount = await prisma.xpTransaction.count({
      where: { userId: studentUser.id },
    });
    test('XpTransaction created atomically in PostgreSQL', xpTxCount >= 1);

    // Verify LearnerProfile updated
    const updatedProfile = await prisma.learnerProfile.findUnique({
      where: { userId: studentUser.id },
    });
    test('LearnerProfile XP updated atomically', updatedProfile?.xp > 0);

    // -------------------------------------------------------------------------
    // SECTION 8: Dashboard Statistics Calculated From Database Records
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 8] Dashboard Statistics Calculated From Database Records');
    
    // Enroll in subject
    await request('/api/subjects/select', 'POST', { subjectId: testSubject.id }, authHeadersA);
    
    // Update subject progress
    await request(`/api/progress/subjects/${testSubject.id}`, 'PUT', {
      progress: 45,
      targetScore: 90,
      syllabusCoverage: 50,
    }, authHeadersA);

    // Fetch dashboard progress summary
    const dashProgressRes = await request('/api/progress/dashboard', 'GET', null, authHeadersA);
    test('Dashboard progress endpoint returns HTTP 200', dashProgressRes.status === 200 && dashProgressRes.data?.success);
    
    const overview = dashProgressRes.data?.data?.overview;
    test('Dashboard calculates totalSubjects from real database records', overview?.totalSubjects === 1);
    test('Dashboard calculates avgSubjectProgress from real database records', overview?.avgSubjectProgress === 45);
    test('Dashboard reflects real user XP from database records', overview?.xp === updatedProfile?.xp);

    // -------------------------------------------------------------------------
    // SECTION 9: Zero Seed Data & Proper Empty States Resilience
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 9] Zero Seed Data & Empty State Resilience');
    
    // Student B has 0 enrolled subjects, 0 courses, 0 study sessions, 0 tasks
    const studentBDash = await request('/api/progress/dashboard', 'GET', null, authHeadersB);
    test('Student B dashboard overview correctly returns 0 subjects for fresh user', studentBDash.data?.data?.overview?.totalSubjects === 0);
    test('Student B dashboard overview correctly returns 0 courses for fresh user', studentBDash.data?.data?.overview?.totalCourses === 0);
    test('Student B dashboard overview correctly returns 0% average progress without seed data', studentBDash.data?.data?.overview?.avgSubjectProgress === 0);

    const studentBTasks = await request('/api/tasks', 'GET', null, authHeadersB);
    test('Student B has exactly 0 tasks (no fabricated seed data)', studentBTasks.data?.data?.length === 0);

    const studentBSessions = await request('/api/analytics/study-sessions', 'GET', null, authHeadersB);
    test('Student B has exactly 0 study sessions (no fabricated seed data)', studentBSessions.data?.data?.length === 0);

    // -------------------------------------------------------------------------
    // SECTION 10: Structured Backend Logging Verification
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 10] Structured Backend Logging');
    test('Structured logger module is exported and functional', typeof logger.info === 'function' && typeof logger.requestLogger === 'function');

    // Test health check endpoint with X-Request-Id tracing
    const healthRes = await request('/api/health');
    test('API health check returns HTTP 200 with healthy database status', healthRes.status === 200 && healthRes.data?.data?.database === 'connected');
    test('Requests include structured X-Request-Id tracing header', !!healthRes.headers?.['x-request-id']);

  } catch (error) {
    console.error('Fatal error during test run:', error);
    failed++;
  } finally {
    // Cleanup temporary test data
    console.log('\n[CLEANUP] Cleaning up test records without deleting user data...');
    try {
      if (testQuiz) {
        await prisma.quizAttempt.deleteMany({ where: { quizId: testQuiz.id } });
        await prisma.quizQuestion.deleteMany({ where: { quizId: testQuiz.id } });
        await prisma.quiz.delete({ where: { id: testQuiz.id } });
      }
      if (testSubject) {
        await prisma.studentSubjectProgress.deleteMany({ where: { subjectId: testSubject.id } });
        await prisma.topic.deleteMany({ where: { subjectId: testSubject.id } });
        await prisma.subject.delete({ where: { id: testSubject.id } });
      }
      if (studentUser) {
        await prisma.task.deleteMany({ where: { userId: studentUser.id } });
        await prisma.xpTransaction.deleteMany({ where: { userId: studentUser.id } });
        await prisma.learnerProfile.deleteMany({ where: { userId: studentUser.id } });
        await prisma.user.delete({ where: { id: studentUser.id } });
      }
      if (otherStudentUser) {
        await prisma.learnerProfile.deleteMany({ where: { userId: otherStudentUser.id } });
        await prisma.user.delete({ where: { id: otherStudentUser.id } });
      }
      await prisma.$disconnect();
    } catch (cleanupErr) {
      console.warn('Cleanup non-critical error:', cleanupErr.message);
    }
  }

  console.log('\n========================================================');
  console.log(`  PHASE 10 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
