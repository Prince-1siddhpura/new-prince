import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Send, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { exchangeApi } from '../../lib/apiClient';

export const ExchangeModal = ({ isOpen, onClose, exchange }) => {
  const [messageText, setMessageText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!exchange) return null;

  const targetName = exchange.user?.name || exchange.name || 'Peer Scholar';
  const receiverId = exchange.userId || exchange.user?.id;
  const offeredSkill = exchange.teaches || exchange.skillOffered || 'General Technical Guidance';
  const desiredSkill = exchange.wantsToLearn || exchange.skillWanted || 'Collaborative Coding';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (receiverId) {
        await exchangeApi.createExchangeRequest({
          receiverId,
          skillOffered: desiredSkill,
          skillWanted: offeredSkill,
        });
      }
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1600);
    } catch (err) {
      setError(err.message || 'Unable to submit exchange proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Request Skill Swap with ${targetName}`}>
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '30px 10px' }}>
          <CheckCircle size={56} color="#10b981" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Exchange Request Transmitted!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
            {targetName} will be notified via the EduNova Skill Exchange hub.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.88rem' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>They Teach:</span> <strong>{offeredSkill}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>They Seek:</span> <strong>{desiredSkill}</strong>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Introductory Proposal Message:
            </label>
            <textarea
              rows={4}
              placeholder={`Hi ${targetName}, I would love to connect and share knowledge on ${offeredSkill} in exchange for ${desiredSkill}!`}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
              required
            />
          </div>

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Submitting Proposal...' : 'Send Exchange Offer'}
          </Button>
        </form>
      )}
    </Modal>
  );
};
