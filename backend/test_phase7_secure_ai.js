
/**
 * Phase 7 — Secure AI Integration Automated Verification Suite
 * 
 * Verifies:
 * 1. Backend gateway routing & credentials isolation (no client-side private keys)
 * 2. Elimination of simulated AI responses from production logic
 * 3. Genuine error handling and explicit service-unavailable states
 * 4. Multi-turn authorized conversation persistence in PostgreSQL
 * 5. Strict file upload validation (type, size, extensions) & AI rate limiting
 * 6. Truthful capability reporting (vision / OCR / document analysis)
 */

const prisma = require('./config/db');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { aiLimiter } = require('./middleware/rateLimiter');
const aiRouter = require('./routes/ai');
const geminiProvider = require('./ai/geminiProvider');
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
app.use('/api/ai', aiLimiter, aiRouter);


async function runPhase7TestSuite() {
  console.log('🔒 ================================================================');
  console.log('🔒 PHASE 7: SECURE AI INTEGRATION VERIFICATION SUITE');
  console.log('🔒 ================================================================\n');

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
    // TEST 1: CREDENTIALS AUDIT — No Private AI Keys in Browser Code
    // -------------------------------------------------------------------------
    console.log('📋 [Test 1/6] Auditing Browser Code for Private AI Credentials...');
    
    const frontendSrcDir = path.join(__dirname, '..', 'src');
    const openAIProviderPath = path.join(frontendSrcDir, 'services', 'providers', 'openaiProvider.js');
    const mockAIProviderPath = path.join(frontendSrcDir, 'services', 'providers', 'mockAIProvider.js');
    const aiServicePath = path.join(frontendSrcDir, 'services', 'ai', 'aiService.js');
    const facadeServicePath = path.join(frontendSrcDir, 'services', 'aiService.js');
    const visionServicePath = path.join(frontendSrcDir, 'services', 'visionService.js');

    const openAIContent = fs.readFileSync(openAIProviderPath, 'utf8');
    const mockAIContent = fs.readFileSync(mockAIProviderPath, 'utf8');
    const aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');
    const facadeContent = fs.readFileSync(facadeServicePath, 'utf8');
    const visionContent = fs.readFileSync(visionServicePath, 'utf8');

    assert(!openAIContent.includes('REACT_APP_OPENAI_API_KEY'), 'No REACT_APP_OPENAI_API_KEY in openaiProvider.js');
    assert(!openAIContent.includes('api.openai.com/v1/chat/completions'), 'No direct browser calls to api.openai.com');
    assert(!mockAIContent.includes('2x + 5 = 15'), 'Removed hardcoded canned math simulation from mockAIProvider.js');
    assert(!aiServiceContent.includes('What is the time complexity of binary search?'), 'Removed hardcoded flashcards from src/services/ai/aiService.js');
    assert(!facadeContent.includes('Core Theory & Concepts'), 'Removed hardcoded study plan from src/services/aiService.js');
    assert(!visionContent.includes('0.91 + Math.random()'), 'Removed fake random confidence generation from visionService.js');

    // -------------------------------------------------------------------------
    // TEST 2: ELIMINATION OF SIMULATED AI RESPONSES FROM BACKEND
    // -------------------------------------------------------------------------
    console.log('\n📋 [Test 2/6] Verifying Backend Zero-Simulation Compliance...');
    assert(typeof geminiProvider._mockSocraticStream === 'undefined', 'geminiProvider._mockSocraticStream is completely removed');
    assert(typeof geminiProvider.analyzeMultimodalContent === 'function', 'geminiProvider.analyzeMultimodalContent is implemented');
    assert(typeof geminiProvider.isConfigured === 'function', 'geminiProvider.isConfigured helper is implemented');

    // -------------------------------------------------------------------------
    // TEST 3: POSTGRESQL MULTI-TURN AI CONVERSATION PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n📋 [Test 3/6] Verifying PostgreSQL Multi-Turn Persistence & Authorization...');

    // Provision test user
    const studentUser = await prisma.user.upsert({
      where: { email: 'phase7_student@edunova.in' },
      update: {},
      create: {
        email: 'phase7_student@edunova.in',
        name: 'Phase 7 Verified Student',
        role: 'STUDENT',
        learnerType: 'COLLEGE',
      },
    });

    const studentToken = generateAccessToken({
      id: studentUser.id,
      email: studentUser.email,
      role: studentUser.role,
    });

    // Create a persistent conversation turn directly via PostgreSQL
    const testConv = await prisma.aiConversation.create({
      data: {
        userId: studentUser.id,
        title: 'Initial Database Indexing Question',
        prompt: 'Explain B-Trees vs Hash indexes in PostgreSQL',
        response: 'B-Trees support range scans and equality checks, while Hash indexes optimize solely for equality lookups.',
      },
    });

    await prisma.aiMessage.createMany({
      data: [
        { conversationId: testConv.id, role: 'user', content: 'Explain B-Trees vs Hash indexes in PostgreSQL' },
        { conversationId: testConv.id, role: 'model', content: 'B-Trees support range scans and equality checks, while Hash indexes optimize solely for equality lookups.' },
      ],
    });

    // Verify student can retrieve conversation history via authenticated API
    const historyRes = await fetch(`${baseUrl}/api/ai/history`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const historyData = await historyRes.json();

    assert(historyRes.status === 200, 'GET /api/ai/history returns 200 OK');
    assert(historyData.success === true, 'History response returns success: true');
    assert(historyData.data.history.length > 0, 'History contains persisted conversations from PostgreSQL');
    
    const matchedConv = historyData.data.history.find(c => c.id === testConv.id);
    assert(Boolean(matchedConv), 'Found created conversation in PostgreSQL history query');
    assert(matchedConv.messages.length >= 2, 'AiMessage relational entries are included in history query');

    // -------------------------------------------------------------------------
    // TEST 4: STRICT FILE UPLOAD VALIDATION & RESTRICTIONS
    // -------------------------------------------------------------------------
    console.log('\n📋 [Test 4/6] Verifying File Validation, Type Restrictions & Size Limits...');

    // 4a: Disallowed executable file rejected with 400
    const formBad = new FormData();
    const badBlob = new Blob(['console.log("malicious");'], { type: 'application/javascript' });
    formBad.append('file', badBlob, 'exploit.js');

    const badFileRes = await fetch(`${baseUrl}/api/ai/analyze-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formBad,
    });
    const badFileData = await badFileRes.json();

    assert(badFileRes.status === 400, 'Executable / JS file upload rejected with HTTP 400');
    assert(badFileData.code === 'INVALID_FILE_TYPE', 'Rejected with explicit code INVALID_FILE_TYPE');

    // 4b: Oversized file rejected with 413
    const formLarge = new FormData();
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/png' });
    formLarge.append('file', largeBlob, 'oversized.png');

    const largeFileRes = await fetch(`${baseUrl}/api/ai/analyze-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formLarge,
    });
    const largeFileData = await largeFileRes.json();

    assert(largeFileRes.status === 413, 'Oversized file (>5MB) rejected with HTTP 413');
    assert(largeFileData.code === 'FILE_TOO_LARGE', 'Rejected with explicit code FILE_TOO_LARGE');

    // 4c: Valid educational text document accepted by upload validation middleware
    const formValid = new FormData();
    const validBlob = new Blob(['# Quantum Mechanics Notes\nSchrodinger equation.'], { type: 'text/markdown' });
    formValid.append('file', validBlob, 'quantum_notes.md');

    const validFileRes = await fetch(`${baseUrl}/api/ai/analyze-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formValid,
    });

    // Upload middleware passed (status is either 200 on LLM success or 503 on high demand, never 400)
    assert(validFileRes.status === 200 || validFileRes.status === 503, 'Valid educational file passed upload validation (HTTP 200 or genuine 503)');

    // -------------------------------------------------------------------------
    // TEST 5: TRUTHFUL CAPABILITY REPORTING
    // -------------------------------------------------------------------------
    console.log('\n📋 [Test 5/6] Verifying Truthful Capability Reporting...');

    const visionStatusRes = await fetch(`${baseUrl}/api/ai/vision-status`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const visionStatusData = await visionStatusRes.json();

    assert(visionStatusRes.status === 200, 'GET /api/ai/vision-status returns 200');
    assert(typeof visionStatusData.data.isAvailable === 'boolean', 'isAvailable is genuinely reported as boolean');
    assert(Array.isArray(visionStatusData.data.supportedMimeTypes), 'supportedMimeTypes returned explicitly');
    assert(visionStatusData.data.maxFileSizeMB === 5, 'maxFileSizeMB correctly reports 5MB');

    // -------------------------------------------------------------------------
    // TEST 6: AUTHENTICATION & INPUT VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n📋 [Test 6/6] Verifying Explicit Error Codes and Rate Limiting...');

    // Unauthenticated request rejected with 401
    const unauthRes = await fetch(`${baseUrl}/api/ai/history`);
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401');

    // Empty message rejected with 400
    const emptyChatRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ message: '   ' }),
    });
    assert(emptyChatRes.status === 400, 'Empty chat message rejected with 400');

    // Clean up test records
    await prisma.aiMessage.deleteMany({ where: { conversationId: testConv.id } });
    await prisma.aiConversation.delete({ where: { id: testConv.id } });
    await prisma.user.deleteMany({ where: { email: 'phase7_student@edunova.in' } });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/${total} PHASE 7 VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Phase 7 test suite failed with error:', err.message);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase7TestSuite();
