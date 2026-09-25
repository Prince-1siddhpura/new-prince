import { labApi } from '../lib/apiClient';

const STORAGE_KEY = 'edunova_xr_progress_v1';
const HISTORY_KEY = 'edunova_xr_history_v1';

class XRProgressService {
  async fetchProgress(modelId) {
    try {
      const res = await labApi.getXrProgress(modelId);
      if (res && res.data) {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        all[modelId] = res.data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to fetch XR progress from server:', err.message);
    }
    return this.getProgress(modelId);
  }

  getProgress(modelId) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      return data[modelId] || {
        modelId,
        timeSpentSeconds: 0,
        hotspotsViewed: [],
        challengesCompleted: 0,
        quizScore: null,
        completed: false,
        lastVisited: null
      };
    } catch {
      return { modelId, timeSpentSeconds: 0, hotspotsViewed: [], challengesCompleted: 0, quizScore: null, completed: false, lastVisited: null };
    }
  }

  saveProgress(modelId, progressUpdate) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      const current = all[modelId] || { modelId, timeSpentSeconds: 0, hotspotsViewed: [], challengesCompleted: 0 };
      
      const updated = {
        ...current,
        ...progressUpdate,
        lastVisited: new Date().toISOString()
      };

      all[modelId] = updated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

      // Also record in recent history
      this.recordHistory(modelId);

      // Async persist to PostgreSQL backend
      labApi.saveXrProgress(modelId, updated).catch(err => {
        console.warn('Could not persist XR progress to database:', err.message);
      });

      return updated;
    } catch (e) {
      console.warn('Could not save XR progress:', e);
    }
  }

  recordHistory(modelId) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      const filtered = history.filter(h => h.modelId !== modelId);
      filtered.unshift({ modelId, timestamp: new Date().toISOString() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
    } catch (e) {
      console.warn('Could not update XR history:', e);
    }
  }

  getRecentHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }
}

export const xrProgressService = new XRProgressService();
export default xrProgressService;

