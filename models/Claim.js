const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    workerPolicy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkerPolicy',
        required: true
    },
    eventType: {
        type: String,
        enum: ['Heavy Rain', 'Extreme Pollution', 'Heatwave'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    date: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String, // Where the event occurred/triggered
        required: true
    },
    fraudFlag: {
        type: Boolean,
        default: false
    },
    fraudReason: {
        type: String
    }
});

module.exports = mongoose.model('Claim', ClaimSchema);
