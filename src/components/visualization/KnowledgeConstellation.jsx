import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph';
import { ConstellationCanvas } from '../knowledge/ConstellationCanvas';
import { SkillDetailsDrawer } from '../knowledge/SkillDetailsDrawer';
import { analyticsApi } from '../../lib/apiClient';

export const KnowledgeConstellation = () => {
  const navigate = useNavigate();
  const {
    zoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleFitToScreen,
    selectedSkillId,
    setSelectedSkillId,
    selectedSkillObj,
    activeDrawerTab,
    setActiveDrawerTab,
    graphData
  } = useKnowledgeGraph();

  const handleAskSage = (skill) => {
    navigate('/ai/assistant', {
      state: { initialPrompt: `Explain ${skill?.name || 'this subject'} and guide me through the key principles step by step.` }
    });
  };

  const handleStartPractice = (skill) => {
    if (skill?.id) {
      navigate(`/subjects/${skill.id}`);
    } else {
      navigate('/quizzes');
    }
  };

  const handleAddToPlanner = async (skill) => {
    try {
      if (skill?.id) {
        await analyticsApi.createStudySession({
          subjectId: skill.id,
          durationMinutes: 45,
          plannedDate: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Study session notice:', e.message);
    }
    navigate('/study-planner');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <ConstellationCanvas
        graphData={graphData}
        selectedSkillId={selectedSkillId}
        onSelectSkill={(id) => { setSelectedSkillId(id); setActiveDrawerTab('overview'); }}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToScreen={handleFitToScreen}
      />

      <SkillDetailsDrawer
        skill={selectedSkillObj}
        isOpen={!!selectedSkillId}
        onClose={() => setSelectedSkillId(null)}
        activeTab={activeDrawerTab}
        onTabChange={setActiveDrawerTab}
        onAskSage={handleAskSage}
        onStartPractice={handleStartPractice}
        onAddToPlanner={handleAddToPlanner}
      />
    </div>
  );
};

export default KnowledgeConstellation;
