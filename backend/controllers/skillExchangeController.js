/**
 * EduNova Skill Exchange Controller
 * 
 * REST handlers for managing peer-to-peer skill swap proposals and room auto-provisioning.
 */

const skillExchangeService = require('../services/skillExchangeService');
const { getIO } = require('../socket/socketServer');

class SkillExchangeController {
  /**
   * POST /api/exchanges/request
   * Create a skill swap proposal between two learners
   */
  async createExchangeRequest(req, res, next) {
    try {
      const { receiverId, skillOffered, skillWanted } = req.body;
      const exchange = await skillExchangeService.createExchangeRequest(req.user.id, {
        receiverId,
        skillOffered,
        skillWanted,
      });

      // Emit real-time notification to recipient if socket is active
      try {
        const io = getIO();
        io.to(`user:${receiverId}`).emit('exchange:new_request', {
          exchange,
          sender: {
            id: req.user.id,
            name: req.user.name,
            avatar: req.user.avatar,
          },
        });
      } catch (socketErr) {
        // Socket may not be connected or initialized
      }

      return res.status(201).json({
        success: true,
        message: 'Skill exchange request submitted successfully',
        data: exchange,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/exchanges/:id/status
   * Accept, reject, or complete a skill exchange proposal
   */
  async updateExchangeStatus(req, res, next) {
    try {
      const { status } = req.body;
      const exchange = await skillExchangeService.updateExchangeStatus(
        req.params.id,
        req.user.id,
        { status }
      );

      // Emit socket notification to both participants
      try {
        const io = getIO();
        const notifyData = {
          exchangeId: exchange.id,
          status: exchange.status,
          conversationId: exchange.conversationId,
          updatedBy: req.user.id,
        };

        io.to(`user:${exchange.senderId}`).emit('exchange:status_updated', notifyData);
        io.to(`user:${exchange.receiverId}`).emit('exchange:status_updated', notifyData);

        if (status === 'ACCEPTED' && exchange.conversationId) {
          io.to(`user:${exchange.senderId}`).emit('conversation:created', {
            conversationId: exchange.conversationId,
            type: 'SKILL_EXCHANGE',
          });
          io.to(`user:${exchange.receiverId}`).emit('conversation:created', {
            conversationId: exchange.conversationId,
            type: 'SKILL_EXCHANGE',
          });
        }
      } catch (socketErr) {
        // Socket not initialized or non-critical
      }

      return res.json({
        success: true,
        message: `Skill exchange status updated to ${status}`,
        data: exchange,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchanges
   * List all skill exchanges involving the authenticated learner
   */
  async getUserExchanges(req, res, next) {
    try {
      const { status, type } = req.query;
      const exchanges = await skillExchangeService.getUserExchanges(req.user.id, { status, type });
      return res.json({
        success: true,
        message: 'Skill exchanges retrieved successfully',
        data: exchanges,
        count: exchanges.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchanges/:id
   * Fetch specific skill exchange details
   */
  async getExchangeById(req, res, next) {
    try {
      const exchange = await skillExchangeService.getExchangeById(req.params.id, req.user.id);
      return res.json({
        success: true,
        message: 'Skill exchange retrieved successfully',
        data: exchange,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchanges/:id/meetings or /api/exchanges/meetings
   */
  async getMeetings(req, res, next) {
    try {
      const exchangeId = req.params.id || req.query.exchangeId;
      const prisma = require('../config/db');
      const where = exchangeId ? { exchangeId } : {
        OR: [{ hostId: req.user.id }, { guestId: req.user.id }],
      };
      const meetings = await prisma.exchangeMeeting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, data: meetings });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/exchanges/:id/meetings or /api/exchanges/meetings
   */
  async scheduleMeeting(req, res, next) {
    try {
      const exchangeId = req.params.id || req.body.exchangeId;
      const hostId = req.user.id;
      const { participantId, guestId, title, topic, date, scheduledDate, startTime, timeSlot, notes, meetingLink, meetingUrl } = req.body;
      const prisma = require('../config/db');

      const meeting = await prisma.exchangeMeeting.create({
        data: {
          exchangeId: exchangeId || 'general',
          hostId,
          guestId: participantId || guestId || hostId,
          topic: title || topic || 'Skill Swap Session',
          scheduledDate: date || scheduledDate || new Date().toISOString().split('T')[0],
          timeSlot: startTime || timeSlot || '05:00 PM',
          notes: notes || null,
          meetingUrl: meetingLink || meetingUrl || `https://meet.edunova.com/room/${exchangeId || Date.now()}`,
          status: 'Scheduled',
        },
      });
      return res.status(201).json({ success: true, data: meeting });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/exchanges/meetings/:meetingId/status
   */
  async updateMeetingStatus(req, res, next) {
    try {
      const id = req.params.meetingId || req.params.id;
      const { status } = req.body;
      const prisma = require('../config/db');
      const updated = await prisma.exchangeMeeting.update({
        where: { id },
        data: { status: status || 'Completed' },
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exchanges/:id/goals or /api/exchanges/goals
   */
  async getGoals(req, res, next) {
    try {
      const exchangeId = req.params.id || req.query.exchangeId;
      const prisma = require('../config/db');
      const where = exchangeId ? { exchangeId } : {};
      const goals = await prisma.exchangeGoal.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });
      return res.json({ success: true, data: goals });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/exchanges/:id/goals or /api/exchanges/goals
   */
  async createGoal(req, res, next) {
    try {
      const exchangeId = req.params.id || req.body.exchangeId;
      const { title, category, milestones, milestonesList } = req.body;
      const prisma = require('../config/db');

      const rawMilestones = milestones || milestonesList;
      const formattedMilestones = Array.isArray(rawMilestones)
        ? rawMilestones.map((m, idx) => ({ id: m.id || `m_${Date.now()}_${idx}`, text: typeof m === 'string' ? m : m.text, completed: Boolean(m.completed) }))
        : [];

      const goal = await prisma.exchangeGoal.create({
        data: {
          exchangeId,
          title: title || 'Learning Milestone',
          category: category || 'General',
          progress: 0,
          milestones: formattedMilestones,
        },
      });
      return res.status(201).json({ success: true, data: goal });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/exchanges/goals/:goalId/progress
   */
  async updateGoalProgress(req, res, next) {
    try {
      const id = req.params.goalId || req.params.id;
      const { progress, milestones } = req.body;
      const prisma = require('../config/db');
      const updated = await prisma.exchangeGoal.update({
        where: { id },
        data: {
          progress: progress !== undefined ? parseInt(progress, 10) : undefined,
          milestones: Array.isArray(milestones) ? milestones : undefined,
        },
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/exchanges/:id/goals/:goalId/toggle
   */
  async toggleGoalMilestone(req, res, next) {
    try {
      const { goalId } = req.params;
      const { milestoneId } = req.body;
      const prisma = require('../config/db');

      const goal = await prisma.exchangeGoal.findUnique({ where: { id: goalId } });
      if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

      const milestones = Array.isArray(goal.milestones) ? [...goal.milestones] : [];
      const target = milestones.find((m) => m.id === milestoneId);
      if (target) {
        target.completed = !target.completed;
      }
      const completedCount = milestones.filter((m) => m.completed).length;
      const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

      const updated = await prisma.exchangeGoal.update({
        where: { id: goalId },
        data: { milestones, progress },
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SkillExchangeController();

