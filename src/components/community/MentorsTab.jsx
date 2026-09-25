import React, { useState } from 'react';
import { Award, Star, Calendar, UserCheck, MessageSquare, ArrowRight, UserPlus, Users } from 'lucide-react';
import { Button } from '../common/Button';

export const MentorsTab = () => {
  const [mentors] = useState([]);
  const [studyPartners] = useState([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Mentors Section */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <span className="cyber-badge-cyan" style={{ fontSize: '0.78rem' }}>Verified Expert Mentors</span>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
            Find a Mentor for 1-on-1 Guidance
          </h3>
        </div>

        {mentors.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '42px 24px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-color)',
            boxShadow: 'var(--glass-shadow)'
          }}>
            <Users size={36} color="var(--accent-cyan)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontWeight: 700 }}>No Peer Mentors Registered Yet</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              Senior scholars and verified instructors can register as academic mentors in the platform directory.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {mentors.map((m) => (
              <div
                key={m.id}
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border-color)',
                  padding: '24px',
                  boxShadow: 'var(--glass-shadow)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <img src={m.avatar} alt={m.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }} />
                  <div>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block' }}>{m.name}</strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>{m.role}</span>
                  </div>
                </div>
                <Button style={{ width: '100%' }}>
                  Request Mentorship Session <ArrowRight size={16} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Study Partners AI Matcher */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <span className="cyber-badge-purple" style={{ fontSize: '0.78rem' }}>AI Topic Matchmaker</span>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
            Recommended Study Partners
          </h3>
        </div>

        {studyPartners.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '42px 24px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed rgba(168, 85, 247, 0.3)',
            boxShadow: 'var(--glass-shadow)'
          }}>
            <UserCheck size={36} color="#c084fc" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontWeight: 700 }}>No Matched Study Partners Currently Online</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              Enroll in active subjects on your dashboard to let Sage AI match you with peer scholars studying the same syllabus chapters.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {studyPartners.map((p) => (
              <div key={p.id}>{p.name}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
