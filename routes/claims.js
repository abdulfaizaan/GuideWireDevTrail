const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, claimController.getClaims);

module.exports = router;
