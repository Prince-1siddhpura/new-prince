/**
 * EduNova Community Service
 * 
 * Database-backed community discussions, peer answers, upvotes, and moderation.
 */

const prisma = require('../config/db');

// Basic moderation wordlist for educational environment
const FORBIDDEN_WORDS = [
  'kill yourself', 'kys', 'hate speech', 'nazi', 'fuck', 'shit', 'bitch', 'asshole'
];

function sanitizeContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim();
}

function checkContentModeration(text) {
  if (!text) return { ok: true };
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word)) {
      return { ok: false, reason: `Content contains inappropriate language: "${word}"` };
    }
  }
  return { ok: true };
}

class CommunityService {
  /**
   * Get paginated community posts with filters
   */
  async getPosts({ page = 1, limit = 15, subject, difficulty, tag, search, sort = 'latest', currentUserId }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * take;

    const where = {};

    if (subject && subject !== 'all' && subject !== 'All Subjects') {
      where.subject = { equals: subject, mode: 'insensitive' };
    }

    if (difficulty && difficulty !== 'all') {
      where.difficulty = { equals: difficulty, mode: 'insensitive' };
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { topic: { contains: term, mode: 'insensitive' } },
      ];
    }

    let orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    if (sort === 'trending') {
      orderBy = [{ isPinned: 'desc' }, { upvotesCount: 'desc' }, { views: 'desc' }];
    } else if (sort === 'unanswered') {
      where.acceptedAnswerId = null;
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }

