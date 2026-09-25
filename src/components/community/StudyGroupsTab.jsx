import React, { useState } from 'react';
import { Users, Calendar, ArrowRight, PlusCircle } from 'lucide-react';
import { Button } from '../common/Button';

export const StudyGroupsTab = () => {
  const [studyGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);

  const toggleJoin = (groupId) => {
    if (joinedGroups.includes(groupId)) {
      setJoinedGroups(joinedGroups.filter((g) => g !== groupId));
    } else {
      setJoinedGroups([...joinedGroups, groupId]);
    }
  };

  return (
    <div>
      {studyGroups.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '56px 24px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-color)',
            boxShadow: 'var(--glass-shadow)'
          }}
        >
          <Users size={42} color="var(--accent-purple)" style={{ margin: '0 auto 14px' }} />
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', margin: '0 0 8px', fontWeight: 800 }}>
            No Active Study Circles Formed Yet
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Form focused revision pods, peer code labs, or exam prep groups with fellow students to study together in live audio/video rooms.
          </p>
          <Button size="sm" variant="purple">
            <PlusCircle size={15} /> Create a Study Circle
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {studyGroups.map((g) => {
            const isJoined = joinedGroups.includes(g.id);
            return (
              <div
                key={g.id}
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 'var(--radius-xl)',
                  border: isJoined ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--glass-shadow)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '2rem' }}>{g.avatar}</span>
                    <span className="cyber-badge-purple" style={{ fontSize: '0.75rem' }}>
                      <Users size={12} /> {g.membersCount || 1} Members
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {g.name}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                    {g.description}
                  </p>

                  {g.nextSession && (
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>NEXT LIVE SESSION</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} /> {g.nextSession}
                      </strong>
                    </div>
                  )}
                </div>

                <Button
                  variant={isJoined ? 'outline' : 'primary'}
                  onClick={() => toggleJoin(g.id)}
                >
                  {isJoined ? 'Joined ✓ (View Group)' : 'Join Study Group'} <ArrowRight size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

