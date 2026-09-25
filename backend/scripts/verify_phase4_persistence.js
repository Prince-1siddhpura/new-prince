require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, method = 'GET', data = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  const text = await res.text();

  let json = {};
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  if (!res.ok) {
    console.error(`Request failed [${method} ${endpoint}] Status: ${res.status}:`, json);
    const error = new Error(json.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = json;
    throw error;
  }
  return { status: res.status, data: json };
}



let studentToken = '';
let studentUser = null;
let parentToken = '';
let parentUser = null;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  PHASE 4: LOCALSTORAGE REMOVAL & POSTGRESQL SUITE  ');
  console.log('====================================================\n');

  try {
    // 0. Setup test users
    console.log('--- 0. Authentication & Setup ---');
    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    if (!studentUser) throw new Error('No student found in DB');
    studentToken = jwt.sign(
      { id: studentUser.id, email: studentUser.email, role: studentUser.role, tokenVersion: studentUser.tokenVersion },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    assert(studentToken && studentUser.id, `Student authenticated via JWT (${studentUser.email})`);

    parentUser = await prisma.user.findFirst({ where: { role: 'PARENT' } });
    if (!parentUser) throw new Error('No parent found in DB');
    parentToken = jwt.sign(
      { id: parentUser.id, email: parentUser.email, role: parentUser.role, tokenVersion: parentUser.tokenVersion },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    assert(parentToken && parentUser.id, `Parent authenticated via JWT (${parentUser.email})`);
    // 1. Task Management
    console.log('\n--- 1. Task Persistence (taskService.js) ---');
    const taskPayload = {
      title: 'Phase 4 Verification Task',
      subject: 'Physics',
      category: 'School Track',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      priority: 'High',
      estimatedMinutes: 45,
      xpReward: 60,
      subtasks: [
        { id: 'sub-1', title: 'Read Chapter 4', completed: false },
        { id: 'sub-2', title: 'Solve Exercises', completed: false }
      ],
    };

    const createTaskRes = await request('/tasks', 'POST', taskPayload, studentToken);
    assert(createTaskRes.data.success && createTaskRes.data.data.id, 'Task created via backend API');
    const taskId = createTaskRes.data.data.id;

    // Verify in PostgreSQL directly
    const dbTask = await prisma.task.findUnique({ where: { id: taskId } });
    assert(dbTask && dbTask.title === taskPayload.title, 'Task verified directly in PostgreSQL `tasks` table');

    // Toggle subtask
    const toggleRes = await request(`/tasks/${taskId}/toggle-subtask`, 'PATCH', { subtaskId: 'sub-1' }, studentToken);
    assert(toggleRes.data.data.subtasks[0].completed === true, 'Subtask toggled in backend API');

    // Complete task and verify server-verified XP award
    const initialProfile = await prisma.learnerProfile.findUnique({ where: { userId: studentUser.id } });
    const initialXp = initialProfile ? initialProfile.xp : 0;

    const completeRes = await request(`/tasks/${taskId}/complete`, 'POST', {}, studentToken);
    assert(completeRes.data.data.status === 'COMPLETED', 'Task marked completed on backend');

    const updatedProfile = await prisma.learnerProfile.findUnique({ where: { userId: studentUser.id } });
    assert(updatedProfile.xp >= initialXp + 60, `Server verified XP awarded in PostgreSQL (From ${initialXp} to ${updatedProfile.xp})`);

    // Clean up task
    await request(`/tasks/${taskId}`, 'DELETE', null, studentToken);
    const dbTaskDeleted = await prisma.task.findUnique({ where: { id: taskId } });
    assert(!dbTaskDeleted, 'Task deleted from PostgreSQL');

    // 2. Learning Game Results

    console.log('\n--- 2. Game Result Persistence (gameService.js) ---');
    const gamePayload = {
      gameId: 'physics-kinematics-sim',
      gameTitle: 'Projectile Mastery',
      subject: 'Physics',
      score: 950,
      accuracy: 94,
      xpEarned: 50,
      durationSeconds: 120,
      mistakes: ['Angle mismatch on target 2'],
    };

    const recordGameRes = await request('/games/results', 'POST', gamePayload, studentToken);
    assert(recordGameRes.data.success && recordGameRes.data.data.id, 'Game result saved to backend');

    const gameResultId = recordGameRes.data.data.id;
    const dbGameResult = await prisma.gameResult.findUnique({ where: { id: gameResultId } });
    assert(dbGameResult && dbGameResult.score === 950, 'Game result verified directly in PostgreSQL `game_results`');

    const bestsRes = await request('/games/bests', 'GET', null, studentToken);
    assert(bestsRes.data.data.highScore >= 950, 'Personal bests computed from genuine database records');

    // 3. Lab Attempts & XR Progress
    console.log('\n--- 3. Lab Progress & XR Persistence (labProgressService.js, xrProgressService.js) ---');
    const labAttemptPayload = {
      labId: 'lab-snell-optics',
      labTitle: 'Optics & Refraction Lab',
      subject: 'Physics',
      parameters: { refractiveIndex: 1.52, angleOfIncidence: 45 },
      results: { angleOfRefraction: 27.7, criticalAngle: 41.1 },
      score: 98,
      timeSpentMins: 15,
      notes: 'Total internal reflection confirmed',
    };

    const recordLabRes = await request('/labs/attempts', 'POST', labAttemptPayload, studentToken);
    assert(recordLabRes.data.success && recordLabRes.data.data.id, 'Lab attempt recorded via backend API');

    const labProgressRes = await request('/labs/progress', 'GET', null, studentToken);
    assert(labProgressRes.data.data.completedLabs.includes('lab-snell-optics'), 'Lab completion aggregated from PostgreSQL attempts');

    const xrPayload = {
      timeSpentSeconds: 420,
      hotspotsViewed: ['hotspot-core', 'hotspot-lens'],
      challengesCompleted: 3,
      completed: true,
    };
    const saveXrRes = await request('/labs/xr/model-telescope', 'POST', xrPayload, studentToken);
    assert(saveXrRes.data.success && saveXrRes.data.data.timeSpentSeconds >= 420, 'XR Telemetry saved to backend');


    const getXrRes = await request('/labs/xr/model-telescope', 'GET', null, studentToken);
    assert(getXrRes.data.data.completed === true, 'XR Telemetry verified in PostgreSQL `xr_progress`');

    // 4. Learning Activity System
    console.log('\n--- 4. Learning Activity Persistence (learningActivityService.js) ---');
    const activityPayload = {
      type: 'SIMULATION',
      subject: 'Physics',
      topic: 'Ray Optics',
      durationMinutes: 30,
      accuracy: 92,
      xpEarned: 80,
    };

    const logActRes = await request('/activities', 'POST', activityPayload, studentToken);
    assert(logActRes.data.success && logActRes.data.data.id, 'Learning activity logged to backend');

    const getActRes = await request('/activities', 'GET', null, studentToken);
    const actList = getActRes.data.data.activities || getActRes.data.data;
    assert(Array.isArray(actList) && actList.some(a => a.topic === 'Ray Optics'), 'Learning activity retrieved from PostgreSQL `learning_activities`');


    // 5. Notifications
    console.log('\n--- 5. Notifications Persistence (notificationService.js) ---');
    const notifPayload = {
      title: 'Study Streak Alert',
      message: 'You have logged in 3 consecutive days!',
      type: 'STREAK',
      accent: '#22c55e',
    };

    const createNotifRes = await request('/notifications', 'POST', notifPayload, studentToken);
    assert(createNotifRes.data.success && createNotifRes.data.data.id, 'Notification created on backend');
    const notifId = createNotifRes.data.data.id;

    const markReadRes = await request(`/notifications/${notifId}/read`, 'PATCH', {}, studentToken);
    assert(markReadRes.data.data.isRead === true || markReadRes.data.data.read === true, 'Notification marked read in PostgreSQL `notifications`');


    // 6. Skill Exchange Meetings & Goals
    console.log('\n--- 6. Peer Exchange Meetings & Goals (meetingService.js, exchangeGoalService.js) ---');
    let exchange = await prisma.skillExchange.findFirst({
      where: {
        OR: [{ senderId: studentUser.id }, { receiverId: studentUser.id }],
      },
    });

    if (!exchange) {
      const otherUser = await prisma.user.findFirst({
        where: { id: { not: studentUser.id } },
      });
      if (otherUser) {
        exchange = await prisma.skillExchange.create({
          data: {
            senderId: studentUser.id,
            receiverId: otherUser.id,
            skillOffered: 'React',
            skillWanted: 'Python',
            status: 'ACCEPTED',
          },
        });
      }
    }

    if (exchange) {
      // Schedule meeting
      const meetingPayload = {
        exchangeId: exchange.id,
        participantId: exchange.receiverId,
        participantName: 'Peer Partner',
        title: 'React Code Review Session',
        date: '2026-09-30',
        startTime: '16:00',
        endTime: '17:00',
        duration: 60,
      };
      const schedRes = await request('/exchanges/meetings', 'POST', meetingPayload, studentToken);
      assert(schedRes.data.success && schedRes.data.data.id, 'Exchange meeting scheduled in backend');

      const meetingId = schedRes.data.data.id;
      const statusRes = await request(`/exchanges/meetings/${meetingId}/status`, 'PATCH', { status: 'Completed' }, studentToken);
      assert(statusRes.data.data.status === 'Completed', 'Exchange meeting status updated in PostgreSQL');

      // Create goal
      const goalPayload = {
        exchangeId: exchange.id,
        title: 'Master React Custom Hooks',
        category: 'Frontend Development',
        milestones: [
          { id: 'm-1', text: 'Build useDebounce', completed: true },
          { id: 'm-2', text: 'Build useLocalStorage', completed: false },
        ],
      };
      const goalRes = await request('/exchanges/goals', 'POST', goalPayload, studentToken);
      assert(goalRes.data.success && goalRes.data.data.id, 'Exchange goal created in backend');

      const goalId = goalRes.data.data.id;
      const progRes = await request(`/exchanges/goals/${goalId}/progress`, 'PATCH', {
        progress: 100,
        milestones: [
          { id: 'm-1', text: 'Build useDebounce', completed: true },
          { id: 'm-2', text: 'Build useLocalStorage', completed: true },
        ],
      }, studentToken);
      assert(progRes.data.data.progress === 100, 'Exchange goal progress and milestones updated in PostgreSQL');
    } else {
      console.log('  ⚠️ Skipping exchange test: No exchange partner available');
    }

    // 7. Learning Materials
    console.log('\n--- 7. Learning Materials Persistence (materialService.js) ---');
    const matPayload = {
      title: 'Kinematics Formula Cheatsheet PDF',
      subjectId: 'physics-101',
      type: 'Cheatsheet',
      description: 'Comprehensive summary of motion in 1D and 2D',
      tags: ['Physics', 'Kinematics', 'Formulas'],
    };

    const createMatRes = await request('/materials', 'POST', matPayload, studentToken);
    assert(createMatRes.data.success && createMatRes.data.data.id, 'Learning material created in backend');
    const matId = createMatRes.data.data.id;

    const getMatRes = await request('/materials?subjectId=physics-101', 'GET', null, studentToken);
    assert(getMatRes.data.data.some(m => m.id === matId), 'Material retrieved from PostgreSQL `learning_materials`');

    // 8. Homework & Assignments
    console.log('\n--- 8. Homework Persistence (homeworkTestService.js) ---');
    const hwPayload = {
      subject: 'Physics',
      title: 'Problem Set 3.4: Projectile Motion at an Angle',
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      priority: 'High',
      status: 'In Progress',
    };

    const createHwRes = await request('/homework', 'POST', hwPayload, studentToken);
    assert(createHwRes.data.success && createHwRes.data.data.id, 'Homework created in backend');
    const hwId = createHwRes.data.data.id;

    const updateHwRes = await request(`/homework/${hwId}`, 'PATCH', { status: 'Completed' }, studentToken);
    assert(updateHwRes.data.data.status === 'Completed', 'Homework status updated in PostgreSQL `homework_items`');

    // 9. Parent Companion Config
    console.log('\n--- 9. Parent Companion Configuration (parentCompanionService.js) ---');
    const companionPayload = {
      permissions: {
        todayLearning: true,
        progressOverview: true,
        subjectDetail: true,
        studyTime: true,
      },
      notificationPreferences: {
        dailyReport: true,
        weeklyReport: true,
        achievementAlerts: true,
        quietHours: { enabled: true, start: '22:00', end: '07:00' },
      },
      privacyRules: {
        exposeSagePrivateChats: false,
        exposePrivateNotes: false,
      },
    };

    const saveCompRes = await request('/parents/companion-config', 'POST', companionPayload, parentToken);
    assert(saveCompRes.data.success, 'Parent companion config saved to backend');

    const getCompRes = await request('/parents/companion-config', 'GET', null, parentToken);
    assert(getCompRes.data.data.privacyRules.exposeSagePrivateChats === false, 'Companion config retrieved from PostgreSQL `parent_companion_configs`');

    // Summary
    console.log('\n====================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED  `);
    console.log('====================================================');

    if (failed === 0) {
      console.log('🎉 ALL PHASE 4 POSTGRESQL PERSISTENCE CHECKS PASSED SUCCESSFULLY!\n');
    } else {
      console.error('❌ SOME CHECKS FAILED. INVESTIGATE ABOVE LOGS.\n');
    }
  } catch (err) {
    console.error('Test suite execution error:', err.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