    const [totalCount, posts] = await Promise.all([
      prisma.communityPost.count({ where }),
      prisma.communityPost.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true,
              learnerType: true,
              studentUsername: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
          likes: currentUserId
            ? {
                where: { userId: currentUserId },
                select: { userId: true },
              }
            : false,
        },
      }),
    ]);

    // Format posts for UI
    const formatted = posts.map((post) => {
      const hasUpvoted = currentUserId ? post.likes && post.likes.length > 0 : false;
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        subject: post.subject,
        topic: post.topic || 'General',
        difficulty: post.difficulty,
        qualityStatus: post.qualityStatus,
        tags: post.tags,
        upvotes: post.upvotesCount,
        hasUpvoted,
        repliesCount: post._count.comments,
        views: post.views,
        isPinned: post.isPinned,
        acceptedAnswerId: post.acceptedAnswerId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
          id: post.author.id,
          name: post.author.name,
          avatar: post.author.avatar,
          role: post.author.role,
          badge: post.author.role === 'INSTRUCTOR' ? 'Verified Instructor' : post.author.role === 'ADMIN' ? 'Administrator' : 'Peer Scholar',
          verified: post.author.role === 'INSTRUCTOR' || post.author.role === 'ADMIN',
        },
      };
    });

    return {
      posts: formatted,
      pagination: {
        page: pageNum,
        limit: take,
        totalCount,
        totalPages: Math.ceil(totalCount / take),
        hasMore: pageNum * take < totalCount,
      },
    };
  }

  /**
   * Get single post details with all comments and accepted answer
   */
  async getPostById(postId, currentUserId) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            learnerType: true,
          },
        },
        comments: {
          orderBy: [{ isAccepted: 'desc' }, { createdAt: 'asc' }],
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
                learnerType: true,
              },
            },
          },
        },
        likes: currentUserId
          ? {
              where: { userId: currentUserId },
              select: { userId: true },
            }
          : false,
      },
    });

    if (!post) {
      const error = new Error('Community post not found');
      error.status = 404;
      throw error;
    }

    // Increment view count asynchronously
    prisma.communityPost.update({
      where: { id: postId },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    const hasUpvoted = currentUserId ? post.likes && post.likes.length > 0 : false;
    const acceptedComment = post.comments.find((c) => c.isAccepted || c.id === post.acceptedAnswerId);

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      subject: post.subject,
      topic: post.topic || 'General',
      difficulty: post.difficulty,
      qualityStatus: post.qualityStatus,
      tags: post.tags,
      upvotes: post.upvotesCount,
      hasUpvoted,
      repliesCount: post.comments.length,
      views: post.views + 1,
      isPinned: post.isPinned,
      acceptedAnswerId: post.acceptedAnswerId,
      acceptedAnswer: acceptedComment
        ? {
            id: acceptedComment.id,
            content: acceptedComment.content,
            author: acceptedComment.author.name,
            authorId: acceptedComment.author.id,
            createdAt: acceptedComment.createdAt,
          }
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        name: post.author.name,
        avatar: post.author.avatar,
        role: post.author.role,
        badge: post.author.role === 'INSTRUCTOR' ? 'Verified Instructor' : post.author.role === 'ADMIN' ? 'Administrator' : 'Peer Scholar',
        verified: post.author.role === 'INSTRUCTOR' || post.author.role === 'ADMIN',
      },
      comments: post.comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        content: c.content,
        isAccepted: c.isAccepted,
        upvotes: c.upvotesCount,
        createdAt: c.createdAt,
        author: {
          id: c.author.id,
          name: c.author.name,
          avatar: c.author.avatar,
          role: c.author.role,
        },
      })),
    };
  }

  /**
   * Create a new community post
   */
  async createPost(userId, { title, content, subject = 'General', topic, difficulty = 'Intermediate', tags = [] }) {
    const cleanTitle = sanitizeContent(title);
    const cleanContent = sanitizeContent(content);

    if (!cleanTitle || cleanTitle.length < 5) {
      const error = new Error('Discussion title must be at least 5 characters');
      error.status = 400;
      throw error;
    }

    if (cleanTitle.length > 250) {
      const error = new Error('Discussion title cannot exceed 250 characters');
      error.status = 400;
      throw error;
    }

    if (!cleanContent || cleanContent.length < 10) {
      const error = new Error('Discussion content must be at least 10 characters');
      error.status = 400;
      throw error;
    }

    // Moderation check
    const titleMod = checkContentModeration(cleanTitle);
    if (!titleMod.ok) {
      const error = new Error(titleMod.reason);
      error.status = 422;
      throw error;
    }
    const contentMod = checkContentModeration(cleanContent);
    if (!contentMod.ok) {
      const error = new Error(contentMod.reason);
      error.status = 422;
      throw error;
    }

    const cleanTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
      : [];

    // Create discussion post in PostgreSQL
    const post = await prisma.communityPost.create({
      data: {
        title: cleanTitle,
        content: cleanContent,
        subject: subject.trim(),
        topic: topic ? topic.trim() : null,
        difficulty: difficulty.trim(),
        tags: cleanTags,
        authorId: userId,
        upvotesCount: 1, // Author automatically upvotes their own question
        views: 1,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            learnerType: true,
          },
        },
      },
    });

    // Record author like and award verified XP (40 XP)
    try {
      await prisma.$transaction([
        prisma.postLike.create({
          data: {
            postId: post.id,
            userId,
          },
        }),
        prisma.xpTransaction.create({
          data: {
            userId,
            amount: 40,
            reason: `Community Discussion: ${post.title.slice(0, 40)}`,
            source: 'COMMUNITY',
          },
        }),
      ]);
    } catch (e) {}

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      subject: post.subject,
      topic: post.topic || 'General',
      difficulty: post.difficulty,
      qualityStatus: post.qualityStatus,
      tags: post.tags,
      upvotes: post.upvotesCount,
      hasUpvoted: true,
      repliesCount: 0,
      views: post.views,
      isPinned: post.isPinned,
      acceptedAnswerId: null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        name: post.author.name,
        avatar: post.author.avatar,
        role: post.author.role,
        badge: post.author.role === 'INSTRUCTOR' ? 'Verified Instructor' : post.author.role === 'ADMIN' ? 'Administrator' : 'Peer Scholar',
        verified: post.author.role === 'INSTRUCTOR' || post.author.role === 'ADMIN',
      },
    };
  }

  /**
   * Toggle post upvote/like
   */
  async toggleLike(postId, userId) {
    const existing = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    let upvoted = false;
    let newCount = 0;

    if (existing) {
      // Remove like
      await prisma.$transaction([
        prisma.postLike.delete({
          where: { id: existing.id },
        }),
        prisma.communityPost.update({
          where: { id: postId },
          data: { upvotesCount: { decrement: 1 } },
        }),
      ]);
      upvoted = false;
    } else {
      // Add like
      await prisma.$transaction([
        prisma.postLike.create({
          data: { postId, userId },
        }),
        prisma.communityPost.update({
          where: { id: postId },
          data: { upvotesCount: { increment: 1 } },
        }),
      ]);
      upvoted = true;

      // Award 10 XP for upvoting community contribution
      try {
        await prisma.xpTransaction.create({
          data: {
            userId,
            amount: 10,
            reason: 'Community Contribution Upvote',
            source: 'COMMUNITY',
          },
        });
      } catch (e) {}
    }

    const updated = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { upvotesCount: true },
    });
    newCount = Math.max(0, updated?.upvotesCount || 0);

    return { upvoted, upvotesCount: newCount };
  }

  /**
   * Add a comment/reply to a post
   */
  async addComment(postId, userId, { content }) {
    const cleanContent = sanitizeContent(content);
    if (!cleanContent || cleanContent.length < 2) {
      const error = new Error('Comment must be at least 2 characters');
      error.status = 400;
      throw error;
    }

    const modCheck = checkContentModeration(cleanContent);
    if (!modCheck.ok) {
      const error = new Error(modCheck.reason);
      error.status = 422;
      throw error;
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, authorId: true },
    });

    if (!post) {
      const error = new Error('Post not found');
      error.status = 404;
      throw error;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        authorId: userId,
        content: cleanContent,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            learnerType: true,
          },
        },
      },
    });

    // Notify post author if different user
    if (post.authorId !== userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: post.authorId,
            title: 'New Community Reply',
            message: `${comment.author.name} replied to your discussion "${post.title.slice(0, 35)}..."`,
            type: 'INFO',
            linkUrl: `/community#${postId}`,
          },
        });
      } catch (e) {}
    }

    // Award XP (15 XP for peer contribution)
    try {
      await prisma.xpTransaction.create({
        data: {
          userId,
          amount: 15,
          reason: `Community Discussion Reply: ${post.title.slice(0, 30)}`,
          source: 'COMMUNITY',
        },
      });
    } catch (e) {}

    return {
      id: comment.id,
      postId: comment.postId,
      content: comment.content,
      isAccepted: comment.isAccepted,
      upvotes: comment.upvotesCount,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        avatar: comment.author.avatar,
        role: comment.author.role,
      },
    };
  }

  /**
   * Accept an answer for a discussion question
   */
  async acceptAnswer(postId, commentId, userId, userRole) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      const error = new Error('Post not found');
      error.status = 404;
      throw error;
    }

    // Only post author or instructor/admin can accept an answer
    if (post.authorId !== userId && userRole !== 'ADMIN' && userRole !== 'INSTRUCTOR') {
      const error = new Error('Only the discussion author or an instructor can mark an accepted answer');
      error.status = 403;
      throw error;
    }

    const comment = await prisma.postComment.findUnique({
      where: { id: commentId },
      include: { author: true },
    });

    if (!comment || comment.postId !== postId) {
      const error = new Error('Comment does not belong to this discussion');
      error.status = 400;
      throw error;
    }

    // Unset any previous accepted answer on this post
    await prisma.postComment.updateMany({
      where: { postId, isAccepted: true },
      data: { isAccepted: false },
    });

    // Mark current comment as accepted and update post
    const [updatedComment] = await prisma.$transaction([
      prisma.postComment.update({
        where: { id: commentId },
        data: { isAccepted: true },
        include: { author: true },
      }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { acceptedAnswerId: commentId },
      }),
    ]);

    // Award bonus XP to answer author (35 XP)
    try {
      await prisma.xpTransaction.create({
        data: {
          userId: comment.authorId,
          amount: 35,
          reason: `Accepted Community Solution: ${post.title.slice(0, 30)}`,
          source: 'COMMUNITY',
        },
      });

      // Notification
      await prisma.notification.create({
        data: {
          userId: comment.authorId,
          title: 'Solution Accepted! (+35 XP)',
          message: `Your answer on "${post.title.slice(0, 35)}..." was marked as the accepted verified solution!`,
          type: 'ACHIEVEMENT',
          linkUrl: `/community#${postId}`,
        },
      });
    } catch (e) {}

    return {
      success: true,
      acceptedAnswerId: commentId,
      acceptedAnswer: {
        id: updatedComment.id,
        content: updatedComment.content,
        author: updatedComment.author.name,
      },
    };
  }

  /**
   * Delete a post (by author or admin/instructor)
   */
  async deletePost(postId, userId, userRole) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      const error = new Error('Post not found');
      error.status = 404;
      throw error;
    }

    if (post.authorId !== userId && userRole !== 'ADMIN' && userRole !== 'INSTRUCTOR') {
      const error = new Error('Unauthorized to delete this post');
      error.status = 403;
      throw error;
    }

    await prisma.communityPost.delete({
      where: { id: postId },
    });

    return { success: true, deletedId: postId };
  }

  /**
   * Pin or unpin a post (Moderator only: ADMIN or INSTRUCTOR)
   */
  async togglePin(postId, userRole) {
    if (userRole !== 'ADMIN' && userRole !== 'INSTRUCTOR') {
      const error = new Error('Only instructors and administrators can pin discussions');
      error.status = 403;
      throw error;
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      const error = new Error('Post not found');
      error.status = 404;
      throw error;
    }

    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    });

    return { success: true, isPinned: updated.isPinned };
  }
}

module.exports = new CommunityService();
