const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');

// @route   POST api/auth/register
exports.register = async (req, res) => {
    const { name, email, password, location } = req.body;

    try {
        let worker = await Worker.findOne({ email });
        if (worker) {
            return res.status(400).json({ msg: 'Worker already exists' });
        }

        // Simple risk calculation logic
        const riskScore = location.toLowerCase().includes('flood') ? 80 : 30;

        worker = new Worker({
            name,
            email,
            password,
            location,
            riskScore
        });

        const salt = await bcrypt.genSalt(10);
        worker.password = await bcrypt.hash(password, salt);

        await worker.save();

        const payload = {
            worker: { id: worker.id }
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, worker: { id: worker.id, name: worker.name, email: worker.email, riskScore: worker.riskScore } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   POST api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        let worker = await Worker.findOne({ email });
        if (!worker) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, worker.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = { worker: { id: worker.id } };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, worker: { id: worker.id, name: worker.name, email: worker.email, riskScore: worker.riskScore } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   GET api/auth/me
exports.getMe = async (req, res) => {
    try {
        const worker = await Worker.findById(req.worker.id).select('-password');
        res.json(worker);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
