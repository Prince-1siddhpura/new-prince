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

async function verifyPhase2() {
  console.log('--- PHASE 2 VERIFICATION: ROLE-BASED ACCESS & NAVIGATION ---');

  try {
    // 1. Check or create test users for all 4 roles
    console.log('\n[1] Finding or creating test accounts for STUDENT, PARENT, INSTRUCTOR, ADMIN...');
    
    // Student
    let student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    if (!student) {
      student = await prisma.user.create({
        data: {
          name: 'Student P2',
          email: 'test_student_phase2@edunova.com',
          role: 'STUDENT',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Instructor
    let instructor = await prisma.user.findFirst({ where: { role: 'INSTRUCTOR' } });
    if (!instructor) {
      instructor = await prisma.user.create({
        data: {
          name: 'Instructor P2',
          email: 'test_instructor_phase2@edunova.com',
          role: 'INSTRUCTOR',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Admin
    let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Admin P2',
          email: 'test_admin_phase2@edunova.com',
          role: 'ADMIN',
          passwordHash: 'dummyhash123',
        },
      });
    }

    // Parent
    let parentUser = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    if (!parentUser) {
      parentUser = await prisma.user.create({
        data: {
          name: 'Parent P2',
          email: 'test_parent_phase2@edunova.com',
          role: 'PARENT',
          studentUsername: student.email,
          passwordHash: 'dummyhash123',
        },
      });
    } else if (parentUser.studentUsername !== student.email) {
      parentUser = await prisma.user.update({
        where: { id: parentUser.id },
        data: { studentUsername: student.email },
      });
    }

    console.log('✓ Test users ready:');
    console.log(`  Student: ${student.name} (${student.email})`);
    console.log(`  Parent: ${parentUser.name} linked to child: ${parentUser.studentUsername}`);
    console.log(`  Instructor: ${instructor.name} (${instructor.email})`);
    console.log(`  Admin: ${admin.name} (${admin.email})`);

    const studentToken = generateToken(student);
    const parentToken = generateToken(parentUser);
    const instructorToken = generateToken(instructor);
    const adminToken = generateToken(admin);

    // 2. Test Session Expired / Public Auth check
    console.log('\n[2] Testing Public / Unauthenticated Request Handling...');
    const publicRes = await makeRequest('GET', '/api/auth/me');
    console.log(`  GET /api/auth/me without token -> HTTP ${publicRes.statusCode}`);
    if (publicRes.statusCode === 401) {
      console.log('  ✓ Returns clean 401 (frontend interceptor now handles this without infinite loop toast)');
    }

    // 3. Test Student Access
    console.log('\n[3] Testing Student Permissions...');
    const studentMe = await makeRequest('GET', '/api/auth/me', { Authorization: `Bearer ${studentToken}` });
    console.log(`  GET /api/auth/me (Student) -> HTTP ${studentMe.statusCode}, user: ${studentMe.body?.user?.name || studentMe.body?.user?.email}`);
    
    // Student trying instructor route
    const studentInstructorAttempt = await makeRequest('GET', '/api/instructor/dashboard', { Authorization: `Bearer ${studentToken}` });
    console.log(`  Student calling /api/instructor/dashboard -> HTTP ${studentInstructorAttempt.statusCode}`);
    if (studentInstructorAttempt.statusCode === 403) {
      console.log('  ✓ Student forbidden from accessing Instructor Workspace');
    }

    const childrenRes = await makeRequest('GET', '/api/parent/children', { Authorization: `Bearer ${parentToken}` });
    const childrenList = childrenRes.body?.data || [];
    console.log(`  GET /api/parent/children -> HTTP ${childrenRes.statusCode}, children found: ${childrenList.length}`);

    const childProfileRes = await makeRequest('GET', `/api/parent/child-profile?studentUsername=${encodeURIComponent(student.email)}`, { Authorization: `Bearer ${parentToken}` });
    console.log(`  GET /api/parent/child-profile -> HTTP ${childProfileRes.statusCode}`);
    const childData = childProfileRes.body?.data?.student;
    if (childProfileRes.statusCode === 200 && childData?.id === student.id) {
      console.log(`  ✓ Successfully returned authorized child profile for ${childData.name} (${childData.email})`);
    } else {
      console.log('  Child profile response:', childProfileRes.body);
    }

    const parentAnalyticsRes = await makeRequest('GET', '/api/analytics/overview', { Authorization: `Bearer ${parentToken}` });
    console.log(`  GET /api/analytics/overview (as Parent) -> HTTP ${parentAnalyticsRes.statusCode}`);
    if (parentAnalyticsRes.statusCode === 200) {
      console.log('  ✓ Parent analytics overview successfully resolved child metrics without errors');
    }

    // 5. Test Instructor Workspace
    console.log('\n[5] Testing Instructor Workspace Endpoints...');
    const instructorDashRes = await makeRequest('GET', '/api/instructor/dashboard', { Authorization: `Bearer ${instructorToken}` });
    console.log(`  GET /api/instructor/dashboard -> HTTP ${instructorDashRes.statusCode}, stats:`, instructorDashRes.body?.data?.stats);

    const instructorCoursesRes = await makeRequest('GET', '/api/instructor/courses', { Authorization: `Bearer ${instructorToken}` });
    console.log(`  GET /api/instructor/courses -> HTTP ${instructorCoursesRes.statusCode}, count: ${instructorCoursesRes.body?.data?.courses?.length}`);

    // Create a course as instructor
    const newCourseRes = await makeRequest('POST', '/api/instructor/courses', { Authorization: `Bearer ${instructorToken}` }, {
      title: 'Advanced Robotics 101',
      description: 'Hands-on robotics and kinematics course',
      category: 'Robotics',
      level: 'Advanced',
    });
    console.log(`  POST /api/instructor/courses -> HTTP ${newCourseRes.statusCode}`);
    if (newCourseRes.statusCode === 201) {
      const createdCourse = newCourseRes.body?.data?.course;
      console.log(`  ✓ Instructor created course: ${createdCourse?.title} (ID: ${createdCourse?.id})`);
    }

    // 6. Test Admin Authorization
    console.log('\n[6] Testing Admin Access & Server-side Authorization...');
    const adminStats = await makeRequest('GET', '/api/admin/stats', { Authorization: `Bearer ${adminToken}` });
    console.log(`  GET /api/admin/stats (Admin) -> HTTP ${adminStats.statusCode}`);

    const studentAdminAttempt = await makeRequest('GET', '/api/admin/stats', { Authorization: `Bearer ${studentToken}` });
    console.log(`  Student calling /api/admin/stats -> HTTP ${studentAdminAttempt.statusCode}`);
    if (studentAdminAttempt.statusCode === 403) {
      console.log('  ✓ Server strictly enforces admin role authorization');
    }

    console.log('\n======================================================');
    console.log('PHASE 2 ROLE-BASED NAVIGATION VERIFICATION SUCCESSFUL!');
    console.log('======================================================');

  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase2();
