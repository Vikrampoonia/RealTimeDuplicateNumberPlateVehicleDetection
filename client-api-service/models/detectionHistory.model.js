import mongoose from 'mongoose';

const detectionHistorySchema = new mongoose.Schema({
    license_plate: { type: String, required: true, index: true },
    vehicle_class: { type: String, required: true },
    imageUrl: { type: String, required: true },
    location: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
},{ collection: 'detection_history' });

const DetectionHistory = mongoose.model('DetectionHistory', detectionHistorySchema);

export default DetectionHistory;
