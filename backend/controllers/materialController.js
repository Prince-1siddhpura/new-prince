const prisma = require('../config/db');

/**
 * GET /api/materials
 * Get learning materials with subject, topic, and type filters
 */
const getMaterials = async (req, res, next) => {
  try {
    const { subjectId, topicId, type } = req.query;

    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (type && type !== 'All') where.type = type;

    const materials = await prisma.learningMaterial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, name: true, role: true } },
      },
    });

    return res.json({
      success: true,
      data: materials,
      count: materials.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/materials
 * Upload/create learning material
 */
const createMaterial = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, subjectId, topicId, type = 'Document', fileUrl, tags = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Material title is required' });
    }

    const material = await prisma.learningMaterial.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        type,
        fileUrl: fileUrl || null,
        uploadedById: userId,
        tags: Array.isArray(tags) ? tags : [],
      },
    });

    return res.status(201).json({
      success: true,
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/materials/:id
 */
const deleteMaterial = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const material = await prisma.learningMaterial.findUnique({ where: { id } });
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });
    if (material.uploadedById !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this material' });
    }

    await prisma.learningMaterial.delete({ where: { id } });
    return res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMaterials,
  createMaterial,
  deleteMaterial,
};
