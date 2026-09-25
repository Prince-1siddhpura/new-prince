/**
 * EduNova Community Controller
 * 
 * REST API handlers for community discussions, answers, likes, and moderation.
 */

const communityService = require('../services/communityService');

class CommunityController {
  async getPosts(req, res, next) {
    try {
      const { page, limit, subject, difficulty, tag, search, sort } = req.query;
      const currentUserId = req.user?.id || null;

      const result = await communityService.getPosts({
        page,
        limit,
        subject,
        difficulty,
        tag,
        search,
        sort,
        currentUserId,
      });

      return res.json({
        success: true,
        message: 'Community discussions retrieved successfully',
        data: result.posts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPostById(req, res, next) {
    try {
      const currentUserId = req.user?.id || null;
      const post = await communityService.getPostById(req.params.id, currentUserId);

      return res.json({
        success: true,
        message: 'Post retrieved successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPost(req, res, next) {
    try {
      const { title, content, subject, topic, difficulty, tags } = req.body;
      const post = await communityService.createPost(req.user.id, {
        title,
        content,
        subject,
        topic,
        difficulty,
        tags,
      });

      return res.status(201).json({
        success: true,
        message: 'Community discussion posted successfully (+40 XP awarded)',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleLike(req, res, next) {
    try {
      const result = await communityService.toggleLike(req.params.id, req.user.id);
      return res.json({
        success: true,
        message: result.upvoted ? 'Post upvoted' : 'Upvote removed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addComment(req, res, next) {
    try {
      const { content } = req.body;
      const comment = await communityService.addComment(req.params.id, req.user.id, { content });

      return res.status(201).json({
        success: true,
        message: 'Reply posted successfully (+15 XP awarded)',
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptAnswer(req, res, next) {
    try {
      const { commentId } = req.body;
      const result = await communityService.acceptAnswer(
        req.params.id,
        commentId,
        req.user.id,
        req.user.role
      );

      return res.json({
        success: true,
        message: 'Answer marked as accepted solution',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req, res, next) {
    try {
      const result = await communityService.deletePost(req.params.id, req.user.id, req.user.role);
      return res.json({
        success: true,
        message: 'Discussion deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async togglePin(req, res, next) {
    try {
      const result = await communityService.togglePin(req.params.id, req.user.role);
      return res.json({
        success: true,
        message: result.isPinned ? 'Discussion pinned to top' : 'Discussion unpinned',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommunityController();
