const Policy = require('../models/Policy');
const WorkerPolicy = require('../models/WorkerPolicy');

// @route   GET api/policies
// @desc    Get all available policies
exports.getPolicies = async (req, res) => {
    try {
        let policies = await Policy.find();
        
        // Seed if empty (for prototype)
        if (policies.length === 0) {
            const seed = [
                { name: 'Basic', weeklyPremium: 5, coverageAmount: 100, description: 'Basic rain and heat coverage', features: ['Rain coverage up to 50mm'] },
                { name: 'Standard', weeklyPremium: 10, coverageAmount: 250, description: 'Standard comprehensive coverage', features: ['Rain coverage up to 100mm', 'Extreme heat'] },
                { name: 'Pro', weeklyPremium: 20, coverageAmount: 600, description: 'All-inclusive maximum coverage', features: ['All weather events', 'High pollution coverage'] },
            ];
            policies = await Policy.insertMany(seed);
        }

        res.json(policies);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   POST api/policies/purchase
// @desc    Purchase a policy
exports.purchasePolicy = async (req, res) => {
    try {
        const { policyId } = req.body;
        
        // Disable previous active policies to simplify prototype logic
        await WorkerPolicy.updateMany(
            { worker: req.worker.id, status: 'Active' },
            { $set: { status: 'Expired' } }
        );

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 1 week policy

        const newWorkerPolicy = new WorkerPolicy({
            worker: req.worker.id,
            policy: policyId,
            endDate
        });

        const savedPolicy = await newWorkerPolicy.save();
        res.json(savedPolicy);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   GET api/policies/active
// @desc    Get current active policy for the logged-in worker
exports.activePolicy = async (req, res) => {
    try {
        const activePolicy = await WorkerPolicy.findOne({
            worker: req.worker.id,
            status: 'Active'
        }).populate('policy');
        
        res.json(activePolicy);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
