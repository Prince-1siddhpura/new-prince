import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Sparkles,
  Play,
  Calendar as CalIcon,
  LayoutGrid,
  List,
  TrendingUp,
  Search,
  Filter,
  Trash2,
  Edit3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  MessageSquare
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EduNovaHeroBanner } from '../../components/common/EduNovaHeroBanner';
import { taskService } from '../../services/taskService';

import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { TaskKanbanBoard } from '../../components/tasks/TaskKanbanBoard';
import { TaskCalendarView } from '../../components/tasks/TaskCalendarView';
import { TaskTimelineView } from '../../components/tasks/TaskTimelineView';
import { FocusModeModal } from '../../components/tasks/FocusModeModal';
import { PlanMyDayModal } from '../../components/tasks/PlanMyDayModal';
import { TaskInsightsView } from '../../components/tasks/TaskInsightsView';

export const MyTasksPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme() || {};
  const isLight = theme === 'light';

  // Tasks & Goals state
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, todayTasks: 0, upcoming: 0, overdue: 0, completed: 0, important: 0 });
  const [goals, setGoals] = useState([]);
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(false);

  // View mode
  const [activeView, setActiveView] = useState('LIST'); // 'LIST' | 'KANBAN' | 'CALENDAR' | 'TIMELINE' | 'INSIGHTS'

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [activeFocusTask, setActiveFocusTask] = useState(null);
  const [isPlanDayModalOpen, setIsPlanDayModalOpen] = useState(false);

  useEffect(() => {
    loadTaskData();
  }, [searchQuery, selectedSubject, selectedType, selectedPriority, selectedStatus]);

  const loadTaskData = async () => {
    setLoading(true);
    try {
      const filters = {
        search: searchQuery,
        subject: selectedSubject,
        type: selectedType,
        priority: selectedPriority,
        status: selectedStatus
      };

      const [taskList, summaryData] = await Promise.all([
        taskService.getTasks(filters),
        taskService.getSummary()
      ]);

      setTasks(taskList || []);
      setSummary(summaryData || { total: 0, todayTasks: 0, upcoming: 0, overdue: 0, completed: 0, important: 0 });
      setGoals(taskService.getAllGoals());
      setInsights(taskService.getInsights(taskList || []));
    } catch (err) {
      console.error('[MyTasksPage] Failed to load tasks from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (editTaskData) {
        await taskService.updateTask(editTaskData.id, taskData);
      } else {
        await taskService.createTask(taskData);
      }
      setEditTaskData(null);
      await loadTaskData();
    } catch (err) {
      console.error('[MyTasksPage] Save task failed:', err);
    }
  };

  const handleEditTask = (task) => {
    setEditTaskData(task);
    setIsCreateModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await taskService.deleteTask(taskId);
      await loadTaskData();
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    await taskService.updateTask(taskId, { status: newStatus });
    await loadTaskData();
  };

  const handleToggleSubtask = async (taskId, subtaskId) => {
    await taskService.toggleSubtask(taskId, subtaskId);
    await loadTaskData();
  };

  const handleStartFocus = (task) => {
    setActiveFocusTask(task);
    setIsFocusModalOpen(true);
  };

  const handleAcceptPlan = async (proposedSchedule) => {
    try {
      await Promise.all(
        proposedSchedule.map(slot =>
          taskService.createTask({
            title: slot.title,
            subject: slot.subject,
            type: slot.type,
            priority: slot.priority,
            dueDate: new Date().toISOString().split('T')[0],
            estimatedDuration: 45
          })
        )
      );
      await loadTaskData();
    } catch (err) {
      console.error('[MyTasksPage] Accept plan failed:', err);
    }
  };

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '24px 20px 80px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* 1. HERO GLASS BANNER */}
      <div style={{ marginBottom: '28px' }}>
        <EduNovaHeroBanner
          badge="✦ EduNova Smart Task Command Center"
          title="My Tasks"
          subtitle="Plan it. Focus on it. Complete it. Your AI-driven education & productivity command hub."
          actions={
            <>
              <button
                onClick={() => { setEditTaskData(null); setIsCreateModalOpen(true); }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 25px rgba(56, 189, 248, 0.4)'
                }}
              >
                <Plus size={18} /> New Task
              </button>

              <button
                onClick={() => setIsPlanDayModalOpen(true)}
                style={{
                  padding: '12px 22px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3))',
                  color: isLight ? '#0f172a' : '#ffffff',
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backdropFilter: 'blur(16px)'
                }}
              >
                <Sparkles size={18} color="#c084fc" /> Plan My Day
              </button>
            </>
          }
          stats={[
            { label: summary.todayTasks || summary.today, subtext: "Today's Tasks", icon: CheckSquare, color: '#38bdf8', iconBg: 'rgba(56, 189, 248, 0.2)' },
            { label: summary.upcoming, subtext: 'Upcoming', icon: CalIcon, color: '#fbbf24', iconBg: 'rgba(251, 191, 36, 0.2)' },
            { label: summary.overdue, subtext: 'Overdue', icon: AlertTriangle, color: '#ef4444', iconBg: 'rgba(239, 68, 68, 0.2)' },
            { label: summary.completed, subtext: 'Completed', icon: CheckCircle2, color: '#10b981', iconBg: 'rgba(16, 185, 129, 0.2)' }
          ]}
        />
      </div>

      {/* 2. VIEW SWITCHER & SEARCH BAR */}
      <div style={{
        background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(28px)',
        border: isLight ? '1.5px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.18)',
        padding: '16px 20px',
        borderRadius: '24px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.06)',
          border: isLight ? '1px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.12)',
          padding: '8px 16px',
          borderRadius: '9999px',
          flex: 1,
          minWidth: '240px'
        }}>
          <Search size={18} color={isLight ? '#0284c7' : '#38bdf8'} />
          <input
            type="text"
            placeholder="Search tasks by title, subject, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: '0.9rem',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        {/* View Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '9999px' }}>
          {[
            { id: 'LIST', label: 'List View', icon: List },
            { id: 'KANBAN', label: 'Kanban', icon: LayoutGrid },
            { id: 'CALENDAR', label: 'Calendar', icon: CalIcon },
            { id: 'TIMELINE', label: 'Timeline', icon: TrendingUp },
            { id: 'INSIGHTS', label: 'Insights', icon: Sparkles }
          ].map(v => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  background: isActive ? (isLight ? '#ffffff' : '#38bdf8') : 'transparent',
                  color: isActive ? (isLight ? '#0284c7' : '#0f172a') : (isLight ? '#64748b' : '#94a3b8'),
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Icon size={15} /> {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2.5 REAL-TIME FILTERS & CONTROL BAR */}
      <div style={{
        background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(28px)',
        border: isLight ? '1.5px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '20px',
        padding: '14px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isLight ? '#64748b' : '#94a3b8', marginRight: '4px' }}>
            Status:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'TODAY', label: "Today's" },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'COMPLETED', label: 'Completed' }
          ].map(st => {
            const isActive = selectedStatus === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  background: isActive ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'),
                  color: isActive ? '#ffffff' : (isLight ? '#475569' : '#cbd5e1'),
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {st.label}
              </button>
            );
          })}
        </div>

        {/* Priority & Subject Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Priority */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '12px',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
              border: isLight ? '1px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">✦ Urgent</option>
            <option value="HIGH">✦ High</option>
            <option value="MEDIUM">✦ Medium</option>
            <option value="LOW">✦ Low</option>
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '12px',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
              border: isLight ? '1px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="">All Subjects</option>
            <option value="Physics (Science)">Physics (Science)</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Database Systems">Database Systems</option>
            <option value="Computer Science">Computer Science</option>
            <option value="General">General</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '12px',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)',
              border: isLight ? '1px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Types</option>
            <option value="Study">Study</option>
            <option value="Assignment">Assignment</option>
            <option value="Practice">Practice</option>
            <option value="Revision">Revision</option>
            <option value="Project">Project</option>
          </select>

          {/* Reset Filters Button */}
          {(selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || selectedSubject !== '' || selectedType !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus('ALL');
                setSelectedPriority('ALL');
                setSelectedSubject('');
                setSelectedType('ALL');
                setSearchQuery('');
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. MAIN CONTENT VIEW */}
      {activeView === 'KANBAN' && (
        <TaskKanbanBoard
          tasks={tasks}
          onUpdateStatus={handleUpdateStatus}
          onDeleteTask={handleDeleteTask}
          onStartFocus={handleStartFocus}
          onEditTask={handleEditTask}
        />
      )}

      {activeView === 'CALENDAR' && (
        <TaskCalendarView tasks={tasks} onSelectTask={handleStartFocus} />
      )}

      {activeView === 'TIMELINE' && (
        <TaskTimelineView goals={goals} />
      )}

      {activeView === 'INSIGHTS' && (
        <TaskInsightsView insights={insights} />
      )}

      {activeView === 'LIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tasks.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.65)',
              borderRadius: '24px',
              border: isLight ? '1.5px solid rgba(200, 220, 240, 0.8)' : '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <CheckSquare size={48} color="#38bdf8" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>Your learning workspace is clear!</h3>
              <p style={{ color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.9rem' }}>Create your first task or let Sage AI plan your day.</p>
            </div>
          ) : (
            tasks.map(t => {
              const completedSub = (t.subtasks || []).filter(s => s.completed).length;
              const totalSub = (t.subtasks || []).length;
              const progressPct = totalSub > 0 ? Math.round((completedSub / totalSub) * 100) : (t.status === 'COMPLETED' ? 100 : 0);

              return (
                <div
                  key={t.id}
                  style={{
                    background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(28px)',
                    border: isLight ? '1.5px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '20px',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}
                >
                  {/* Checkbox & Details */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '280px' }}>
                    <button
                      onClick={() => handleUpdateStatus(t.id, t.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', paddingTop: '2px' }}
                    >
                      {t.status === 'COMPLETED' ? <CheckCircle2 size={24} color="#10b981" /> : <Circle size={24} color="#94a3b8" />}
                    </button>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 800 }}>
                          {t.subject}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: t.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(251, 191, 36, 0.18)',
                          color: t.priority === 'URGENT' ? '#ef4444' : '#fbbf24',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          ✦ {t.priority}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          +{t.xpReward || 50} XP
                        </span>
                      </div>

                      <h4 style={{
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: isLight ? '#0f172a' : '#ffffff',
                        margin: '0 0 4px 0',
                        textDecoration: t.status === 'COMPLETED' ? 'line-through' : 'none'
                      }}>
                        {t.title}
                      </h4>

                      {t.description && (
                        <p style={{ fontSize: '0.85rem', color: isLight ? '#475569' : '#cbd5e1', margin: '0 0 8px 0' }}>
                          {t.description}
                        </p>
                      )}

                      {/* Subtasks inline with progress range bar */}
                      {totalSub > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', maxWidth: '300px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                            <span>Subtasks ({completedSub}/{totalSub})</span>
                            <span style={{ fontWeight: 800 }}>{progressPct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '5px', borderRadius: '4px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#10b981' : '#38bdf8', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Due Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right', marginRight: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#94a3b8', display: 'block' }}>Due Date</span>
                      <strong style={{ fontSize: '0.88rem', color: isLight ? '#0f172a' : '#ffffff' }}>{t.dueDate || 'No Date'}</strong>
                    </div>

                    <button
                      onClick={() => handleStartFocus(t)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '9999px',
                        background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                      }}
                    >
                      <Play size={14} fill="#ffffff" /> Focus
                    </button>

                    <button
                      onClick={() => handleEditTask(t)}
                      title="Edit Task"
                      style={{
                        padding: '9px 14px',
                        borderRadius: '9999px',
                        background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                        border: isLight ? '1px solid rgba(200, 220, 240, 0.9)' : '1px solid rgba(255, 255, 255, 0.15)',
                        color: isLight ? '#0284c7' : '#38bdf8',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>

                    <button
                      onClick={() => navigate('/ai-assistant')}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '9999px',
                        background: isLight ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#c084fc',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Ask Sage
                    </button>

                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      title="Delete Task"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODALS */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSaveTask}
        initialData={editTaskData}
      />

      <FocusModeModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        task={activeFocusTask}
        onCompleteTask={(id) => handleUpdateStatus(id, 'COMPLETED')}
      />

      <PlanMyDayModal
        isOpen={isPlanDayModalOpen}
        onClose={() => setIsPlanDayModalOpen(false)}
        onAcceptPlan={handleAcceptPlan}
      />
    </div>
  );
};
export default MyTasksPage;
