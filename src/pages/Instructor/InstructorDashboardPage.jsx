import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Award,
  Layers,
  Edit,
  Trash2,
  X,
  FileText,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { instructorApi } from '../../lib/apiClient';
import { EduNovaHeroBanner } from '../../components/common/EduNovaHeroBanner';
import { Button } from '../../components/common/Button';

export const InstructorDashboardPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme() || {};
  const isLight = theme === 'light';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'courses' | 'students' | 'assessments'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);

  // Course modal & form state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'Computer Science',
    difficulty: 'BEGINNER',
    thumbnail: '',
    modules: [{ title: '', duration: 30 }],
  });
  const [formBusy, setFormBusy] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, coursesRes, studentsRes, assessmentsRes] = await Promise.all([
        instructorApi.getDashboard(),
        instructorApi.getCourses(),
        instructorApi.getStudents(),
        instructorApi.getAssessments(),
      ]);

      setDashboardData(dashRes.data || null);
      setCourses(coursesRes.data || []);
      setStudents(studentsRes.data || []);
      setAssessments(assessmentsRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load instructor workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const notify = (message, type = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleOpenNewCourseModal = () => {
    setEditingCourseId(null);
    setCourseForm({
      title: '',
      description: '',
      category: 'Computer Science',
      difficulty: 'BEGINNER',
      thumbnail: '',
      modules: [{ title: 'Module 1: Introduction & Fundamentals', duration: 30 }],
    });
    setIsCourseModalOpen(true);
  };

  const handleEditCourse = (c) => {
    setEditingCourseId(c.id);
    setCourseForm({
      title: c.title,
      description: c.description || '',
      category: c.category || 'General',
      difficulty: c.difficulty || 'BEGINNER',
      thumbnail: c.thumbnail || '',
      modules: c.modules && c.modules.length > 0 ? c.modules : [{ title: '', duration: 30 }],
    });
    setIsCourseModalOpen(true);
  };

  const handleAddModuleField = () => {
    setCourseForm((prev) => ({
      ...prev,
      modules: [...prev.modules, { title: `Module ${prev.modules.length + 1}: `, duration: 30 }],
    }));
  };

  const handleRemoveModuleField = (index) => {
    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index),
    }));
  };

  const handleModuleChange = (index, field, value) => {
    setCourseForm((prev) => {
      const updated = [...prev.modules];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, modules: updated };
    });
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.title.trim()) return;
    setFormBusy(true);
    try {
      if (editingCourseId) {
        await instructorApi.updateCourse(editingCourseId, courseForm);
        notify('Course updated successfully!');
      } else {
        await instructorApi.createCourse(courseForm);
        notify('Course created and assigned to your instructor studio!');
      }
      setIsCourseModalOpen(false);
      fetchAllData();
    } catch (err) {
      notify(err.message || 'Failed to save course', 'error');
    } finally {
      setFormBusy(false);
    }
  };

  const handleTogglePublish = async (course) => {
    try {
      await instructorApi.updateCourse(course.id, { isPublished: !course.isPublished });
      notify(`Course ${!course.isPublished ? 'published to catalog' : 'moved to draft'}!`);
      fetchAllData();
    } catch (err) {
      notify(err.message || 'Failed to update publication status', 'error');
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

  const tabs = [
    { key: 'overview', label: 'Dashboard Overview', icon: Layers },
    { key: 'courses', label: `Assigned Courses (${courses.length})`, icon: BookOpen },
    { key: 'students', label: `Enrolled Students (${students.length})`, icon: Users },
    { key: 'assessments', label: `Assessments & Quizzes (${assessments.length})`, icon: FileText },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 20px 80px' }}>
      <EduNovaHeroBanner
        title="Instructor Workspace & Studio"
        subtitle={`Welcome back, ${user?.name || 'Instructor'}. Manage your assigned curriculum, author course content, and monitor student learning progress.`}
        badge="Instructor Portal"
        badgeIcon={ShieldCheck}
        primaryAction={{
          label: 'Create New Course',
          onClick: handleOpenNewCourseModal,
          icon: Plus,
        }}
        secondaryAction={{
          label: 'Refresh Workspace',
          onClick: fetchAllData,
          icon: RefreshCw,
        }}
      />

      {notice && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          marginTop: '20px',
          background: notice.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: notice.type === 'error' ? '#ef4444' : '#10b981',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {notice.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {notice.message}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                borderRadius: '16px',
                border: 'none',
                background: isActive
                  ? 'var(--accent-primary, #0284c7)'
                  : (isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.08)'),
                color: isActive ? '#ffffff' : 'inherit',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ ...cardStyle, marginTop: '24px', textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={36} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
          <h3>Loading Instructor Workspace...</h3>
        </div>
      ) : error ? (
        <div style={{ ...cardStyle, marginTop: '24px', borderColor: '#ef4444' }}>
          <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '10px' }} />
          <h3>Notice</h3>
          <p>{error}</p>
          <Button onClick={fetchAllData} style={{ marginTop: '12px' }}>Retry</Button>
        </div>
      ) : (
        <div style={{ marginTop: '24px' }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Stat Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ ...cardStyle, padding: '20px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Courses</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-primary)' }}>
                    {dashboardData?.metrics?.totalCourses || 0}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {dashboardData?.metrics?.publishedCourses || 0} published live
                  </span>
                </div>

                <div style={{ ...cardStyle, padding: '20px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Active Students</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#10b981' }}>
                    {dashboardData?.metrics?.totalStudents || 0}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across your course cohorts</span>
                </div>

                <div style={{ ...cardStyle, padding: '20px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Course Modules</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#8b5cf6' }}>
                    {dashboardData?.metrics?.totalModules || 0}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authored lessons & materials</span>
                </div>

                <div style={{ ...cardStyle, padding: '20px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Completion Rate</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#f59e0b' }}>
                    {dashboardData?.metrics?.avgCompletionRate || 0}%
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cohort completion progress</span>
                </div>
              </div>

              {/* Recent Courses List */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Recent Authored Courses</h3>
                  <Button variant="outline" onClick={() => setActiveTab('courses')}>View All Courses</Button>
                </div>

                {courses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No courses assigned yet. Create your first course to begin instruction.</p>
                    <Button onClick={handleOpenNewCourseModal} style={{ marginTop: '12px' }}>Create Course</Button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {courses.slice(0, 5).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: '16px 20px',
                          borderRadius: '16px',
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '1.05rem' }}>{c.title}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {c.category} · {c.difficulty} · {c.modules?.length || 0} modules · {c.enrollmentsCount || 0} enrolled
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: c.isPublished ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: c.isPublished ? '#10b981' : '#f59e0b',
                          }}>
                            {c.isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                          <Button size="small" variant="outline" onClick={() => handleEditCourse(c)}>
                            <Edit size={14} /> Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNED COURSES */}
          {activeTab === 'courses' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Assigned Course Management</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                    Author course content, organize syllabus modules, and toggle publication status.
                  </p>
                </div>
                <Button onClick={handleOpenNewCourseModal}>
                  <Plus size={16} /> New Course
                </Button>
              </div>

              {courses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <BookOpen size={48} style={{ color: 'var(--accent-primary)', opacity: 0.8, marginBottom: '16px' }} />
                  <h3>No Courses Created Yet</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Start by creating a course module for your students.</p>
                  <Button onClick={handleOpenNewCourseModal} style={{ marginTop: '16px' }}>Create Course</Button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {courses.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '18px 20px',
                        borderRadius: '18px',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '20px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <strong style={{ fontSize: '1.1rem' }}>{c.title}</strong>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: c.isPublished ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: c.isPublished ? '#10b981' : '#f59e0b',
                          }}>
                            {c.isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 8px 0' }}>
                          {c.description || 'No course description provided.'}
                        </p>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <span><strong>{c.category}</strong></span>
                          <span>Level: <strong>{c.difficulty}</strong></span>
                          <span>Modules: <strong>{c.modules?.length || 0}</strong></span>
                          <span>Enrolled: <strong>{c.enrollmentsCount || 0} students</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Button
                          variant="outline"
                          size="small"
                          onClick={() => handleTogglePublish(c)}
                        >
                          {c.isPublished ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleEditCourse(c)}
                        >
                          <Edit size={14} /> Edit Course
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENROLLED STUDENTS */}
          {activeTab === 'students' && (
            <div style={cardStyle}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Student Progress & Cohort Analytics</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Track completion percentages and verified module accomplishments across enrolled learners.
                </p>
              </div>

              {students.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <Users size={48} style={{ color: 'var(--accent-primary)', opacity: 0.8, marginBottom: '16px' }} />
                  <h3>No Student Enrollments Recorded Yet</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Once students enroll in your published courses, their progress will appear here.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-muted)' }}>Student</th>
                        <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-muted)' }}>Course</th>
                        <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-muted)' }}>Track</th>
                        <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-muted)' }}>Progress</th>
                        <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-muted)' }}>Enrolled Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((e) => (
                        <tr key={e.enrollmentId} style={{ borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <strong>{e.student?.name || 'Student'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              @{e.student?.studentUsername || e.student?.email}
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <strong>{e.course?.title}</strong>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', fontSize: '0.75rem', fontWeight: 700 }}>
                              {e.student?.learnerType || 'School'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <strong style={{ color: 'var(--accent-primary)' }}>{Math.round(e.progress || 0)}%</strong>
                            <div style={{ height: '5px', width: '100px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginTop: '3px' }}>
                              <div style={{ width: `${e.progress || 0}%`, height: '100%', background: '#10b981' }} />
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                            {new Date(e.enrolledAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ASSESSMENTS */}
          {activeTab === 'assessments' && (
            <div style={cardStyle}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Subject Assessments & Quizzes</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Assessments associated with your curriculum subjects and student testing records.
                </p>
              </div>

              {assessments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <FileText size={48} style={{ color: 'var(--accent-primary)', opacity: 0.8, marginBottom: '16px' }} />
                  <h3>No Assessments Created Yet</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Quizzes created under your curriculum subjects will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {assessments.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '16px',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{a.title}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Subject: {a.subjectName} {a.topicName ? `· Topic: ${a.topicName}` : ''} · Difficulty: {a.difficulty}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                        <div>Questions: <strong>{a.questionCount}</strong></div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Attempts: {a.attemptsCount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Course Edit/Create Modal */}
      {isCourseModalOpen && (
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
          <div style={{
            ...cardStyle,
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: isLight ? '#ffffff' : '#0f172a',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                {editingCourseId ? 'Edit Assigned Course' : 'Create New Course'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCourseModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Course Title
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Master Full-Stack Web Development"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <input
                    required
                    type="text"
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Difficulty Level
                  </label>
                  <select
                    value={courseForm.difficulty}
                    onChange={(e) => setCourseForm({ ...courseForm, difficulty: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Course Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Comprehensive syllabus overview and learning outcomes..."
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit' }}
                />
              </div>

              {/* Modules Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800 }}>Course Modules & Lessons</label>
                  <button
                    type="button"
                    onClick={handleAddModuleField}
                    style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Module
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  {courseForm.modules.map((m, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 36px', gap: '8px', alignItems: 'center' }}>
                      <input
                        required
                        placeholder={`Module ${idx + 1} Title`}
                        value={m.title}
                        onChange={(e) => handleModuleChange(idx, 'title', e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        min="5"
                        placeholder="Mins"
                        value={m.duration}
                        onChange={(e) => handleModuleChange(idx, 'duration', e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: '0.85rem' }}
                      />
                      {courseForm.modules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveModuleField(idx)}
                          style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <Button type="button" variant="outline" onClick={() => setIsCourseModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formBusy}>
                  {formBusy ? 'Saving...' : editingCourseId ? 'Save Changes' : 'Create Course'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorDashboardPage;
