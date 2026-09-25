import apiClient, { exchangeApi } from '../lib/apiClient';

export const getKnowledgeConstellation = async () => {
  try {
    const res = await apiClient('/skills');
    return res.data || [];
  } catch (err) {
    return [];
  }
};

export const getSkillDnaMetrics = async () => {
  try {
    const res = await apiClient('/skills/dna');
    return res.data || {};
  } catch (err) {
    return {};
  }
};

export const getSkillExchanges = async (filterCategory = 'All') => {
  try {
    const marketplaceRes = await exchangeApi.getMarketplace();
    if (marketplaceRes?.data && marketplaceRes.data.length > 0) {
      return marketplaceRes.data;
    }
    const res = await exchangeApi.getExchanges({ category: filterCategory !== 'All' ? filterCategory : undefined });
    return res.data || [];
  } catch (err) {
    return [];
  }
};


export const calculateSkillMatchCompatibility = (userTeaches, partnerTeaches, userWants, partnerWants) => {
  // Simple deterministic scoring matrix simulation
  let matchScore = 75;
  if (userTeaches && partnerWants && userTeaches.toLowerCase().includes(partnerWants.toLowerCase())) {
    matchScore += 12;
  }
  if (partnerTeaches && userWants && partnerTeaches.toLowerCase().includes(userWants.toLowerCase())) {
    matchScore += 12;
  }
  return Math.min(matchScore, 98);
};
