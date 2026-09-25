import { quizService } from './quizService';
import { subjectService } from './subjectService';

export const getExamSyllabusData = () => {
  try {
    const enrolled = subjectService.getEnrolledSubjects() || [];
    if (enrolled.length > 0) {
      const breakdown = enrolled.slice(0, 3).map(s => ({
        subject: s.name,
        completed: s.completedChapters?.length || 0,
        total: Math.max(10, (s.completedChapters?.length || 0) + 12),
        progress: s.progress || s.userProgress || 0,
        nextTopic: s.weakTopic || 'Diagnostic Assessment'
      }));
      return {
        examName: 'Competitive & Academic Diagnostic Target',
        daysRemaining: 180,
        totalTopics: breakdown.reduce((acc, b) => acc + b.total, 0),
        completedTopics: breakdown.reduce((acc, b) => acc + b.completed, 0),
        inRevisionTopics: 2,
        remainingTopics: Math.max(1, breakdown.reduce((acc, b) => acc + (b.total - b.completed), 0)),
        masteredTopics: breakdown.filter(b => b.progress >= 80).length,
        subjectBreakdown: breakdown
      };
    }
  } catch (e) {}

  return {
    examName: 'Academic Diagnostic Target',
    daysRemaining: 180,
    totalTopics: 30,
    completedTopics: 0,
    inRevisionTopics: 0,
    remainingTopics: 30,
    masteredTopics: 0,
    subjectBreakdown: [
      { subject: 'Physics', completed: 0, total: 10, progress: 0, nextTopic: 'Electrostatics & Mechanics' },
      { subject: 'Chemistry', completed: 0, total: 10, progress: 0, nextTopic: 'Chemical Bonding' },
      { subject: 'Mathematics', completed: 0, total: 10, progress: 0, nextTopic: 'Calculus Fundamentals' }
    ]
  };
};

export const getMockTestIntelligence = () => {
  try {
    const attempts = quizService.loadAttempts();
    if (attempts && attempts.length > 0) {
      const last = attempts[0];
      const avgAccuracy = Math.round(attempts.reduce((acc, a) => acc + (a.scorePercentage || a.score || 0), 0) / attempts.length);
      return {
        recentMockScore: `${last.score || last.scorePercentage || 0}%`,
        overallAccuracy: `${avgAccuracy}%`,
        avgTimePerQuestion: '1m 30s',
        attemptRate: `${attempts.length} Test${attempts.length > 1 ? 's' : ''}`,
        scoreTrend: attempts.slice(0, 4).reverse().map((a, idx) => ({
          test: `Attempt ${idx + 1}`,
          score: Math.round(a.scorePercentage || (a.score * 10) || 70),
          accuracy: Math.round(a.scorePercentage || 70)
        }))
      };
    }
  } catch (e) {}

  return {
    recentMockScore: 'Diagnostic Pending',
    overallAccuracy: '0%',
    avgTimePerQuestion: '0m',
    attemptRate: '0 Tests',
    scoreTrend: []
  };
};

export const getErrorIntelligence = () => {
  return [
    { category: 'Conceptual Error', count: 5, color: '#f43f5e', description: 'Misunderstood physical law or mathematical property', action: 'Ask Sage AI to Re-explain' },
    { category: 'Calculation Mistake', count: 8, color: '#f59e0b', description: 'Sign or arithmetic error during multi-step derivation', action: 'Practice Step-by-Step' },
    { category: 'Misread Question', count: 3, color: '#06b6d4', description: 'Overlooked specific constraints or given units', action: 'Add to Revision Checklist' },
    { category: 'Forgotten Formula', count: 4, color: '#a855f7', description: 'Stalled due to key identity or constant value', action: 'Flashcard Drill' },
    { category: 'Time Pressure Rush', count: 6, color: '#6366f1', description: 'Guessed under last 10-minute timer constraint', action: 'Speed Practice Drill' }
  ];
};

export default {
  getExamSyllabusData,
  getMockTestIntelligence,
  getErrorIntelligence
};
