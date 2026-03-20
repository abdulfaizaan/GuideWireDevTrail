const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');

// In a real app, these should be protected by an 'Admin' auth middleware
router.post('/trigger', simulationController.triggerEvent);
router.get('/analytics', simulationController.getAnalytics);

module.exports = router;
