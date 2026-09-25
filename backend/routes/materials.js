const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getMaterials, createMaterial, deleteMaterial } = require('../controllers/materialController');

router.get('/', getMaterials);
router.post('/', requireAuth, createMaterial);
router.delete('/:id', requireAuth, deleteMaterial);

module.exports = router;
