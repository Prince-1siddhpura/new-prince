/**
 * EduNova Conversation Controller
 * 
 * REST handlers for listing conversation threads and fetching paginated message histories.
 */

const conversationService = require('../services/conversationService');
const { getIO } = require('../socket/socketServer');

class ConversationController {
  /**
   * GET /api/conversations
   * Returns all active conversation threads with unread counts and last message
   */
  async getUserConversations(req, res, next) {
    try {
      const conversations = await conversationService.getUserConversations(req.user.id);
      return res.json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: conversations,
        count: conversations.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/conversations/:id
   * Fetch details for a specific conversation thread
   */
  async getConversationById(req, res, next) {
    try {
      const conversation = await conversationService.getConversationById(req.params.id, req.user.id);
      return res.json({
        success: true,
        message: 'Conversation details retrieved successfully',
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/direct
   * Start or retrieve direct conversation with a peer
   */
  async getOrCreateDirectConversation(req, res, next) {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'targetUserId is required' });
      }

      const conversation = await conversationService.getOrCreateDirectConversation(req.user.id, targetUserId);
      return res.status(201).json({
        success: true,
        message: 'Direct conversation initialized',
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/conversations/:id/messages
   * Cursor-based paginated chat message history
   */
  async getConversationMessages(req, res, next) {
    try {
      const { cursor, limit } = req.query;
      const result = await conversationService.getConversationMessages(
        req.params.id,
        req.user.id,
        { cursor, limit }
      );

      return res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: result.messages,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          count: result.count,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/:id/messages
   * Post message via REST endpoint (fallback for non-socket clients)
   */
  async sendMessage(req, res, next) {
    try {
      const { content, text, messageType, fileUrl, attachment, replyToId } = req.body;
      const message = await conversationService.sendMessage(
        req.params.id,
        req.user.id,
        { content: content || text, messageType, fileUrl, attachment, replyToId }
      );

      // Broadcast to active socket room
      try {
        const io = getIO();
        io.to(`conversation:${req.params.id}`).emit('message:received', message);
      } catch (socketErr) {
        // Socket not initialized or error; REST still succeeds
      }

      return res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/:id/read
   * Mark conversation as read
   */
  async markAsRead(req, res, next) {
    try {
      await conversationService.markAsRead(req.params.id, req.user.id);
      return res.json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/messages/:messageId/react
   * Toggle emoji reaction
   */
  async toggleReaction(req, res, next) {
    try {
      const { reaction } = req.body;
      const result = await conversationService.toggleReaction(req.params.messageId, req.user.id, reaction || '👍');

      try {
        const io = getIO();
        io.emit('message:reaction', result);
      } catch (e) {}

      return res.json({
        success: true,
        message: 'Reaction updated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/conversations/messages/:messageId/pin
   * Toggle pin on message
   */
  async togglePin(req, res, next) {
    try {
      const result = await conversationService.togglePin(req.params.messageId, req.user.id);
      return res.json({
        success: true,
        message: result.isPinned ? 'Message pinned' : 'Message unpinned',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConversationController();
