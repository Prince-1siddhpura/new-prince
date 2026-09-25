import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  BookOpen,
  Award,
  Flame,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  User,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { parentApi, analyticsApi } from '../../lib/apiClient';
import { EduNovaHeroBanner } from '../../components/common/EduNovaHeroBanner';
import { Button } from '../../components/common/Button';

export const ParentChildPerformancePage = () => {
  const { user } = useAuth();
  const { theme } = useTheme() || {};
  const isLight = theme === 'light';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildUsername, setSelectedChildUsername] = useState('');

  const fetchPerformanceData = async (targetUsername = '') => {
    setLoading(true);
    setError(null);
    try {
      const [childrenRes, overviewRes] = await Promise.all([
        parentApi.getChildren().catch(() => ({ data: [] })),
        parentApi.getChildOverview(targetUsername).catch((err) => {
          throw err;
        }),
      ]);

      const list = childrenRes?.data || [];
      setChildren(list);

      const activeUsername = targetUsername || overviewRes?.data?.student?.studentUsername || '';
      setSelectedChildUsername(activeUsername);
      setOverview(overviewRes?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load child performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const handleSelectChild = (username) => {
    setSelectedChildUsername(username);
    fetchPerformanceData(username);
  };

  const cardStyle = {
    background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(18, 25, 55, 0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: isLight ? '1px solid rgba(226, 232, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: isLight ? '0 10px 30px rgba(64, 100, 160, 0.08)' : '0 10px 30px rgba(0, 0, 0, 0.4)',
  };

  const statCard = (label, value, icon, color = '#0284c7', subtext = '') => {
    const Icon = icon;
    return (
      <div style={{ ...cardStyle, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            {label}
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '2px' }}>
            {value}
          </div>
          {subtext && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              {subtext}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px 80px' }}>
      <EduNovaHeroBanner
        title="Child Performance & Learning Velocity"
        subtitle="Genuine PostgreSQL learning metrics, test scores, and syllabus progression for your student."
        badge="Live Analytics"
        badgeIcon={TrendingUp}
        primaryAction={{
          label: 'Open Parent Dashboard',
          onClick: () => navigate('/parent/dashboard'),
          icon: ShieldCheck,
        }}
        secondaryAction={{
          label: 'Child Profile Info',
          onClick: () => navigate('/parent/child-profile'),
          icon: User,
        }}
      />

      {/* Child Switcher */}
      {children.length > 1 && (
        <div style={{ ...cardStyle, marginTop: '20px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Viewing Student:
          </span>
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectChild(c.studentUsername)}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                border: 'none',
                background: selectedChildUsername === c.studentUsername
                  ? 'var(--accent-primary, #0284c7)'
                  : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'),
                color: selectedChildUsername === c.studentUsername ? '#ffffff' : 'inherit',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <User size={15} />
              {c.name} ({c.studentUsername})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ ...cardStyle, marginTop: '24px', textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={36} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
          <h3>Loading student analytics...</h3>
        </div>
      ) : error ? (
        <div style={{ ...cardStyle, marginTop: '24px', borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '12px' }}>
            <AlertTriangle size={24} />
            <h3 style={{ margin: 0 }}>Analytics Notice</h3>
          </div>
          <p>{error}</p>
          <Button onClick={() => navigate('/parent/child-profile')} style={{ marginTop: '12px' }}>
            Link Student Account
          </Button>
        </div>
      ) : !overview ? (
        <div style={{ ...cardStyle, marginTop: '24px', textAlign: 'center', padding: '60px' }}>
          <AlertTriangle size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h3>No Performance Data Found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Your student has not completed quizzes or enrolled in courses yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          {/* Key Metric Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {statCard('Average Subject Progress', `${overview.academics?.avgSubjectProgress || 0}%`, BookOpen, '#0284c7', `${overview.academics?.totalSubjects || 0} Enrolled Subjects`)}
            {statCard('Course Completion', `${overview.academics?.avgCourseProgress || 0}%`, Award, '#10b981', `${overview.academics?.totalCourses || 0} Registered Courses`)}
            {statCard('Verified Experience', `${overview.gamification?.xp || 0} XP`, Award, '#8b5cf6', `Level ${overview.gamification?.level || 1} Mastery`)}
            {statCard('Daily Study Streak', `${overview.gamification?.streakDays || 0} Days`, Flame, '#f59e0b', 'Consecutive active learning')}
          </div>

          {/* Subject Breakdown & Syllabus Coverage */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800 }}>
              Subject Syllabus Coverage & Real Performance
            </h3>
            <div style={{ display: 'grid', gap: '14px' }}>
              {overview.subjects?.length > 0 ? (
                overview.subjects.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{s.name}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                          Category: {s.category}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.88rem' }}>
                        <span>Target: <strong>{s.targetScore || 85}%</strong></span>
                        <span>Coverage: <strong style={{ color: 'var(--accent-primary)' }}>{Math.round(s.syllabusCoverage || s.progress || 0)}%</strong></span>
                      </div>
                    </div>

                    <div style={{
                      height: '8px',
                      width: '100%',
                      background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, s.progress || 0))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0284c7, #10b981)',
                        borderRadius: '10px',
                      }} />
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No enrolled subjects available.</p>
              )}
            </div>
          </div>

          {/* Recent Verified Activities & Missions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800 }}>
                Recent Verified Learning Activities
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {overview.gamification?.recentActivity?.length > 0 ? (
                  overview.gamification.recentActivity.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {act.sourceTitle}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>
                        +{act.amount} XP
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No recent activities logged.</p>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800 }}>
                Completed Learning Missions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {overview.gamification?.completedMissions?.length > 0 ? (
                  overview.gamification.completedMissions.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <strong>{m.title}</strong>
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        +{m.rewardXp} XP
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No missions completed yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentChildPerformancePage;
