import { subjectService } from './subjectService';

const STORAGE_KEY_PROJECTS = 'edunova_college_projects';

const DEFAULT_PROJECTS = [
  { id: 'proj_101', name: 'Interactive 3D Visualizer Lab', subject: 'Web Graphics', technology: 'React + WebGL', team: 'Student Portfolio Project', deadline: '2026-10-15', progress: 50, status: 'Development' },
  { id: 'proj_102', name: 'Distributed OS CPU Scheduler Engine', subject: 'Operating Systems', technology: 'C++ / POSIX', team: 'Independent Capstone', deadline: '2026-09-30', progress: 75, status: 'Testing' }
];

export const getSemesterData = () => {
  try {
    const enrolled = subjectService.getEnrolledSubjects() || [];
    if (enrolled.length > 0) {
      const subjects = enrolled.map(s => ({
        name: s.name,
        credits: s.credits || 4,
        progress: s.progress || s.userProgress || 0,
        grade: (s.progress || s.userProgress || 0) >= 90 ? 'O' : (s.progress || s.userProgress || 0) >= 75 ? 'A+' : (s.progress || s.userProgress || 0) >= 60 ? 'A' : 'In Progress'
      }));
      const totalCredits = subjects.reduce((acc, s) => acc + (s.credits || 4), 0);
      return {
        semesterNumber: 5,
        degree: 'B.Tech Computer Science & Engineering',
        activeSubjectsCount: subjects.length,
        totalCredits,
        completedModulesCount: enrolled.reduce((acc, s) => acc + (s.completedChapters?.length || 0), 0),
        assignmentsDueCount: 1,
        projectsInProgressCount: 2,
        internalExamDaysRemaining: 12,
        subjects
      };
    }
  } catch (e) {
    console.warn('Could not load dynamic enrolled subjects for semester:', e);
  }

  return {
    semesterNumber: 5,
    degree: 'B.Tech Computer Science & Engineering',
    activeSubjectsCount: 4,
    totalCredits: 16,
    completedModulesCount: 0,
    assignmentsDueCount: 0,
    projectsInProgressCount: 1,
    internalExamDaysRemaining: 12,
    subjects: [
      { name: 'Data Structures & Algorithms', credits: 4, progress: 0, grade: 'Enrolled' },
      { name: 'Operating Systems', credits: 4, progress: 0, grade: 'Enrolled' },
      { name: 'Database Management Systems', credits: 4, progress: 0, grade: 'Enrolled' },
      { name: 'Web Development Studio', credits: 4, progress: 0, grade: 'Enrolled' }
    ]
  };
};

export const getCollegeProjects = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not load projects', e);
  }
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(DEFAULT_PROJECTS));
  return DEFAULT_PROJECTS;
};

export const saveCollegeProjects = (projects) => {
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  window.dispatchEvent(new CustomEvent('edunova:projects_updated'));
  return projects;
};

export const getCareerReadiness = () => {
  return {
    targetRole: 'Full Stack & Systems Engineer',
    overallScore: 82,
    evidenceCriteria: [
      { category: 'Data Structures & Algorithms', level: 'Advanced', evidence: 'Verified via 42 Quiz Attempts & BST Lab' },
      { category: 'Frontend Systems (React/CSS)', level: 'Expert', evidence: '3 Projects Built & Peer Review Score 4.9/5' },
      { category: 'Database & SQL Optimization', level: 'Intermediate', evidence: 'DBMS Course 88% Complete' },
      { category: 'Backend REST API & Node.js', level: 'Intermediate', evidence: 'Express.js Module Completed' }
    ],
    skillsToDevelop: ['Docker & Containerization', 'Redis Caching & System Architecture'],
    recommendedProjects: ['Build a Real-time Redis Message Queue', 'Deploy Microservice API to Cloud']
  };
};

export default {
  getSemesterData,
  getCollegeProjects,
  saveCollegeProjects,
  getCareerReadiness
};
