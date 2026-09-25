/**
 * EduNova Conversation & Chat Service
 * 
 * Manages active conversation threads, unread counts, and cursor-based message pagination.
 */

const prisma = require('../config/db');

const DEFAULT_COMMUNITY_CHANNELS = [
  { title: '# General Discussion', channelName: 'General', description: 'Peer learning, study tips, and community updates', icon: 'Globe' },
  { title: '# Programming & Dev', channelName: 'Programming', description: 'JavaScript, Python, C++, Java & algorithms', icon: 'Code' },
  { title: '# Web Development', channelName: 'Web Development', description: 'React, Next.js, Node.js, HTML/CSS & web stack', icon: 'Layout' },
  { title: '# AI & Machine Learning', channelName: 'AI & ML', description: 'LLMs, Neural Networks, PyTorch, Prompting & Sage AI', icon: 'Sparkles' },
  { title: '# UI/UX & Product Design', channelName: 'UI/UX', description: 'Figma design systems, auto-layout, wireframing', icon: 'Figma' },
  { title: '# Data Science & SQL', channelName: 'Data Science', description: 'Pandas, SQL queries, data visualization & analytics', icon: 'Database' },
  { title: '# Board & Exam Prep', channelName: 'Exam Prep', description: 'CBSE, JEE, NEET, GRE, CMAT study strategy', icon: 'Target' },
  { title: '# Project Collaboration', channelName: 'Projects', description: 'Find teammates for hackathons & portfolio projects', icon: 'FolderGit2' },
  { title: '# Career & Internships', channelName: 'Career', description: 'Resume review, mock interviews, industry guidance', icon: 'Briefcase' },
  { title: '# Study Partners Network', channelName: 'Study Partners', description: 'Connect with dedicated daily study buddies', icon: 'Users' }
];

class ConversationService {
  /**
   * Ensure default community channels exist and auto-enroll the user
   */
  async ensureCommunityChannels(userId) {
    if (!userId) return;

    // Check existing community channels
    const existing = await prisma.conversation.findMany({
      where: { type: 'COMMUNITY' },
      select: { id: true, title: true },
    });

    const existingTitles = new Set(existing.map((c) => c.title));

    for (const ch of DEFAULT_COMMUNITY_CHANNELS) {
      let channelId;
      if (!existingTitles.has(ch.title)) {
        const created = await prisma.conversation.create({
          data: {
            type: 'COMMUNITY',
            title: ch.title,
            description: ch.description,
          },
        });
        channelId = created.id;
        existingTitles.add(ch.title);
      } else {
        const found = existing.find((c) => c.title === ch.title);
        channelId = found?.id;
      }

      if (channelId) {
        // Ensure user membership
        await prisma.conversationMember.upsert({
          where: {
            conversationId_userId: {
              conversationId: channelId,
              userId,
            },
          },
          update: {},
          create: {
            conversationId: channelId,
            userId,
            role: 'MEMBER',
          },
        }).catch(() => {});
      }
    }
  }

  /**
   * List all active conversations for a user, including the last message and unread count
   * @param {string} userId 
   */
  async getUserConversations(userId) {
    // Auto-enroll user into default community channels
    await this.ensureCommunityChannels(userId).catch(() => {});

    const userMemberships = await prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
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
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
            skillExchange: {
              select: {
                id: true,
                skillOffered: true,
                skillWanted: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    // Compute unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      userMemberships.map(async (membership) => {
        const conv = membership.conversation;
        const lastMessage = conv.messages[0] || null;

        const unreadCount = await prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            createdAt: { gt: membership.lastReadAt },
          },
        });

        // Filter other members (peers)
        const peers = conv.members
          .filter((m) => m.userId !== userId)
          .map((m) => ({
            ...m.user,
            role: m.role,
            joinedAt: m.joinedAt,
          }));

        const primaryPeer = peers[0] || null;
        const displayType = conv.type.toLowerCase(); // 'direct', 'community', 'skill_exchange'

