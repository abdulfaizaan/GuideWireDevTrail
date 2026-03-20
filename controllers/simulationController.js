const Worker = require('../models/Worker');
const WorkerPolicy = require('../models/WorkerPolicy');
const Claim = require('../models/Claim');
const Policy = require('../models/Policy');

// @route   POST api/simulate/trigger
// @desc    Simulate parametric trigger (e.g. Heavy Rain in Location X) -> Auto generate claims
exports.triggerEvent = async (req, res) => {
    const { eventType, location, severity } = req.body; // severity could be mm of rain or AQI

    try {
        // Find workers in the affected location
        const workersInLocation = await Worker.find({ 
            location: { $regex: new RegExp(`^${location}$`, 'i') } 
        });

        const workerIds = workersInLocation.map(w => w._id);

        // Find active policies for these workers
        const activePolicies = await WorkerPolicy.find({
            worker: { $in: workerIds },
            status: 'Active'
        }).populate('policy');

        const newClaims = [];

        for (let wp of activePolicies) {
            // Very simple payout logic based on severity or fixed coverage
            // Assuming the simple case: if event triggers, full coverage amount is paid
            let amount = wp.policy.coverageAmount;

            let fraudFlag = false;
            let fraudReason = '';

            // Check if a claim was already generated today for this worker
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const existingClaim = await Claim.findOne({
                worker: wp.worker,
                eventType,
                date: { $gte: startOfDay }
            });

            if (existingClaim) {
                fraudFlag = true;
                fraudReason = 'Duplicate claim detected for the same event on the same day';
            }

            const claim = new Claim({
                worker: wp.worker,
                workerPolicy: wp._id,
                eventType,
                amount,
                location,
                status: fraudFlag ? 'Rejected' : 'Approved',
                fraudFlag,
                fraudReason
            });

            await claim.save();
            newClaims.push(claim);
        }

        res.json({
            msg: `Triggered ${eventType} in ${location}. Generated ${newClaims.length} claims.`,
            claims: newClaims
        });
        
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   GET api/simulate/analytics
// @desc    Admin analytics endpoint (payout simulation overview)
exports.getAnalytics = async (req, res) => {
    try {
        const totalClaims = await Claim.countDocuments();
        const totalApproved = await Claim.countDocuments({ status: 'Approved' });
        
        const approvedClaims = await Claim.find({ status: 'Approved' });
        const totalPayout = approvedClaims.reduce((sum, current) => sum + current.amount, 0);

        const activePoliciesCount = await WorkerPolicy.countDocuments({ status: 'Active' });

        res.json({
            totalClaims,
            totalApproved,
            totalPayout,
            activePoliciesCount
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
