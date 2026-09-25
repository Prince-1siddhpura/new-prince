/**
 * EduNova Centralized Dashboard Context Engine
 * Dynamically resolves and manages full learner context (school, college, exam, skills)
 * and evaluates next best actions based on real learning data.
 */

import educationContextService from './educationContextService';
import { learnerService } from './learnerService';
import { subjectService } from './subjectService';

export const getDashboardContext = () => {
  const learner = learnerService?.getProfile ? learnerService.getProfile() : null;
  const eduContext = educationContextService.getEducationContext(learner);
  const selectedSubjects = subjectService.getSelectedSubjects();

  const type = (learner?.learnerType || eduContext?.educationType || '').toLowerCase();

  return {
    educationType: type,
    classLevel: learner?.classLevel || eduContext?.classLevel || '',
    board: learner?.board || eduContext?.board || '',
    degree: learner?.degree || eduContext?.degree || '',
    branch: learner?.branch || eduContext?.branch || '',
    semester: learner?.semester || eduContext?.semester || null,
    examTarget: learner?.exam || eduContext?.examTarget || '',
    targetDate: learner?.targetDate || '',
    selectedSubjects: selectedSubjects || [],
    learningGoals: learner?.goals || [],
    streakDays: learner?.streakDays || 0,
    careerGoal: learner?.careerGoal || '',
    learner
  };
};

/**
 * Universal "What Should I Do Now?" recommendation generator
 * Real recommendations should come from the backend AI recommendation engine.
 * Returns null when no real recommendation is available.
 */
export const getNextBestAction = () => {
  // Real recommendations are fetched from /api/ai/recommendations by the dashboard component
  return null;
};

export default {
  getDashboardContext,
  getNextBestAction
};
