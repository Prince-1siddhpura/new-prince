/**
 * EduNova Real-time Socket.IO Client
 * 
 * Authenticates socket connection with JWT token and manages real-time messaging,
 * conversation subscriptions, presence, typing indicators, and message events.
 */

import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/api$/, '')
  : 'http://localhost:5000';

let socket = null;

/**
 * Initialize or retrieve active socket connection
 */
export function getSocket() {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('edunova_token') || localStorage.getItem('token')
    : null;

  if (!socket && token) {
    socket = io(BACKEND_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ [EduNova Socket] Connected successfully | ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ [EduNova Socket] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [EduNova Socket] Disconnected:', reason);
    });
  }

  return socket;
}

/**
 * Explicitly connect socket with token (e.g. after login)
 */
export function connectSocket(token) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('edunova_token') : null);
  if (!authToken) return null;

  socket = io(BACKEND_URL, {
    auth: { token: authToken },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

/**
 * Disconnect and destroy active socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join conversation room
 */
export function joinConversation(conversationId, callback) {
  const s = getSocket();
  if (!s || !s.connected) {
    if (typeof callback === 'function') callback({ success: false, message: 'Socket not connected' });
    return;
  }

  s.emit('join:conversation', { conversationId }, (res) => {
    if (typeof callback === 'function') callback(res);
  });
}

/**
 * Leave conversation room
 */
export function leaveConversation(conversationId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('leave:conversation', { conversationId });
  }
}

/**
 * Send real-time chat message via Socket.IO with acknowledgment callback
 */
export function sendSocketMessage(payload, callback) {
  const s = getSocket();
  if (!s || !s.connected) {
    if (typeof callback === 'function') callback({ success: false, message: 'Socket not connected' });
    return;
  }

  s.emit('send:message', payload, (response) => {
    if (typeof callback === 'function') callback(response);
  });
}

/**
 * Emit typing start
 */
export function emitTypingStart(conversationId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('typing:start', { conversationId });
  }
}

/**
 * Emit typing stop
 */
export function emitTypingStop(conversationId) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('typing:stop', { conversationId });
  }
}

/**
 * Toggle reaction via socket
 */
export function emitReactionToggle(messageId, reaction, callback) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('reaction:toggle', { messageId, reaction }, callback);
  }
}

/**
 * Toggle pin via socket
 */
export function emitPinToggle(messageId, callback) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('pin:toggle', { messageId }, callback);
  }
}
