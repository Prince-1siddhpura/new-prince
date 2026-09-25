/**
 * EduNova Parent Companion & Parent Dashboard Service 2.0
 * Manages parent connections, permissions, daily/weekly report generation,
 * student privacy firewall, assignments, tests, study plans, revision radar,
 * milestones, parent notifications, and Parent Sage AI intelligence.
 */

import { learnerService } from './learnerService';
import learningActivityService from './learningActivityService';
import { parentApi } from '../lib/apiClient';

const STORAGE_KEY = 'edunova_parent_companion';

const DEFAULT_STATE = {
  connectionStatus: 'NOT_CONNECTED',
  parentEmail: '',
  parentName: '',
  relationship: '',
  invitedAt: null,
  acceptedAt: null,
  permissions: {
    todayLearning: true,
    progressOverview: true,
    subjectDetail: true,
    studyTime: true,
    quizAccuracy: true,
    dailyReport: true,
    weeklyReport: true,
    achievementAlerts: true
  },
  notificationPreferences: {
    dailyReport: true,
    weeklyReport: true,
    achievementUnlocked: true,
    goalCompleted: true,
    examApproaching: true,
    longInactivity: true,
    channel: 'Email & In-App',
    quietHours: { enabled: true, start: '22:00', end: '07:00' }
  },
  privacyRules: {
    exposeSagePrivateChats: false,
    exposePrivateNotes: false,
    exposePeerMessages: false,
    exposeCommunityPosts: false
  }
};

export const fetchParentCompanionState = async () => {
  try {
    const res = await parentApi.getCompanionConfig();
    if (res && res.data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch parent companion config from server:', err.message);
  }
  return getParentCompanionState();
};

export const getParentCompanionState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read parent companion state', e);
  }
  // Try background sync
  fetchParentCompanionState().catch(() => {});
  return DEFAULT_STATE;
};

export const updateParentCompanionState = (updates) => {
  const current = getParentCompanionState();
  const updated = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // Sync back to learner profile if needed
  learnerService.updateParentCompanion({
    parentEmail: updated.parentEmail,
    status: updated.connectionStatus
  });

  // Persist to PostgreSQL backend
  parentApi.saveCompanionConfig(updated).catch((err) => {
    console.warn('Failed to save parent companion config to server:', err.message);
  });

  window.dispatchEvent(new CustomEvent('edunova:parent_updated', { detail: updated }));
  return updated;
};

export const inviteParent = (email, relationship = 'Parent / Guardian') => {
  return updateParentCompanionState({
    connectionStatus: 'PENDING',
    parentEmail: email,
    relationship,
    invitedAt: new Date().toISOString()
  });
};

export const acceptParentInvitation = () => {
  return updateParentCompanionState({
    connectionStatus: 'ACTIVE',
    acceptedAt: new Date().toISOString()
  });
};

export const disconnectParent = () => {
  return updateParentCompanionState({
    connectionStatus: 'NOT_CONNECTED'
  });
};


/**
 * Generate Parent Dashboard Data Framework
 * Real data must be fetched from the backend /api/parents endpoint.
 * This function only provides the companion state and local activity intel.
 */
export const getParentDashboardData = () => {
  const learner = learnerService?.getProfile ? learnerService.getProfile() : null;
  const timeIntel = learningActivityService.getTimeIntelligence();
  const consistency = learningActivityService.getConsistencyMatrix();
  const companion = getParentCompanionState();

  const studentName = learner?.name || 'Student';
  const studentUsername = learner?.username || '';
  const classLevel = learner?.classLevel || '';
  const board = learner?.board || '';
  const streakDays = learner?.streakDays || 0;

  const childProfile = {
    name: studentName,
    username: studentUsername,
    classLevel: classLevel,
    board: board,
    selectedSubjects: [],
    learningGoals: [],
    currentFocus: '',
    learningStreak: `${streakDays} Days Active`,
    joinedDate: ''
  };

  const weeklySummary = {
    totalTime: timeIntel.weekFormatted,
    activeDays: consistency.filter(c => c.isActive).length,
    subjectsStudied: 0,
    goalsCompleted: 0,
    plannedVsCompleted: '0 / 0 sessions completed',
    achievementsUnlocked: 0,
    currentStreak: streakDays,
    areasNeedingPractice: []
  };

  const sageInsight = `Connect your child's EduNova account to view AI-generated insights about their learning patterns, strengths, and recommended focus areas.`;

  return {
    companion,
    childProfile,
    studentName,
    studentUsername,
    classLevel,
    board,
    today: {
      studyTime: timeIntel.todayFormatted,
      lessonsCompleted: 0,
      practiceCompleted: 0,
      quizAttempts: 0,
      quizAccuracy: `${timeIntel.avgAccuracy || 0}%`,
      streakDays: streakDays,
      subjects: []
    },
    subjects: [],
    assignments: { pending: [], completed: [], dueSoonCount: 0, overdueCount: 0 },
    testsAndExams: { upcoming: [], completed: [] },
    revisionRadar: [],
    activityTimeline: [],
    studyPlan: { todaySessions: [], plannedVsCompleted: '0 / 0 sessions', missedSessionsCount: 0 },
    milestones: [],
    parentNotifications: [],
    consistency,
    dailyReport: {
      studentName,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      studyTime: timeIntel.todayFormatted,
      subjectsStudied: [],
      activitiesCompleted: '0 / 0 planned sessions',
      quizAccuracy: `${timeIntel.avgAccuracy || 0}%`,
      streakDays,
      upcomingSchedule: ''
    },
    weeklySummary,
    sageInsight,
    healthScore: 0
  };
};

export default {
  getParentCompanionState,
  updateParentCompanionState,
  inviteParent,
  acceptParentInvitation,
  disconnectParent,
  getParentDashboardData
};
