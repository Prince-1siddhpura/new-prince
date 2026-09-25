// EduNova Material Service for Learning Materials & Uploads

import { materialApi } from '../lib/apiClient';

const STORAGE_KEY = 'edunova_learning_materials';

class MaterialService {
  constructor() {
    this.materials = this.loadMaterials();
    this.fetchFromServer();
  }

  async fetchFromServer(subjectId) {
    try {
      const res = await materialApi.getMaterials(subjectId ? { subjectId } : {});
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        this.materials = res.data;
        this.saveMaterials(this.materials);
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to sync materials from backend:', err.message);
    }
    return this.materials;
  }

  loadMaterials() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading materials from localStorage:', e);
    }
    return [];
  }

  saveMaterials(mats) {
    this.materials = mats;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mats));
    } catch (e) {
      console.error('Error saving materials to localStorage:', e);
    }
    return this.materials;
  }

  getMaterialsBySubject(subjectId, filterType = 'All', topicId = null) {
    let list = this.materials.filter(m => m.subjectId === subjectId);
    
    if (topicId) {
      list = list.filter(m => m.topicId === topicId);
    }

    if (filterType !== 'All') {
      list = list.filter(m => m.type === filterType);
    }

    return list;
  }

  getMaterialById(id) {
    return this.materials.find(m => m.id === id) || this.materials[0];
  }

  uploadMaterial(materialData) {
    const newMaterial = {
      id: `mat_user_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      uploadedBy: materialData.uploadedBy || 'Student User',
      tags: materialData.tags || ['User Upload'],
      ...materialData
    };
    const updated = [newMaterial, ...this.materials];
    this.saveMaterials(updated);

    // Persist to PostgreSQL backend
    materialApi.createMaterial({
      title: newMaterial.title,
      subjectId: newMaterial.subjectId || 'general',
      topicId: newMaterial.topicId || null,
      type: newMaterial.type || 'Document',
      url: newMaterial.url || newMaterial.fileUrl || null,
      description: newMaterial.description || '',
      tags: newMaterial.tags || []
    }).catch(err => {
      console.warn('Failed to persist material to backend:', err.message);
    });

    return newMaterial;
  }

  searchMaterials(subjectId, query) {
    const q = query.toLowerCase().trim();
    if (!q) return this.getMaterialsBySubject(subjectId);

    return this.materials.filter(m => 
      m.subjectId === subjectId &&
      (m.title.toLowerCase().includes(q) ||
       m.description.toLowerCase().includes(q) ||
       (m.tags && m.tags.some(t => t.toLowerCase().includes(q))))
    );
  }
}

export const materialService = new MaterialService();
export default materialService;

