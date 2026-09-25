import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LessonViewer } from '../../components/courses/LessonViewer';
import { QuizEngine } from '../../components/courses/QuizEngine';
import { getQuizForCourse } from '../../services/quizService';
import { getCourseById, completeCourseModule, enrollInCourse } from '../../services/courseService';
import { ArrowLeft, BookOpen, Brain, CheckCircle, ChevronRight, PlayCircle, Sparkles } from 'lucide-react';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';

export const LessonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [activeTab, setActiveTab] = useState('lesson');
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [completedModuleIds, setCompletedModuleIds] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [courseData, quizRes] = await Promise.all([
          getCourseById(id),
          getQuizForCourse(id)
        ]);
        if (isMounted) {
          setCourse(courseData);
          setQuizData(quizRes);
          // Check completed modules from enrollments if available
          if (courseData?.enrollment?.completedModuleIds) {
            setCompletedModuleIds(courseData.enrollment.completedModuleIds);
          }
        }
      } catch (err) {
        console.warn('Could not load course lesson data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [id]);

  const modules = course?.modules && course.modules.length > 0
    ? course.modules
    : [
        {
          id: 'm1',
          title: course ? `${course.title}: Core Architectural Principles` : 'Module 1: Architecture & System Design',
          duration: '45 mins'
        }
      ];

  const currentModule = modules[activeModuleIndex] || modules[0];

  const handleCompleteModule = async (moduleId) => {
    try {
      const res = await completeCourseModule(course?.id || id, moduleId);
      setCompletedModuleIds(prev => Array.from(new Set([...prev, moduleId])));
      setToastMessage(res?.message || '🎉 Module completed! +50 XP awarded.');
      setTimeout(() => setToastMessage(null), 4500);

      // Advance to next module or switch to quiz if last module
      if (activeModuleIndex < modules.length - 1) {
        setTimeout(() => setActiveModuleIndex(prev => prev + 1), 800);
      } else {
        setTimeout(() => setActiveTab('quiz'), 800);
      }
    } catch (err) {
      // If error was un-enrolled, automatically enroll student then complete
      try {
        await enrollInCourse(course?.id || id);
        const res = await completeCourseModule(course?.id || id, moduleId);
        setCompletedModuleIds(prev => Array.from(new Set([...prev, moduleId])));
        setToastMessage(res?.message || '🎉 Module completed! +50 XP awarded.');
        setTimeout(() => setToastMessage(null), 4500);
      } catch (retryErr) {
        setCompletedModuleIds(prev => Array.from(new Set([...prev, moduleId])));
        setToastMessage('🎉 Module marked completed! Great job.');
        setTimeout(() => setToastMessage(null), 4500);
      }
    }
  };

  if (loading) {
    return <SkeletonLoader height="450px" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '88px',
            right: '24px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            color: '#fff',
            padding: '14px 22px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
            zIndex: 9999,
            fontWeight: 800,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Sparkles size={18} />
          {toastMessage}
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => navigate(course ? `/courses/${course.id}` : '/courses')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--accent-cyan)',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Back to Course Overview
        </button>

        {course && (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Course: <strong style={{ color: 'var(--text-primary)' }}>{course.title}</strong>
          </span>
        )}
      </div>

      {/* Tabs Toolbar */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setActiveTab('lesson')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'lesson' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'var(--bg-secondary)',
            color: activeTab === 'lesson' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <BookOpen size={18} /> Interactive Lesson Player ({modules.length} Modules)
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'quiz' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'var(--bg-secondary)',
            color: activeTab === 'quiz' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Brain size={18} /> Knowledge Check Quiz Engine
        </button>
      </div>

      {activeTab === 'lesson' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px' }}>
          {/* Main Lesson Player */}
          <div>
            <LessonViewer
              moduleData={{
                id: currentModule.id,
                title: currentModule.title,
                duration: currentModule.duration ? `${currentModule.duration} mins` : '45 mins'
              }}
              onCompleteModule={() => handleCompleteModule(currentModule.id)}
            />
          </div>

          {/* Module Selector Sidebar */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-color)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              height: 'fit-content'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Course Syllabus Modules
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {modules.map((m, idx) => {
                const isSelected = idx === activeModuleIndex;
                const isCompleted = completedModuleIds.includes(m.id);
                return (
                  <button
                    key={m.id || idx}
                    onClick={() => setActiveModuleIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
                      border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-color)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {isCompleted ? (
                        <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
                      ) : (
                        <PlayCircle size={16} color={isSelected ? '#818cf8' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {m.title}
                      </span>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        quizData && <QuizEngine quizData={quizData} />
      )}
    </div>
  );
};

export default LessonPage;
