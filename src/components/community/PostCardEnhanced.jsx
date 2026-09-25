import React, { useState, useEffect } from 'react';
import {
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Share2,
  CheckCircle2,
  Bot,
  Eye,
  ShieldCheck,
  Zap,
  Sparkles,
  BookOpen,
  Send,
  Trash2,
  Pin,
  Check
} from 'lucide-react';
import { Button } from '../common/Button';
import { useLearning } from '../../context/LearningContext';
import { useAuth } from '../../context/AuthContext';
import { communityApi } from '../../lib/apiClient';

export const PostCardEnhanced = ({ post, onTurnIntoQuiz, onTurnIntoNotes, onDeletePost }) => {
  const { earnXp } = useLearning();
  const { user } = useAuth();

  const [upvotes, setUpvotes] = useState(post.upvotes || 0);
  const [hasUpvoted, setHasUpvoted] = useState(post.hasUpvoted || false);
  const [bookmarked, setBookmarked] = useState(post.bookmarked || false);
  const [showSageDrawer, setShowSageDrawer] = useState(false);
  const [isPinned, setIsPinned] = useState(post.isPinned || false);

  // Replies & Discussion state
  const [isRepliesOpen, setIsRepliesOpen] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [repliesCount, setRepliesCount] = useState(post.repliesCount || 0);
  const [acceptedAnswer, setAcceptedAnswer] = useState(post.acceptedAnswer || null);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const isAuthor = user?.id === post.author?.id;
  const isModerator = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  // Toggle Upvote / Like via backend
  const handleUpvote = async () => {
    // Optimistic toggle
    const prevUpvoted = hasUpvoted;
    const prevCount = upvotes;
    setHasUpvoted(!prevUpvoted);
    setUpvotes(prevUpvoted ? prevCount - 1 : prevCount + 1);

    try {
      const res = await communityApi.toggleLike(post.id);
      if (res && res.data) {
        setHasUpvoted(res.data.upvoted);
        setUpvotes(res.data.upvotesCount);
        if (res.data.upvoted) {
          earnXp(10, 'Community Contribution Upvote', 'Community');
        }
      }
    } catch (err) {
      // Rollback on failure
      setHasUpvoted(prevUpvoted);
      setUpvotes(prevCount);
    }
  };

  // Toggle Replies section and load if not loaded
  const handleToggleReplies = async () => {
    const nextState = !isRepliesOpen;
    setIsRepliesOpen(nextState);

    if (nextState && comments.length === 0) {
      setIsLoadingComments(true);
      try {
        const res = await communityApi.getPost(post.id);
        if (res && res.data) {
          setComments(res.data.comments || []);
          setAcceptedAnswer(res.data.acceptedAnswer || null);
          setRepliesCount(res.data.repliesCount || 0);
        }
      } catch (err) {
        console.error('[Load Comments Error]', err);
      } finally {
        setIsLoadingComments(false);
      }
    }
  };

  // Submit comment to backend
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      const res = await communityApi.addComment(post.id, commentInput.trim());
      if (res && res.data) {
        setComments((prev) => [...prev, res.data]);
        setRepliesCount((prev) => prev + 1);
        setCommentInput('');
        earnXp(15, 'Community Discussion Reply', 'Community');
      }
    } catch (err) {
      console.error('[Add Comment Error]', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Mark answer as accepted
  const handleAcceptAnswer = async (commentId) => {
    try {
      const res = await communityApi.acceptAnswer(post.id, commentId);
      if (res && res.data) {
        setAcceptedAnswer(res.data.acceptedAnswer);
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            isAccepted: c.id === commentId,
          }))
        );
      }
    } catch (err) {
      console.error('[Accept Answer Error]', err);
    }
  };

  // Delete post
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this discussion?')) return;
    try {
      await communityApi.deletePost(post.id);
      if (onDeletePost) onDeletePost(post.id);
    } catch (err) {
      console.error('[Delete Post Error]', err);
    }
  };

  // Toggle Pin (Moderator)
  const handleTogglePin = async () => {
    try {
      const res = await communityApi.togglePin(post.id);
      if (res && res.data) {
        setIsPinned(res.data.isPinned);
      }
    } catch (err) {
      console.error('[Pin Error]', err);
    }
  };

  const formattedTime = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Recently';

  return (
    <div
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-xl)',
        border: isPinned ? '1px solid #06b6d4' : '1px solid var(--border-color)',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: isPinned ? '0 0 20px rgba(6, 182, 212, 0.2)' : 'var(--glass-shadow)',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {/* Pinned Badge if pinned */}
      {isPinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#06b6d4', fontSize: '0.78rem', fontWeight: 800, marginBottom: '10px' }}>
          <Pin size={14} /> PINNED DISCUSSION
        </div>
      )}

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={post.author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Scholar'}
            alt={post.author?.name}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-glow)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{post.author?.name || 'Peer Scholar'}</strong>
              {post.author?.verified && <ShieldCheck size={16} color="#06b6d4" />}
              <span className="cyber-badge" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                {post.author?.badge || 'Scholar'}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {post.subject} • {post.topic || 'General'} • {formattedTime}
            </span>
          </div>
        </div>

        {/* Quality, Difficulty & Moderation Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {post.qualityStatus && (
            <span className="cyber-badge-cyan" style={{ fontSize: '0.75rem' }}>
              ✨ {post.qualityStatus}
            </span>
          )}
          <span className="cyber-badge-purple" style={{ fontSize: '0.75rem' }}>
            {post.difficulty || 'Intermediate'}
          </span>

          {isModerator && (
            <button
              onClick={handleTogglePin}
              title={isPinned ? 'Unpin Discussion' : 'Pin Discussion'}
              style={{ background: 'transparent', border: 'none', color: isPinned ? '#06b6d4' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <Pin size={16} />
            </button>
          )}

          {(isAuthor || isModerator) && (
            <button
              onClick={handleDelete}
              title="Delete Discussion"
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Post Title & Content */}
      <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px', lineHeight: 1.45 }}>
        {post.title}
      </h3>
      <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
        {post.content}
      </p>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {post.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Verified / Accepted Answer Highlight */}
      {acceptedAnswer && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> ACCEPTED VERIFIED ANSWER
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>By {acceptedAnswer.author}</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
            "{acceptedAnswer.content}"
          </p>
        </div>
      )}

      {/* Action Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleUpvote}
            style={{
              background: hasUpvoted ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-secondary)',
              border: hasUpvoted ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
              color: hasUpvoted ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ThumbsUp size={15} /> {upvotes}
          </button>

          <button
            onClick={handleToggleReplies}
            style={{
              background: isRepliesOpen ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: isRepliesOpen ? '1px solid #6366f1' : 'none',
              color: isRepliesOpen ? '#818cf8' : 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <MessageSquare size={15} /> {repliesCount} Replies
          </button>

          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={15} /> {post.views || 1} Views
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowSageDrawer(!showSageDrawer)}
            style={{
              background: showSageDrawer ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-secondary)',
              border: '1px solid var(--accent-secondary)',
              color: '#c084fc',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Bot size={15} /> Ask Sage AI
          </button>

          <button
            onClick={() => setBookmarked(!bookmarked)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: bookmarked ? '#f59e0b' : 'var(--text-muted)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            <Bookmark size={16} fill={bookmarked ? '#f59e0b' : 'none'} />
          </button>
        </div>
      </div>

      {/* Sage AI Action Drawer */}
      {showSageDrawer && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--border-glow)', background: 'rgba(168, 85, 247, 0.08)', padding: '16px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Bot size={18} color="#c084fc" />
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Sage AI Discussion Actions</strong>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button size="sm" variant="outline" onClick={() => onTurnIntoQuiz(post)}>
              <Sparkles size={14} /> Turn into Quiz
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTurnIntoNotes(post)}>
              <BookOpen size={14} /> Create Notes
            </Button>
          </div>
        </div>
      )}

      {/* Expandable Real Comments Section */}
      {isRepliesOpen && (
        <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Peer Answers & Discussion ({comments.length})
          </h4>

          {isLoadingComments ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading answers from database...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
              No answers posted yet. Be the first to share your knowledge!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    background: comment.isAccepted ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-secondary)',
                    border: comment.isAccepted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={comment.author?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Scholar'}
                        alt={comment.author?.name}
                        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      />
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {comment.author?.name || 'Scholar'}
                      </strong>
                      {comment.isAccepted && (
                        <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Accepted Solution
                        </span>
                      )}
                    </div>

                    {(isAuthor || isModerator) && !comment.isAccepted && (
                      <button
                        onClick={() => handleAcceptAnswer(comment.id)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Accept as Solution
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add Reply Form */}
          <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Contribute your answer or insight to this discussion..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              disabled={isSubmittingReply}
              style={{
                flex: 1,
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '0.86rem'
              }}
            />
            <button
              type="submit"
              disabled={isSubmittingReply || !commentInput.trim()}
              className="btn-primary"
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Send size={14} /> Reply
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
