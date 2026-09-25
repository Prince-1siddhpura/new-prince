import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSkillExchanges } from '../../services/skillService';
import { SkillCard } from '../../components/marketplace/SkillCard';
import { SkillMatchWidget } from '../../components/marketplace/SkillMatchWidget';
import { ExchangeModal } from '../../components/marketplace/ExchangeModal';
import { CreateExchangeOfferModal } from '../../components/exchange/CreateExchangeOfferModal';
import { Repeat, Search, Plus, Calendar } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';

export const SkillMarketplacePage = () => {
  const navigate = useNavigate();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    getSkillExchanges().then((data) => {
      setExchanges(data);
      setLoading(false);
    });
  }, []);

  const handlePublishOffer = (newOffer) => {
    const mapped = {
      id: `offer_${Date.now()}`,
      name: 'You (Creator)',
      skillOffered: newOffer.teachSkill,
      skillWanted: newOffer.learnSkill,
      experience: newOffer.experience,
      status: 'PENDING',
      timeAgo: 'Just now'
    };
    setExchanges((prev) => [mapped, ...prev]);
    setIsCreateModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Repeat size={28} color="#06b6d4" /> Peer Skill Barter Marketplace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Exchange knowledge directly with peers without financial boundaries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => navigate('/skills/exchange')}>
            <Calendar size={18} /> Exchange Workspace & Schedule
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} /> Create Skill Swap Offer
          </Button>
        </div>
      </div>

      <SkillMatchWidget />

      <div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Active Skill Swap Listings</h3>
        {loading ? (
          <SkeletonLoader height="240px" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {exchanges.map((ex) => (
              <SkillCard
                key={ex.id}
                exchange={ex}
                onRequestExchange={(item) => setSelectedExchange(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ExchangeModal
        isOpen={!!selectedExchange}
        onClose={() => setSelectedExchange(null)}
        exchange={selectedExchange}
      />

      <CreateExchangeOfferModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPublish={handlePublishOffer}
      />
    </div>
  );
};

