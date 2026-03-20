const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['Basic', 'Standard', 'Pro']
    },
    weeklyPremium: {
        type: Number,
        required: true
    },
    coverageAmount: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    features: [String]
});

module.exports = mongoose.model('Policy', PolicySchema);
