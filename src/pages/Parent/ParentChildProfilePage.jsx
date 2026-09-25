import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  GraduationCap,
  Flame,
  Award,
  BookOpen,
  Calendar,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { parentApi } from '../../lib/apiClient';
import { EduNovaHeroBanner } from '../../components/common/EduNovaHeroBanner';
import { Button } from '../../components/common/Button';

export const ParentChildProfilePage = () => {
  const { user } = useAuth();
  const { theme } = useTheme() || {};
  const isLight = theme === 'light';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildUsername, setSelectedChildUsername] = useState('');
  const [childData, setChildData] = useState(null);

  // Link another student state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUsername, setLinkUsername] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkStatus, setLinkStatus] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const fetchChildrenAndProfile = async (targetUsername = '') => {
    setLoading(true);
    setError(null);
    try {
      const childrenRes = await parentApi.getChildren();
      const list = childrenRes?.data || [];
      setChildren(list);

      const activeUsername = targetUsername || (list.length > 0 ? list[0].studentUsername : '');
      setSelectedChildUsername(activeUsername);

      if (activeUsername) {
        const profileRes = await parentApi.getChildProfile(activeUsername);
        setChildData(profileRes?.data || null);
      } else {
        setChildData(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve child profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildrenAndProfile();
  }, []);

  const handleSelectChild = async (username) => {
    setSelectedChildUsername(username);
    setLoading(true);
    try {
      const profileRes = await parentApi.getChildProfile(username);
      setChildData(profileRes?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load child profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!linkUsername.trim() || !linkCode.trim()) return;
    setLinkLoading(true);
    setLinkStatus(null);
    try {
      const res = await parentApi.linkStudent(linkUsername.trim(), linkCode.trim());
      setLinkStatus({ success: true, message: res.message || 'Student linked successfully!' });
      setLinkUsername('');
      setLinkCode('');
      setTimeout(() => {
        setShowLinkModal(false);
        setLinkStatus(null);
        fetchChildrenAndProfile(linkUsername.trim());
      }, 1500);
    } catch (err) {
      setLinkStatus({ success: false, message: err.message || 'Linking failed. Verify code and username.' });
    } finally {
      setLinkLoading(false);
    }
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px 80px' }}>
      <EduNovaHeroBanner
        title="Authorized Child Profile"
        subtitle="Verified real-time learner information and curriculum status for your linked student(s)."
        badge="Parent Companion"
        badgeIcon={ShieldCheck}
        primaryAction={{
          label: 'View Performance Analytics',
          onClick: () => navigate('/parent/performance'),
          icon: GraduationCap,
        }}
        secondaryAction={{
          label: 'Link Another Student',
          onClick: () => setShowLinkModal(true),
          icon: Plus,
        }}
      />

      {/* Child Switcher (If multiple children linked) */}
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
                transition: 'all 0.2s ease',
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
          <h3>Loading verified child profile...</h3>
          <p style={{ color: 'var(--text-muted)' }}>Querying PostgreSQL student records...</p>
        </div>
      ) : error ? (
        <div style={{ ...cardStyle, marginTop: '24px', borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '12px' }}>
            <AlertCircle size={24} />
            <h3 style={{ margin: 0 }}>Notice</h3>
          </div>
          <p>{error}</p>
          <Button onClick={() => setShowLinkModal(true)} style={{ marginTop: '12px' }}>
            Link Student Account
          </Button>
        </div>
      ) : !childData ? (
        <div style={{ ...cardStyle, marginTop: '24px', textAlign: 'center', padding: '60px' }}>
          <Users size={48} style={{ color: 'var(--accent-primary)', opacity: 0.8, marginBottom: '16px' }} />
          <h3>No Student Linked Yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '8px auto 24px' }}>
            Link your child's student account using their username and active 6-digit link PIN generated in their profile.
          </p>
          <Button onClick={() => setShowLinkModal(true)}>
            Link Your Child Now
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '24px', marginTop: '24px' }}>
          {/* Left Column: Core Student Identity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '26px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '2rem',
                  fontWeight: 800,
                  boxShadow: '0 10px 25px rgba(2, 132, 199, 0.35)',
                }}>
                  {childData.student?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{childData.student?.name}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    @{childData.student?.studentUsername}
                  </span>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: 'rgba(2, 132, 199, 0.12)',
                  color: 'var(--accent-primary, #0284c7)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}>
                  {childData.student?.learnerType || 'School'} Track
                </div>
              </div>

              <div style={{ borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', marginTop: '20px', paddingTop: '16px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Curriculum / Board</span>
                  <strong>{childData.academics?.board || childData.academics?.degree || 'CBSE'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Learning Level</span>
                  <strong>Level {childData.gamification?.level || 1}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Experience</span>
                  <strong>{childData.gamification?.xp || 0} XP</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Active Streak</span>
                  <span style={{ color: '#f59e0b', fontWeight: 800 }}>🔥 {childData.gamification?.streakDays || 0} Days</span>
                </div>
              </div>
            </div>

            {/* Read-Only Notice */}
            <div style={{ ...cardStyle, background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <ShieldCheck size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                  <strong>Authorized Parental View:</strong> You are viewing authorized educational records for your linked student. To edit your parent account details (password, name, notifications), visit <strong style={{ cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={() => navigate('/settings')}>Parent Settings</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Academic & Subject Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Target Goals & Weak Topics */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} color="var(--accent-primary)" />
                Target Learning Focus & Priorities
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ padding: '14px', borderRadius: '16px', background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>STUDENT GOALS</span>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {childData.academics?.goals?.length > 0 ? (
                      childData.academics.goals.map((g, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} color="#10b981" /> {typeof g === 'object' ? g.title || g.label : g}
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Focus on core board syllabus.</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '16px', background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>RECOMMENDED SUPPORT AREAS</span>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {childData.academics?.weakTopics?.length > 0 ? (
                      childData.academics.weakTopics.map((w, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} /> {w}
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No current diagnostic weak areas.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enrolled Subjects & Real-time Progress */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="var(--accent-primary)" />
                Enrolled Subjects & Syllabus Coverage ({childData.subjects?.length || 0})
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {childData.subjects?.length > 0 ? (
                  childData.subjects.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '16px',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{sub.name}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Category: {sub.category} · Target Score: {sub.targetScore || 85}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--accent-primary)' }}>{Math.round(sub.progress || 0)}%</strong>
                        <div style={{
                          height: '6px',
                          width: '100%',
                          background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          marginTop: '4px',
                        }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(0, sub.progress || 0))}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #0284c7, #10b981)',
                            borderRadius: '10px',
                          }} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No enrolled subjects recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Student Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px',
        }}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: '440px', background: isLight ? '#ffffff' : '#0f172a' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800 }}>Link Student Account</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Enter the student's username and the 6-character linking PIN generated from their EduNova student profile.
            </p>

            {linkStatus && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                background: linkStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: linkStatus.success ? '#10b981' : '#ef4444',
                fontWeight: 600,
              }}>
                {linkStatus.message}
              </div>
            )}

            <form onSubmit={handleLinkStudent} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Student Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. prince_student"
                  value={linkUsername}
                  onChange={(e) => setLinkUsername(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Student Link PIN (e.g. ED-9A2F4C)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ED-XXXXXX"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit', letterSpacing: '0.08em', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="outline" onClick={() => setShowLinkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={linkLoading}>
                  {linkLoading ? 'Verifying PIN...' : 'Verify & Link'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentChildProfilePage;
