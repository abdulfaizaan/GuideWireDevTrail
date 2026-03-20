const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const authMiddleware = require('../middleware/auth');

router.get('/', policyController.getPolicies);
router.post('/purchase', authMiddleware, policyController.purchasePolicy);
router.get('/active', authMiddleware, policyController.activePolicy);

module.exports = router;
