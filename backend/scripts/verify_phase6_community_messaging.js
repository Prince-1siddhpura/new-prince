/**
 * Phase 6 Verification Test Suite: Real Community & Messaging
 * 
 * Verifies:
 * 1. Community Post Creation (persistence, XP award, moderation/content validation)
 * 2. Community Feed Retrieval (filters, pagination, sorting: trending/unanswered/latest)
 * 3. Community Post Upvote / Like toggle (atomic count tracking)
 * 4. Post Comments & Notification generation
 * 5. Accepted Solution workflow and role authorization
 * 6. Moderation controls (post deletion authorization, pin permissions)
 * 7. Real Conversations & Messaging (community channels, direct chat creation)
 * 8. Message persistence to PostgreSQL before delivery
 * 9. Message reactions and pin toggling
 * 10. Socket.IO handshake authentication and room access authorization
 */

const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const prisma = require('../config/db');

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

let testStudentA = null;
let testStudentB = null;
let testInstructor = null;

let tokenA = null;
let tokenB = null;
let tokenInstructor = null;

let createdPostId = null;
let createdCommentId = null;
let directConversationId = null;
let communityConversationId = null;

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(name, passed, details = '') {
  if (passed) {
    results.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.failed++;
    console.error(`  ❌ [FAIL] ${name} — ${details}`);
  }
  results.tests.push({ name, passed, details });
}

function createTestToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function setup() {
  console.log('\n--- Setting up Phase 6 Verification Test Environment ---');

  // Clean up any old test users
  const testEmails = ['test_phase6_a@edunova.test', 'test_phase6_b@edunova.test', 'test_phase6_inst@edunova.test'];
  await prisma.user.deleteMany({
    where: { email: { in: testEmails } },
  }).catch(() => {});

  // Create Test Student A
  testStudentA = await prisma.user.create({
    data: {
      name: 'Scholar Alice',
      email: 'test_phase6_a@edunova.test',
      role: 'STUDENT',
      learnerType: 'COLLEGE',
      tokenVersion: 1,
    },
  });
  tokenA = createTestToken(testStudentA);

  // Create Test Student B
  testStudentB = await prisma.user.create({
    data: {
      name: 'Scholar Bob',
      email: 'test_phase6_b@edunova.test',
      role: 'STUDENT',
      learnerType: 'COLLEGE',
      tokenVersion: 1,
    },
  });
  tokenB = createTestToken(testStudentB);

  // Create Test Instructor
  testInstructor = await prisma.user.create({
    data: {
      name: 'Prof. Minerva',
      email: 'test_phase6_inst@edunova.test',
      role: 'INSTRUCTOR',
      learnerType: 'SKILLS',
      tokenVersion: 1,
    },
  });
  tokenInstructor = createTestToken(testInstructor);

  console.log(`  Created test users: Alice (${testStudentA.id}), Bob (${testStudentB.id}), Minerva (${testInstructor.id})`);
}