        // Determine friendly title and participant object
        let displayTitle = conv.title;
        let participant = null;

        if (conv.type === 'DIRECT' && primaryPeer) {
          displayTitle = primaryPeer.name;
          participant = {
            id: primaryPeer.id,
            name: primaryPeer.name,
            avatar: primaryPeer.avatar,
            role: primaryPeer.role,
            status: 'Online',
          };
        } else if (conv.type === 'COMMUNITY') {
          displayTitle = conv.title || 'Community Channel';
        } else if (conv.skillExchange && primaryPeer) {
          displayTitle = `${conv.skillExchange.skillOffered} ↔ ${conv.skillExchange.skillWanted}`;
          participant = {
            id: primaryPeer.id,
            name: primaryPeer.name,
            avatar: primaryPeer.avatar,
            role: primaryPeer.role,
          };
        }

        return {
          id: conv.id,
          type: displayType,
          rawType: conv.type,
          title: displayTitle,
          channelName: conv.title?.replace('# ', '') || displayTitle,
          description: conv.description,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastReadAt: membership.lastReadAt,
          unreadCount,
          participant,
          memberCount: conv.members.length,
          lastMessage: lastMessage?.content || null,
          lastMessageTime: lastMessage
            ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null,
          lastMessageObj: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                text: lastMessage.content,
                messageType: lastMessage.messageType,
                type: lastMessage.messageType.toLowerCase(),
                fileUrl: lastMessage.fileUrl,
                attachment: lastMessage.attachment,
                createdAt: lastMessage.createdAt,
                sender: lastMessage.sender,
              }
            : null,
          peers,
          allMembers: conv.members.map((m) => ({
            ...m.user,
            memberRole: m.role,
            lastReadAt: m.lastReadAt,
          })),
          skillExchange: conv.skillExchange,
        };
      })
    );

    return conversationsWithUnread;
  }

  /**
   * Fetch a single conversation by ID with membership check
   * @param {string} conversationId 
   * @param {string} userId 
   */
  async getConversationById(conversationId, userId) {
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      // Check if this is a COMMUNITY conversation; if so, allow auto-join
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (conv && conv.type === 'COMMUNITY') {
        await prisma.conversationMember.create({
          data: {
            conversationId,
            userId,
            role: 'MEMBER',
          },
        });
      } else {
        const error = new Error('Unauthorized: You are not a member of this conversation');
        error.status = 403;
        throw error;
      }
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
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
        skillExchange: true,
      },
    });

    return conversation;
  }

  /**
   * Cursor-based paginated message history for a conversation
   * @param {string} conversationId 
   * @param {string} userId 
   * @param {{ cursor?: string, limit?: number }} query 
   */
  async getConversationMessages(conversationId, userId, { cursor, limit = 40 }) {
    // 1. Verify membership (auto-join community if needed)
    let membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (conv && conv.type === 'COMMUNITY') {
        membership = await prisma.conversationMember.create({
          data: { conversationId, userId, role: 'MEMBER' },
        });
      } else {
        const error = new Error('Unauthorized: You are not a member of this conversation');
        error.status = 403;
        throw error;
      }
    }

    const takeLimit = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);

    // 2. Fetch messages ordered by createdAt DESC for pagination
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      take: takeLimit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
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

    const hasMore = messages.length > takeLimit;
    const paginatedMessages = hasMore ? messages.slice(0, takeLimit) : messages;
    const nextCursor = hasMore ? paginatedMessages[paginatedMessages.length - 1].id : null;

    // 3. Update member's lastReadAt
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    }).catch(() => {});

    // Format messages for frontend
    const formatted = paginatedMessages.reverse().map((m) => {
      const date = new Date(m.createdAt);
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.sender?.name || 'Anonymous',
        avatar: m.sender?.avatar || null,
        sender: m.sender,
        text: m.content,
        content: m.content,
        type: m.messageType.toLowerCase(),
        messageType: m.messageType,
        fileUrl: m.fileUrl,
        attachment: m.attachment,
        replyToId: m.replyToId,
        reactions: m.reactions || {},
        isPinned: m.isPinned || false,
        createdAt: m.createdAt,
        timestamp: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    return {
      messages: formatted,
      nextCursor,
      hasMore,
      count: formatted.length,
    };
  }

  /**
   * Post a new message to a conversation via REST
   * @param {string} conversationId 
   * @param {string} senderId 
   * @param {{ content: string, messageType?: string, fileUrl?: string, attachment?: any, replyToId?: string }} data 
   */
  async sendMessage(conversationId, senderId, { content, messageType = 'TEXT', fileUrl = null, attachment = null, replyToId = null }) {
    let membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    });

    if (!membership) {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (conv && conv.type === 'COMMUNITY') {
        membership = await prisma.conversationMember.create({
          data: { conversationId, userId: senderId, role: 'MEMBER' },
        });
      } else {
        const error = new Error('Unauthorized: You are not a member of this conversation');
        error.status = 403;
        throw error;
      }
    }

    const messageContent = (content || attachment?.name || '').trim();
    if (!messageContent && !fileUrl && !attachment) {
      const error = new Error('Message content cannot be empty');
      error.status = 400;
      throw error;
    }

    const validTypes = ['TEXT', 'CODE', 'FILE'];
    const sanitizedType = validTypes.includes(messageType) ? messageType : 'TEXT';

    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId,
          senderId,
          content: messageContent,
          messageType: sanitizedType,
          fileUrl,
          attachment: attachment ? JSON.parse(JSON.stringify(attachment)) : null,
          replyToId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true,
              learnerType: true,
            },
          },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: senderId,
          },
        },
        data: { lastReadAt: new Date() },
      }),
    ]);

    const date = new Date(message.createdAt);
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender?.name || 'Anonymous',
      avatar: message.sender?.avatar || null,
      sender: message.sender,
      text: message.content,
      content: message.content,
      type: message.messageType.toLowerCase(),
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      attachment: message.attachment,
      replyToId: message.replyToId,
      reactions: message.reactions || {},
      isPinned: message.isPinned,
      createdAt: message.createdAt,
      timestamp: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  /**
   * Get or create a direct conversation with another user
   */
  async getOrCreateDirectConversation(userId, targetUserId) {
    if (userId === targetUserId) {
      const error = new Error('Cannot start a direct conversation with yourself');
      error.status = 400;
      throw error;
    }

    // Find if there is an existing DIRECT conversation between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    const newConv = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId, role: 'OWNER' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true },
            },
          },
        },
      },
    });

    return newConv;
  }

  /**
   * Toggle reaction on a message
   */
  async toggleReaction(messageId, userId, reaction) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      const error = new Error('Message not found');
      error.status = 404;
      throw error;
    }

    const reactions = (message.reactions && typeof message.reactions === 'object')
      ? { ...message.reactions }
      : {};

    const currentList = Array.isArray(reactions[reaction]) ? [...reactions[reaction]] : [];
    const index = currentList.indexOf(userId);

    if (index > -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(userId);
    }

    if (currentList.length > 0) {
      reactions[reaction] = currentList;
    } else {
      delete reactions[reaction];
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
    });

    return { messageId, reactions: updated.reactions };
  }

  /**
   * Toggle pin on a message
   */
  async togglePin(messageId, userId) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } },
    });

    if (!message) {
      const error = new Error('Message not found');
      error.status = 404;
      throw error;
    }

    const isMember = message.conversation.members.some((m) => m.userId === userId);
    if (!isMember) {
      const error = new Error('Unauthorized');
      error.status = 403;
      throw error;
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
    });

    return { messageId, isPinned: updated.isPinned };
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId, userId) {
    await prisma.conversationMember.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }
}

module.exports = new ConversationService();
