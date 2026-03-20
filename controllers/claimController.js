const Claim = require('../models/Claim');

// @route   GET api/claims
// @desc    Get all claims for logged-in user
exports.getClaims = async (req, res) => {
    try {
        const claims = await Claim.find({ worker: req.worker.id })
                                  .sort({ date: -1 })
                                  .populate({ path: 'workerPolicy', populate: { path: 'policy' } });
        res.json(claims);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
