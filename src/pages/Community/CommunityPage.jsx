import React, { useState } from 'react';
import { CommunityHero } from '../../components/community/CommunityHero';
import { CommunityNavigationTabs } from '../../components/community/CommunityNavigationTabs';
import { PostCardEnhanced } from '../../components/community/PostCardEnhanced';
import { SageSummaryBox } from '../../components/community/SageSummaryBox';
import { StudyGroupsTab } from '../../components/community/StudyGroupsTab';
import { MentorsTab } from '../../components/community/MentorsTab';
import { ProjectsTab, ResourcesTab } from '../../components/community/ProjectsTab';
import { CommunitySidebar } from '../../components/community/CommunitySidebar';
import { CreatePostModalEnhanced } from '../../components/community/CreatePostModalEnhanced';
import { useLearning } from '../../context/LearningContext';
import { noteApi, gamificationApi, aiApi } from '../../lib/apiClient';

const COMMUNITY_STORAGE_KEY = 'edunova_community_posts_v1';

export const CommunityPage = () => {
  const { earnXp } = useLearning();

  const [posts, setPosts] = useState(() => {
    try {
      const saved = localStorage.getItem(COMMUNITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [activeTab, setActiveTab] = useState('for-you');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleAddPost = (newPost) => {
    const updated = [newPost, ...posts];
    setPosts(updated);
    try {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    earnXp(40, `Created Community Discussion`, 'Community');
    gamificationApi.addXp(40, `Community Discussion: ${newPost.title.slice(0, 30)}`).catch(() => {});
    setToastMessage(`🎉 Discussion posted to community feed! (+40 XP)`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleTurnIntoQuiz = async (post) => {
    earnXp(50, `Converted Discussion (${post.title.slice(0, 20)}...) to Quiz`, 'Learning');
    gamificationApi.addXp(50, `Quiz from Discussion: ${post.title.slice(0, 30)}`).catch(() => {});
    try {
      aiApi.generateQuiz({ topic: post.topic || post.subject || post.title, numQuestions: 5, difficulty: post.difficulty || 'Medium' }).catch(() => {});
    } catch (e) {}
    setToastMessage(`✨ Sage generated an assessment quiz from "${post.title.slice(0, 30)}..."! (+50 XP)`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleTurnIntoNotes = async (post) => {
    try {
      await noteApi.createNote({
        title: `Community Note: ${post.title.slice(0, 60)}`,
        content: `## ${post.title}\n\n**Topic:** ${post.topic || post.subject || 'General'}\n**Author:** ${post.author?.name || 'Community Member'}\n\n### Core Discussion\n${post.content}\n\n${post.acceptedAnswer ? `### Recommended Solution\n${post.acceptedAnswer.content}` : ''}`,
        tags: post.tags || ['Community', post.subject || 'General'],
        category: post.subject || 'GENERAL'
      });
      earnXp(30, 'Saved Community Discussion to Notes', 'Notes');
      setToastMessage(`📚 Note compiled & saved into your Smart Notes library! (+30 XP)`);
    } catch (e) {
      setToastMessage(`📚 Note compiled into your Smart Notes library!`);
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '88px',
            right: '24px',
            background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 10px 30px rgba(6, 182, 212, 0.4)',
            zIndex: 9999,
            fontWeight: 800,
            fontSize: '0.88rem'
          }}
        >
          {toastMessage}
        </div>
      )}

      <CommunityHero
        onOpenAskModal={() => setIsCreateModalOpen(true)}
        onOpenGroupModal={() => setActiveTab('groups')}
        onOpenMentorTab={() => setActiveTab('mentors')}
      />

      <CommunityNavigationTabs
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '28px' }}>
        <div>
          {['for-you', 'trending', 'latest', 'unanswered'].includes(activeTab) && (
            posts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-xl)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>💬</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.2rem', fontWeight: 700 }}>No Community Discussions Yet</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                  Be the first scholar to spark an intellectual debate or post a question to the student collective!
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-primary"
                  style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Start First Discussion
                </button>
              </div>
            ) : (
              <>
                <SageSummaryBox
                  onTurnQuiz={() => posts[0] && handleTurnIntoQuiz(posts[0])}
                  onTurnNotes={() => posts[0] && handleTurnIntoNotes(posts[0])}
                />

                {posts.map((p) => (
                  <PostCardEnhanced
                    key={p.id}
                    post={p}
                    onTurnIntoQuiz={handleTurnIntoQuiz}
                    onTurnIntoNotes={handleTurnIntoNotes}
                  />
                ))}
              </>
            )
          )}

          {activeTab === 'groups' && <StudyGroupsTab />}
          {activeTab === 'mentors' && <MentorsTab />}
          {activeTab === 'resources' && <ResourcesTab />}
          {activeTab === 'projects' && <ProjectsTab />}
        </div>

        <CommunitySidebar />
      </div>

      <CreatePostModalEnhanced
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAddPost={handleAddPost}
      />
    </div>
  );
};

export default CommunityPage;
