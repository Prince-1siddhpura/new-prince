import React, { useState } from 'react';
import { FolderGit2, BookOpen, Download, ExternalLink, Code, Sparkles, PlusCircle } from 'lucide-react';
import { Button } from '../common/Button';

export const ProjectsTab = () => {
  const [projects] = useState([]);

  return (
    <div>
      {projects.length === 0 ? (
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
          <FolderGit2 size={42} color="var(--accent-cyan)" style={{ margin: '0 auto 14px' }} />
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', margin: '0 0 8px', fontWeight: 800 }}>
            No Community Projects Published Yet
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Showcase your open-source projects, AI prototypes, or research notebooks to collaborate with peers across the EduNova network.
          </p>
          <Button size="sm">
            <PlusCircle size={15} /> Submit Your Project
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map((proj) => (
            <div
              key={proj.id}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="cyber-badge-cyan" style={{ fontSize: '0.75rem' }}>Project Showcase</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>By {proj.creator}</span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {proj.title}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                  {proj.description}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
                  {(proj.techStack || []).map((t) => (
                    <span key={t} className="cyber-badge" style={{ fontSize: '0.75rem' }}>{t}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button size="sm" style={{ flex: 1 }}>
                  <ExternalLink size={14} /> Live Demo
                </Button>
                <Button size="sm" variant="outline" style={{ flex: 1 }}>
                  <Code size={14} /> Code
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ResourcesTab = () => {
  const [resources] = useState([]);

  return (
    <div>
      {resources.length === 0 ? (
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
          <BookOpen size={42} color="var(--accent-purple)" style={{ margin: '0 auto 14px' }} />
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', margin: '0 0 8px', fontWeight: 800 }}>
            No Shared Study Materials Yet
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Upload formula sheets, exam notes, and mind maps to help your batchmates learn faster.
          </p>
          <Button size="sm" variant="purple">
            <Sparkles size={15} /> Upload Study Resource
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {resources.map((res) => (
            <div
              key={res.id}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <span className="cyber-badge-cyan" style={{ fontSize: '0.75rem' }}>{res.type}</span>
                  <span className="cyber-badge" style={{ fontSize: '0.75rem' }}>{res.subject}</span>
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  {res.title}
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Uploaded by {res.author} • {res.downloadsCount || 0} Downloads
                </span>
              </div>

              <Button size="sm">
                <Download size={14} /> Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

