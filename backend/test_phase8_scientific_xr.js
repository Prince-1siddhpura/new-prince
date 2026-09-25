/**
 * Phase 8 — Scientific & XR Features Automated Verification Suite
 * 
 * Verifies:
 * 1. Client-side mathematical simulation engines intact (kinematics, optics, circuits, calculus, CS)
 * 2. Legitimate WebXR session lifecycle & capability detection preserved
 * 3. Genuine compatibility messaging when device lacks immersive hardware
 * 4. User progress, experiment history, and results persisted to PostgreSQL
 * 5. Server-side validation of scores, durations, and XP awards (anti-spoofing)
 * 6. Non-fabrication of experiment completion and XR achievements
 */

const prisma = require('./config/db');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const labRouter = require('./routes/labs');
const gamificationRouter = require('./routes/gamification');
const fs = require('fs');
const path = require('path');

const generateAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Setup test express application
const app = express();
app.use(express.json());
app.use('/api/labs', labRouter);
app.use('/api/gamification', gamificationRouter);

async function runPhase8TestSuite() {
  console.log('🔬 ================================================================');
  console.log('🔬 PHASE 8: PRESERVE SCIENTIFIC AND XR FEATURES VERIFICATION SUITE');
  console.log('🔬 ================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  // Start temporary HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: MATHEMATICAL SIMULATION ENGINES PRESERVED (CLIENT-SIDE EXECUTION)
    // -------------------------------------------------------------------------
    console.log('📐 [Test 1/6] Verifying Mathematical & Algorithmic Simulation Engines...');

    const frontendSrcDir = path.join(__dirname, '..', 'src');
    const labSimPath = path.join(frontendSrcDir, 'services', 'labSimulationService.js');
    assert(fs.existsSync(labSimPath), 'labSimulationService.js exists in src/services');

    const labSimContent = fs.readFileSync(labSimPath, 'utf8');

    // 1a: Kinematics / Projectile Motion
    assert(labSimContent.includes('calculateProjectileState'), 'Kinematics calculateProjectileState is preserved');
    assert(labSimContent.includes('const timeOfFlight = (2 * vy0) / gravity;'), 'Kinematic flight equations are physically authentic');

    // 1b: Ray Optics Lens Equation (1/f = 1/v - 1/u => v = fu / (u+f))
    assert(labSimContent.includes('calculateOpticsState'), 'Optics calculateOpticsState is preserved');
    assert(labSimContent.includes('imageDistance = (f * u) / (u + f);'), 'Authentic thin lens equation');

    // 1c: Electric Circuitry (Ohm\'s Law V = I * R)
    assert(labSimContent.includes('calculateCircuitState'), 'Circuit simulation calculateCircuitState is preserved');
    assert(labSimContent.includes('totalCurrent = voltage / eqResistance'), 'Ohmic series/parallel resistance computation is preserved');

    // 1d: Chemistry Acid-Base Titration & pH Henderson-Hasselbalch
    assert(labSimContent.includes('calculateTitrationState'), 'Chemistry calculateTitrationState is preserved');

    // 1e: Computer Science & OS Simulations
    assert(labSimContent.includes('generateSortingSteps'), 'CS algorithm sorting step generator is preserved');
    assert(labSimContent.includes('calculateCPUScheduling'), 'OS CPU scheduling algorithms are preserved');


    // -------------------------------------------------------------------------
    // TEST 2: LEGITIMATE WEBXR & BROWSER CAPABILITY DETECTION PRESERVED
    // -------------------------------------------------------------------------
    console.log('\n🥽 [Test 2/6] Verifying WebXR, Three.js & Device Capability Services...');

    const xrCapPath = path.join(frontendSrcDir, 'services', 'xrCapabilityService.js');
    const xrSessionPath = path.join(frontendSrcDir, 'services', 'xrSessionService.js');

    assert(fs.existsSync(xrCapPath), 'xrCapabilityService.js exists in src/services');
    assert(fs.existsSync(xrSessionPath), 'xrSessionService.js exists in src/services');

    const xrCapContent = fs.readFileSync(xrCapPath, 'utf8');
    const xrSessionContent = fs.readFileSync(xrSessionPath, 'utf8');

    assert(xrCapContent.includes('navigator.xr.isSessionSupported(\'immersive-vr\')'), 'Authentic WebXR VR session query');
    assert(xrCapContent.includes('navigator.xr.isSessionSupported(\'immersive-ar\')'), 'Authentic WebXR AR session query');
    assert(xrCapContent.includes('canvas.getContext(\'webgl2\')'), 'Hardware accelerated WebGL2 graphic pipeline check');

    assert(xrSessionContent.includes('navigator.xr.requestSession(\'immersive-vr\''), 'Legitimate WebXR VR session request');
    assert(xrSessionContent.includes('session.requestReferenceSpace(\'local-floor\')'), 'WebXR spatial reference space binding');
    assert(xrSessionContent.includes('session.requestHitTestSource'), 'WebXR AR surface hit-test raycasting integration');

    // -------------------------------------------------------------------------
    // TEST 3: GENUINE COMPATIBILITY MESSAGING (NO FAKE HARDWARE CLAIMS)
    // -------------------------------------------------------------------------
    console.log('\n⚠️ [Test 3/6] Verifying Genuine WebXR Compatibility Feedback...');

    const preflightPath = path.join(frontendSrcDir, 'components', 'xr', 'XRVRPreflightModal.jsx');
    assert(fs.existsSync(preflightPath), 'XRVRPreflightModal.jsx exists');

    const preflightContent = fs.readFileSync(preflightPath, 'utf8');
    assert(preflightContent.includes('VR hardware is not connected or WebXR is unavailable on this device'), 'Displays genuine message when VR headset is absent');
    assert(preflightContent.includes('Cardboard Stereo View'), 'Provides authentic non-immersive stereo fallback');
    assert(preflightContent.includes('Continue in 360° Mode'), 'Provides authentic desktop 3D WebGL fallback');

    // -------------------------------------------------------------------------
    // TEST 4: POSTGRESQL PERSISTENCE & BACKEND VALIDATION FOR LAB EXPERIMENTS
    // -------------------------------------------------------------------------
    console.log('\n💾 [Test 4/6] Verifying PostgreSQL Persistence & Anti-Spoofing Validation...');

    // Provision test user
    const studentUser = await prisma.user.upsert({
      where: { email: 'phase8_scientist@edunova.in' },
      update: {},
      create: {
        email: 'phase8_scientist@edunova.in',
        name: 'Phase 8 Verified Scientist',
        role: 'STUDENT',
        learnerType: 'COLLEGE',
      },
    });

    const studentToken = generateAccessToken({
      id: studentUser.id,
      email: studentUser.email,
      role: studentUser.role,
    });

    // 4a: Invalid / spoofed experiment attempt rejected with 400
    const invalidAttemptRes = await fetch(`${baseUrl}/api/labs/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        labId: '', // Invalid empty labId
        labTitle: 'Projectile Lab',
        score: -50, // Invalid negative score
      }),
    });
    const invalidAttemptData = await invalidAttemptRes.json();

    assert(invalidAttemptRes.status === 400, 'Invalid lab attempt payload rejected with HTTP 400');
    assert(invalidAttemptData.code === 'VALIDATION_ERROR', 'Rejected with explicit code VALIDATION_ERROR');

    // 4b: Valid experiment attempt with parameters and mathematical state saved to PostgreSQL
    const validAttemptRes = await fetch(`${baseUrl}/api/labs/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        labId: 'physics-projectile-01',
        labTitle: 'Kinematics Trajectory Lab',
        subject: 'Physics & Mechanics',
        parameters: { velocity: 45, angle: 30, gravity: 9.8 },
        results: { timeOfFlight: 4.59, maxHeight: 25.8, maxRange: 179.1 },
        score: 92.5,
        timeSpentMins: 15,
        notes: 'Observed parabolic trajectory matching kinematic calculation.',
      }),
    });
    const validAttemptData = await validAttemptRes.json();

    assert(validAttemptRes.status === 201, 'Valid lab attempt recorded with HTTP 201 Created');
    assert(validAttemptData.success === true, 'Response returns success: true');
    assert(validAttemptData.xpAwarded > 0 && validAttemptData.xpAwarded <= 150, 'XP award strictly validated and bounded by backend (not client)');

    const savedAttemptId = validAttemptData.data.id;

    // Verify stored attempt in PostgreSQL contains full parameters and results JSON
    const dbAttempt = await prisma.labAttempt.findUnique({
      where: { id: savedAttemptId },
    });
    assert(Boolean(dbAttempt), 'Attempt record exists in PostgreSQL lab_attempts table');
    assert(dbAttempt.parameters?.velocity === 45, 'Input parameters correctly preserved in PostgreSQL');
    assert(dbAttempt.results?.maxRange === 179.1, 'Calculation results correctly preserved in PostgreSQL');

    // Verify learning activity logged
    const activityCount = await prisma.learningActivity.count({
      where: { userId: studentUser.id, type: 'SIMULATION' },
    });
    assert(activityCount >= 1, 'LearningActivity logged in PostgreSQL for auditability');

    // -------------------------------------------------------------------------
    // TEST 5: XR TELEMETRY PERSISTENCE & ANTI-FABRICATION COMPLETION CHECK
    // -------------------------------------------------------------------------
    console.log('\n🗄️ [Test 5/6] Verifying XR Telemetry Persistence & Completion Anti-Fabrication...');

    // 5a: Attempting to fabricate completion without engagement
    const fakeXrRes = await fetch(`${baseUrl}/api/labs/xr-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        modelId: 'human-heart',
        timeSpentSeconds: 2, // Only 2 seconds spent
        hotspotsViewed: [], // Zero hotspots viewed
        challengesCompleted: 0,
        completed: true, // Spoofed completion!
      }),
    });
    const fakeXrData = await fakeXrRes.json();

    assert(fakeXrRes.status === 200, 'XR progress request handled');
    assert(fakeXrData.data.completed === false, 'Backend rejected fabricated completion (duration < 15s with zero hotspots)');

    // 5b: Legitimate engagement with hotspots and time spent
    const legitXrRes = await fetch(`${baseUrl}/api/labs/xr-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        modelId: 'human-heart',
        timeSpentSeconds: 45,
        hotspotsViewed: ['hs-left-ventricle', 'hs-aorta', 'hs-myocardium'],
        challengesCompleted: 1,
        quizScore: 90,
        completed: true,
      }),
    });
    const legitXrData = await legitXrRes.json();

    assert(legitXrData.data.completed === true, 'Backend verified legitimate XR completion with inspected hotspots');

    // Verify XR progress in PostgreSQL
    const dbXrProgress = await prisma.xrProgress.findUnique({
      where: { userId_modelId: { userId: studentUser.id, modelId: 'human-heart' } },
    });
    assert(Boolean(dbXrProgress), 'XR progress record exists in PostgreSQL xr_progress table');
    assert(dbXrProgress.hotspotsViewed.length === 3, 'Hotspots viewed array persisted in PostgreSQL');

    // -------------------------------------------------------------------------
    // TEST 6: VERIFIED ACHIEVEMENTS STRICTLY FROM POSTGRESQL (NO FABRICATION)
    // -------------------------------------------------------------------------
    console.log('\n🏆 [Test 6/6] Verifying Achievements Strictly Computed from Real PostgreSQL Records...');

    const achRes = await fetch(`${baseUrl}/api/gamification/achievements`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const achData = await achRes.json();

    assert(achRes.status === 200, 'GET /api/gamification/achievements returns 200');
    assert(Array.isArray(achData.data.achievements), 'Achievements catalog returned');

    // Verify "First Step Beyond" is unlocked because student legitimately completed a lab
    const firstStep = achData.data.achievements.find(a => a.id === 'ach_1');
    assert(Boolean(firstStep), 'First Step Beyond achievement found');
    assert(firstStep.unlocked === true, 'First Step Beyond unlocked strictly from real labAttempt in PostgreSQL');

    // Verify "XR Spatial Explorer" (target: 3) reflects genuine count
    const xrExplorer = achData.data.achievements.find(a => a.id === 'ach_5');
    assert(Boolean(xrExplorer), 'XR Spatial Explorer achievement found');
    assert(xrExplorer.progress >= 1, 'Progress reflects actual PostgreSQL verified simulations count');

    // Clean up test records
    await prisma.labAttempt.deleteMany({ where: { userId: studentUser.id } });
    await prisma.xrProgress.deleteMany({ where: { userId: studentUser.id } });
    await prisma.xpTransaction.deleteMany({ where: { userId: studentUser.id } });
    await prisma.learningActivity.deleteMany({ where: { userId: studentUser.id } });
    await prisma.learnerProfile.deleteMany({ where: { userId: studentUser.id } });
    await prisma.user.deleteMany({ where: { id: studentUser.id } });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/${total} PHASE 8 VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Phase 8 test suite failed with error:', err.message);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase8TestSuite();
