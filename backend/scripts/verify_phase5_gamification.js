require('dotenv').config();
const http = require('http');
const prisma = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'edunova_jwt_super_secure_secret_development_key_32chars';
const PORT = process.env.PORT || 5000;

let testPassed = 0;
let testFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  FAIL: ${message}`);
    testFailed++;
  }
}

function apiRequest({ method = 'GET', path, token, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase5Tests() {
  console.log('\n===============================================================');
  console.log('  STARTING PHASE 5 AUTOMATED VERIFICATION: TASKS & GAMIFICATION');
  console.log('===============================================================\n');

  try {
    // 1. Setup Test Student
    const testEmail = `phase5_student_${Date.now()}@edunova.test`;
    const user = await prisma.user.create({
      data: {
        name: 'Phase 5 Test Student',
        email: testEmail,
        role: 'STUDENT',
        learnerType: 'SCHOOL',
        passwordHash: 'hashedpassword',
        isEmailVerified: true,
      },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Initialize LearnerProfile
    await prisma.learnerProfile.create({
      data: {
        userId: user.id,
        xp: 100,
        level: 1,
        streakDays: 2,
        goals: [],
        weakTopics: [],
      },
    });

    console.log(`[1] Setup test student: ${user.id} (${user.email})\n`);

    // ── TEST GROUP 1: REAL TASKS CRUD IN POSTGRESQL ─────────────────────────
    console.log('[TEST GROUP 1: Task Creation, Retrieval, and Filtering]');

    const createRes = await apiRequest({
      method: 'POST',
      path: '/api/tasks',
      token,
      body: {
        title: 'Master Newton Mechanics Formulas',
        description: 'Review first, second, and third law proofs',
        subject: 'Physics (Science)',
        topic: 'Kinematics',
        type: 'Study',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        estimatedDuration: 45,
        isImportant: true,
        xpReward: 60,
        subtasks: [
          { id: 'st_1', title: 'Review F=ma derivation', completed: false },
          { id: 'st_2', title: 'Solve 3 friction problems', completed: false },
        ],
      },
    });

    assert(createRes.status === 201 && createRes.data?.success, 'Task created successfully in PostgreSQL');
    const createdTask = createRes.data?.data;
    assert(createdTask && createdTask.id, 'Created task returned valid cuid ID');
    assert(createdTask.xpReward === 60, 'Task xpReward properly set to 60');

    // Retrieve tasks with filter
    const getTasksRes = await apiRequest({
      method: 'GET',
      path: '/api/tasks?status=NOT_STARTED&priority=HIGH',
      token,
    });
    assert(getTasksRes.status === 200 && getTasksRes.data?.success, 'GET /api/tasks filters by status and priority');
    assert(
      getTasksRes.data?.data.some((t) => t.id === createdTask.id),
      'Created task returned in filtered list query'
    );

    // Summary endpoint
    const summaryRes = await apiRequest({
      method: 'GET',
      path: '/api/tasks/summary',
      token,
    });
    assert(summaryRes.status === 200 && summaryRes.data?.success, 'GET /api/tasks/summary returns metrics');
    assert(typeof summaryRes.data?.data?.total === 'number', 'Summary has total tasks count');

    // ── TEST GROUP 2: SUBTASK TOGGLING & TASK UPDATING ───────────────────────
    console.log('\n[TEST GROUP 2: Subtask Toggling & Task Updating]');

    const toggleRes = await apiRequest({
      method: 'PATCH',
      path: `/api/tasks/${createdTask.id}/toggle-subtask`,
      token,
      body: { subtaskId: 'st_1' },
    });
    assert(toggleRes.status === 200 && toggleRes.data?.success, 'Toggle subtask succeeded');
    const updatedSubtask = toggleRes.data?.data?.subtasks?.find((s) => s.id === 'st_1');
    assert(updatedSubtask?.completed === true, 'Subtask completed state is true in PostgreSQL');

    const updateRes = await apiRequest({
      method: 'PATCH',
      path: `/api/tasks/${createdTask.id}`,
      token,
      body: {
        title: 'Master Newton Mechanics Formulas & Friction',
        priority: 'URGENT',
      },
    });
    assert(updateRes.status === 200 && updateRes.data?.success, 'PATCH /api/tasks/:id updated successfully');
    assert(updateRes.data?.data?.priority === 'URGENT', 'Priority updated to URGENT');

    // ── TEST GROUP 3: VERIFIED TASK COMPLETION & EXPLOIT PREVENTION ──────────
    console.log('\n[TEST GROUP 3: Server-Side Verified Task Completion & Anti-Exploit]');

    const profileBefore = await prisma.learnerProfile.findUnique({ where: { userId: user.id } });
    const initialXp = profileBefore.xp;

    // Complete task first time
    const completeRes = await apiRequest({
      method: 'POST',
      path: `/api/tasks/${createdTask.id}/complete`,
      token,
    });
    assert(completeRes.status === 200 && completeRes.data?.success, 'Task completed successfully');
    assert(completeRes.data?.xpAwarded === 60, 'Awarded exactly 60 verified XP on first completion');

    const profileAfter1 = await prisma.learnerProfile.findUnique({ where: { userId: user.id } });
    assert(profileAfter1.xp === initialXp + 60, `Learner profile XP incremented from ${initialXp} to ${profileAfter1.xp}`);

    const txRecords = await prisma.xpTransaction.findMany({ where: { userId: user.id } });
    assert(txRecords.length === 1, 'Exactly one XpTransaction was recorded in PostgreSQL');
    assert(txRecords[0].amount === 60, 'XpTransaction amount matches 60');

    // EXPLOIT TEST 1: Try completing the same task AGAIN
    const exploitRes1 = await apiRequest({
      method: 'POST',
      path: `/api/tasks/${createdTask.id}/complete`,
      token,
    });
    assert(exploitRes1.status === 200, 'Duplicate complete request handled gracefully');
    assert(exploitRes1.data?.xpAwarded === 0, 'Exploit prevented: Duplicate complete awards 0 XP');

    const profileAfterExploit = await prisma.learnerProfile.findUnique({ where: { userId: user.id } });
    assert(profileAfterExploit.xp === profileAfter1.xp, 'Exploit prevented: User XP did NOT change on duplicate completion');

    // EXPLOIT TEST 2: Arbitrary client-supplied XP values
    const arbitraryXpRes = await apiRequest({
      method: 'POST',
      path: '/api/gamification/xp',
      token,
      body: { amount: 999999 },
    });
    assert(
      arbitraryXpRes.data?.data?.xpAwarded <= 50,
      'Exploit prevented: Client cannot supply arbitrary uncapped XP amounts (capped to <= 50)'
    );

    // ── TEST GROUP 4: PERSISTENCE OF GAME, LAB, XR & TELEMETRY ───────────────
    console.log('\n[TEST GROUP 4: Genuine Persistence for Games, Labs, XR, and Study Sessions]');

    // Game Result
    const gameRes = await apiRequest({
      method: 'POST',
      path: '/api/games/record',
      token,
      body: {
        gameId: 'rapid_formula_rush',
        gameTitle: 'Rapid Formula Rush',
        subject: 'Physics',
        score: 350,
        accuracy: 95.5,
        durationSeconds: 60,
      },
    });
    assert(gameRes.status === 201 && gameRes.data?.success, 'Game result saved to PostgreSQL with server-calculated XP');
    assert(gameRes.data?.xpAwarded > 0, `Game awarded +${gameRes.data?.xpAwarded} verified XP`);

    // Lab Attempt
    const labRes = await apiRequest({
      method: 'POST',
      path: '/api/labs/attempt',
      token,
      body: {
        labId: 'projectile_motion_lab',
        labTitle: 'Projectile Motion 3D Simulation',
        subject: 'Physics',
        score: 90,
        timeSpentMins: 20,
      },
    });
    assert(labRes.status === 201 && labRes.data?.success, 'Lab attempt saved to PostgreSQL');

    // XR Progress
    const xrRes = await apiRequest({
      method: 'POST',
      path: '/api/labs/xr-progress',
      token,
      body: {
        modelId: 'dna_double_helix_3d',
        timeSpentSeconds: 180,
        hotspotsViewed: ['hs_1', 'hs_2', 'hs_3'],
        challengesCompleted: 2,
        completed: true,
      },
    });
    assert(xrRes.status === 200 && xrRes.data?.success, 'XR spatial telemetry saved to PostgreSQL');

    // Learning Activity
    const actRes = await apiRequest({
      method: 'POST',
      path: '/api/activities',
      token,
      body: {
        type: 'PRACTICE',
        subject: 'Physics (Science)',
        topic: 'Vectors & Forces',
        durationMinutes: 25,
        accuracy: 88,
        xpEarned: 40,
      },
    });
    assert(actRes.status === 201 && actRes.data?.success, 'Learning activity event logged to PostgreSQL');

    // ── TEST GROUP 5: VERIFIED ACHIEVEMENTS & LEADERBOARDS ───────────────────
    console.log('\n[TEST GROUP 5: Database-Derived Achievements and Real Leaderboard]');

    const achievementsRes = await apiRequest({
      method: 'GET',
      path: '/api/gamification/achievements',
      token,
    });
    assert(achievementsRes.status === 200 && achievementsRes.data?.success, 'GET /api/gamification/achievements succeeded');
    const achievements = achievementsRes.data?.data?.achievements;
    assert(Array.isArray(achievements) && achievements.length > 0, 'Achievements catalog returned');
    const firstStep = achievements.find((a) => a.id === 'ach_1');
    assert(firstStep && firstStep.unlocked === true, 'First Step Beyond unlocked from verified completed activity');

    // Real Leaderboard
    const lbRes = await apiRequest({
      method: 'GET',
      path: '/api/gamification/leaderboard?limit=10',
    });
    assert(lbRes.status === 200 && lbRes.data?.success, 'Leaderboard queried strictly from real LearnerProfile records');
    const entries = lbRes.data?.data;
    assert(Array.isArray(entries) && entries.length > 0, 'Leaderboard returned real database entries');
    const ranksInOrder = entries.every((e, i) => e.rank === i + 1);
    assert(ranksInOrder, 'Leaderboard positions are consecutive from rank 1 upwards');
    const xpSorted = entries.every((e, i) => i === 0 || entries[i - 1].xp >= e.xp);
    assert(xpSorted, 'Leaderboard sorted strictly descending by verified XP');

    // Clean up test task
    const delRes = await apiRequest({
      method: 'DELETE',
      path: `/api/tasks/${createdTask.id}`,
      token,
    });
    assert(delRes.status === 200 && delRes.data?.success, 'DELETE /api/tasks/:id deletes task');

    // Clean up test user
    await prisma.user.delete({ where: { id: user.id } });
    console.log('\n[Cleanup] Cleaned up temporary test user and database artifacts.');

  } catch (err) {
    console.error('Fatal test error:', err);
    testFailed++;
  } finally {
    console.log('\n===============================================================');
    console.log(`  PHASE 5 TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log('===============================================================\n');

    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runPhase5Tests();