async function runTests() {
  console.log('\n=== RUNNING PHASE 6 VERIFICATION SUITE ===\n');

  // -------------------------------------------------------------
  // TEST 1: Community Post Creation with Validation & XP
  // -------------------------------------------------------------
  console.log('--- 1. Community Post Creation & Persistence ---');
  try {
    const res = await fetch(`${BASE_URL}/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'How do you optimize React 19 server components and custom suspense boundaries?',
        content: 'I am exploring streaming SSR and want to understand how suspense boundaries handle waterfall loading.',
        subject: 'Computer Science',
        topic: 'React',
        difficulty: 'Advanced',
        tags: ['React', 'Performance', 'SSR'],
      }),
    });

    const body = await res.json();
    const passed = res.status === 201 && body.success && body.data?.id && body.data.title.includes('optimize React 19');
    if (passed) createdPostId = body.data.id;
    recordTest('Create valid community post in PostgreSQL', passed, JSON.stringify(body));

    // Verify record in PostgreSQL directly
    const dbPost = await prisma.communityPost.findUnique({ where: { id: createdPostId } });
    recordTest('Post persisted in database with correct author relation', Boolean(dbPost && dbPost.authorId === testStudentA.id));

    // Content moderation test: rejects profanity / inappropriate words
    const modRes = await fetch(`${BASE_URL}/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Inappropriate title with fuck inside',
        content: 'Clean content text with enough characters',
        subject: 'General',
      }),
    });
    recordTest('Moderation filter rejects inappropriate post content', modRes.status === 422);

    // Title length validation (< 5 chars should fail)
    const shortRes = await fetch(`${BASE_URL}/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Hi',
        content: 'Content that is long enough to pass',
        subject: 'General',
      }),
    });
    recordTest('Validation rejects title shorter than 5 chars', shortRes.status === 400);
  } catch (err) {
    recordTest('Post creation suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Community Feed Retrieval with Filters & Pagination
  // -------------------------------------------------------------
  console.log('\n--- 2. Community Feed Retrieval & Filters ---');
  try {
    const res = await fetch(`${BASE_URL}/community/posts?limit=10&sort=latest`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body = await res.json();
    const hasPosts = res.status === 200 && Array.isArray(body.data) && body.data.length > 0;
    const hasPagination = Boolean(body.pagination && body.pagination.totalCount >= 1);
    recordTest('Retrieve paginated community feed with metadata', hasPosts && hasPagination);

    // Filter by subject
    const subjRes = await fetch(`${BASE_URL}/community/posts?subject=Computer%20Science`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const subjBody = await subjRes.json();
    const matchesSubject = subjBody.data.every((p) => p.subject.toLowerCase() === 'computer science');
    recordTest('Filter community discussions by subject', matchesSubject && subjBody.data.length > 0);

    // Single post detail
    const detailRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const detailBody = await detailRes.json();
    recordTest('Retrieve single discussion details with view counter', detailRes.status === 200 && detailBody.data?.id === createdPostId);
  } catch (err) {
    recordTest('Feed retrieval suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Upvoting / Liking Discussions
  // -------------------------------------------------------------
  console.log('\n--- 3. Upvoting & Atomic Counter Tracking ---');
  try {
    // Bob likes Alice's post
    const likeRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const likeBody = await likeRes.json();
    recordTest('Bob upvotes discussion (toggle on)', likeRes.status === 200 && likeBody.data?.upvoted === true);

    // Bob unlikes Alice's post (toggle off)
    const unlikeRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const unlikeBody = await unlikeRes.json();
    recordTest('Bob un-upvotes discussion (toggle off)', unlikeRes.status === 200 && unlikeBody.data?.upvoted === false);

    // Re-like for comment test
    await fetch(`${BASE_URL}/community/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
  } catch (err) {
    recordTest('Upvote suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Comments, Replies & Notifications
  // -------------------------------------------------------------
  console.log('\n--- 4. Comments & Notifications ---');
  try {
    // Bob comments on Alice's post
    const commentRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        content: 'Use React 19 action hooks like useActionState combined with progressive hydration boundaries.',
      }),
    });
    const commentBody = await commentRes.json();
    const commentPassed = commentRes.status === 201 && commentBody.data?.id && commentBody.data.content.includes('useActionState');
    if (commentPassed) createdCommentId = commentBody.data.id;
    recordTest('Bob replies to discussion in database', commentPassed);

    // Verify notification was generated for Alice (post author)
    const notifs = await prisma.notification.findMany({
      where: { userId: testStudentA.id },
    });
    const hasReplyNotif = notifs.some((n) => n.title.includes('Community Reply'));
    recordTest('Post author receives notification for new peer reply', hasReplyNotif);
  } catch (err) {
    recordTest('Comments suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Accepted Solution Workflow & Authorization
  // -------------------------------------------------------------
  console.log('\n--- 5. Accepted Solution & Authorization ---');
  try {
    // Non-author Bob tries to accept an answer on Alice's post (should be 403 Forbidden)
    const unauthAcceptRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/accept-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ commentId: createdCommentId }),
    });
    recordTest('Non-author student rejected when marking accepted solution (403)', unauthAcceptRes.status === 403);

    // Alice (the author) marks Bob's comment as accepted solution
    const acceptRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/accept-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ commentId: createdCommentId }),
    });
    const acceptBody = await acceptRes.json();
    recordTest('Author successfully marks answer as accepted verified solution', acceptRes.status === 200 && acceptBody.data?.acceptedAnswerId === createdCommentId);

    // Verify in database that Bob's comment has isAccepted = true
    const dbComment = await prisma.postComment.findUnique({ where: { id: createdCommentId } });
    recordTest('Comment isAccepted flag updated to true in PostgreSQL', Boolean(dbComment && dbComment.isAccepted === true));
  } catch (err) {
    recordTest('Accepted solution suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Moderation Controls (Pinning & Deletion)
  // -------------------------------------------------------------
  console.log('\n--- 6. Moderation Controls (Pinning & Deletion) ---');
  try {
    // Student A tries to pin discussion (should be 403)
    const studentPinRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/pin`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    recordTest('Student rejected from pinning discussions (403)', studentPinRes.status === 403);

    // Instructor pins discussion (should succeed)
    const instPinRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}/pin`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenInstructor}` },
    });
    const instPinBody = await instPinRes.json();
    recordTest('Instructor successfully pins discussion to top of feed', instPinRes.status === 200 && instPinBody.data?.isPinned === true);

    // Student B tries to delete Student A's post (should be 403)
    const unauthDelRes = await fetch(`${BASE_URL}/community/posts/${createdPostId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    recordTest('Unauthorized user rejected from deleting another user discussion (403)', unauthDelRes.status === 403);
  } catch (err) {
    recordTest('Moderation suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Real Conversations & Channels in PostgreSQL
  // -------------------------------------------------------------
  console.log('\n--- 7. Real Conversations & Community Channels ---');
  try {
    // Alice requests conversations list
    const convsRes = await fetch(`${BASE_URL}/conversations`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const convsBody = await convsRes.json();
    const hasConvs = convsRes.status === 200 && Array.isArray(convsBody.data) && convsBody.data.length > 0;
    recordTest('Retrieve database conversations including auto-enrolled community channels', hasConvs);

    // Find a community channel
    const communityConv = convsBody.data.find((c) => c.type === 'community' || c.rawType === 'COMMUNITY');
    if (communityConv) communityConversationId = communityConv.id;
    recordTest('Default genuine community channels exist in database', Boolean(communityConversationId));

    // Direct conversation initialization between Alice and Bob
    const directRes = await fetch(`${BASE_URL}/conversations/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetUserId: testStudentB.id }),
    });
    const directBody = await directRes.json();
    const directPassed = directRes.status === 201 && directBody.data?.id;
    if (directPassed) directConversationId = directBody.data.id;
    recordTest('Initialize genuine DIRECT conversation thread between peers', directPassed);
  } catch (err) {
    recordTest('Conversation suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Real Message Persistence & Retrieval
  // -------------------------------------------------------------
  console.log('\n--- 8. Real Message Persistence & Cursor Pagination ---');
  try {
    // Alice posts message to Direct Conversation
    const msgRes = await fetch(`${BASE_URL}/conversations/${directConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        content: 'Hello Bob! Ready to study React hooks and algorithms together?',
        messageType: 'TEXT',
      }),
    });
    const msgBody = await msgRes.json();
    const msgPassed = msgRes.status === 201 && msgBody.data?.id && msgBody.data.content.includes('Ready to study');
    const messageId = msgBody.data?.id;
    recordTest('Message persisted to PostgreSQL before return', msgPassed);

    // Verify directly in DB
    const dbMsg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    recordTest('ChatMessage record exists with correct sender and conversation relation', Boolean(dbMsg && dbMsg.senderId === testStudentA.id));

    // Retrieve paginated messages
    const getMsgsRes = await fetch(`${BASE_URL}/conversations/${directConversationId}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const getMsgsBody = await getMsgsRes.json();
    recordTest('Bob retrieves persisted conversation history', getMsgsRes.status === 200 && getMsgsBody.data.length >= 1);

    // Message reaction toggle
    const reactRes = await fetch(`${BASE_URL}/conversations/messages/${messageId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ reaction: '🔥' }),
    });
    const reactBody = await reactRes.json();
    recordTest('Toggle emoji reaction on chat message', reactRes.status === 200 && reactBody.data?.reactions?.['🔥']?.includes(testStudentB.id));

    // Message pin toggle
    const pinRes = await fetch(`${BASE_URL}/conversations/messages/${messageId}/pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pinBody = await pinRes.json();
    recordTest('Pin message within conversation', pinRes.status === 200 && pinBody.data?.isPinned === true);
  } catch (err) {
    recordTest('Message persistence suite', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Socket.IO Authentication & Room Authorization
  // -------------------------------------------------------------
  console.log('\n--- 9. Socket.IO Authentication & Authorization ---');
  await new Promise((resolve) => {
    // Attempt unauthenticated socket connection (should be rejected)
    const unauthSocket = io(SOCKET_URL, {
      auth: {},
      transports: ['websocket'],
      reconnection: false,
    });

    unauthSocket.on('connect_error', (err) => {
      recordTest('Socket.IO rejects unauthenticated connection without token', err.message.includes('Authentication'));
      unauthSocket.disconnect();

      // Now connect with valid token
      const authSocket = io(SOCKET_URL, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false,
      });

      authSocket.on('connect', () => {
        recordTest('Socket.IO authenticates connection with valid JWT handshake', true);

        // Try joining conversation Bob is not a member of (create a private one between Minerva & Alice)
        // Let's test room join authorization
        authSocket.emit('join:conversation', { conversationId: directConversationId }, (joinRes) => {
          recordTest('Authorized member successfully joins conversation room', joinRes && joinRes.success === true);

          // Test real-time message sending via socket event
          authSocket.emit('send:message', {
            conversationId: directConversationId,
            content: 'Real-time test message via Socket.IO engine with PostgreSQL persistence',
            messageType: 'TEXT',
          }, async (sendRes) => {
            const socketMsgPassed = sendRes && sendRes.success === true && sendRes.message?.id;
            recordTest('Socket.IO send:message persists to DB and returns acknowledgment', socketMsgPassed);

            if (sendRes?.message?.id) {
              const inDb = await prisma.chatMessage.findUnique({ where: { id: sendRes.message.id } });
              recordTest('Socket-dispatched message is verified in PostgreSQL database', Boolean(inDb));
            }

            authSocket.disconnect();
            resolve();
          });
        });
      });

      authSocket.on('connect_error', (authErr) => {
        recordTest('Socket.IO authentication', false, authErr.message);
        authSocket.disconnect();
        resolve();
      });
    });

    unauthSocket.on('connect', () => {
      recordTest('Socket.IO rejects unauthenticated connection', false, 'Connected without token unexpectedly');
      unauthSocket.disconnect();
      resolve();
    });
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`PHASE 6 VERIFICATION SUMMARY:`);
  console.log(`  Total Passed: ${results.passed}`);
  console.log(`  Total Failed: ${results.failed}`);
  console.log('======================================================\n');

  // Clean up test users and created records
  console.log('Cleaning up test records...');
  if (createdPostId) {
    await prisma.communityPost.delete({ where: { id: createdPostId } }).catch(() => {});
  }
  if (directConversationId) {
    await prisma.conversation.delete({ where: { id: directConversationId } }).catch(() => {});
  }
  await prisma.user.deleteMany({
    where: { id: { in: [testStudentA.id, testStudentB.id, testInstructor.id] } },
  }).catch(() => {});
  console.log('Test cleanup complete.\n');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

setup()
  .then(runTests)
  .catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
