import React, { useState, useEffect } from 'react';
import { ChallengeCard } from '../../components/gamification/ChallengeCard';
import { Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { gamificationApi } from '../../lib/apiClient';

export const ChallengesPage = () => {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMissions = async () => {
    try {
      const res = await gamificationApi.getMissions();
      if (res && res.data && Array.isArray(res.data)) {
        const mapped = res.data.map(m => ({
          id: m.id,
          title: m.title,
          task: m.description,
          xpReward: m.rewardXp,
          progress: m.userProgress ?? (m.completed ? 100 : 0),
          target: 100,
          completed: Boolean(m.completed),
          expiresIn: m.period === 'DAILY' ? 'Today' : 'This Week'
        }));
        setChallenges(mapped);
      }
    } catch (e) {
      console.warn('Could not fetch backend missions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const handleClaimed = (id) => {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, completed: true, progress: c.target } : c));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={28} color="#f59e0b" /> Daily & Weekly Challenges
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Complete quest tasks to earn bonus XP energy, level up, and build consistency.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading active quest missions...
        </div>
      ) : challenges.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
        }}>
          <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
            No Active Quests Right Now
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
            You are fully caught up! New daily challenges unlock every day at midnight UTC.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {challenges.map((ch) => (
            <ChallengeCard key={ch.id} challenge={ch} onClaimed={handleClaimed} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChallengesPage;

