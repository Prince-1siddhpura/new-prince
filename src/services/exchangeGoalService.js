// EduNova Exchange Milestone & Goal Tracking Service

import { exchangeApi } from '../lib/apiClient';

const GOALS_KEY = 'edunova_exchange_goals_v2';

export const fetchExchangeGoals = async (exchangeId) => {
  try {
    const res = await exchangeApi.getGoals(exchangeId);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      const raw = localStorage.getItem(GOALS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const nonExch = existing.filter(g => g.exchangeId !== exchangeId);
      localStorage.setItem(GOALS_KEY, JSON.stringify([...nonExch, ...res.data]));
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch goals from server:', err.message);
  }
  return getExchangeGoals(exchangeId);
};

export const getExchangeGoals = (exchangeId) => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      return all.filter(g => g.exchangeId === exchangeId);
    }
  } catch (e) {
    console.error('Failed to load goals', e);
  }
  return [];
};

export const toggleMilestoneCompletion = (exchangeId, goalId, milestoneId) => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    const all = raw ? JSON.parse(raw) : [];

    let targetGoal = null;
    const updated = all.map(g => {
      if (g.id === goalId) {
        const newMilestones = g.milestones.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
        const completedCount = newMilestones.filter(m => m.completed).length;
        const newProgress = Math.round((completedCount / newMilestones.length) * 100);
        targetGoal = { ...g, milestones: newMilestones, progress: newProgress };
        return targetGoal;
      }
      return g;
    });

    localStorage.setItem(GOALS_KEY, JSON.stringify(updated));

    if (targetGoal) {
      exchangeApi.updateGoalProgress(goalId, targetGoal.progress, targetGoal.milestones).catch((err) => {
        console.warn('Failed to update goal progress on server:', err.message);
      });
    }

    return updated.filter(g => g.exchangeId === exchangeId);
  } catch (e) {
    console.error('Failed to toggle milestone', e);
  }
};

export const addExchangeGoal = (exchangeId, title, category, milestonesList = []) => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    const all = raw ? JSON.parse(raw) : [];

    const newGoal = {
      id: `goal_${Date.now()}`,
      exchangeId,
      title,
      category,
      progress: 0,
      milestones: milestonesList.map((m, idx) => ({ id: `m_${Date.now()}_${idx}`, text: m, completed: false }))
    };

    const updated = [...all, newGoal];
    localStorage.setItem(GOALS_KEY, JSON.stringify(updated));

    // Persist to PostgreSQL backend
    exchangeApi.createGoal({
      exchangeId,
      title,
      category,
      milestones: newGoal.milestones
    }).catch((err) => {
      console.warn('Failed to add goal on backend:', err.message);
    });

    return newGoal;
  } catch (e) {
    console.error('Failed to add goal', e);
  }
};

