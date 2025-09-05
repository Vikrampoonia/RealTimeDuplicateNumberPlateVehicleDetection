import mongoose from 'mongoose';

// --- Sub-schema for consistent sighting data ---
const sightingSchema = new mongoose.Schema({
    vehicle_class: { type: String, required: true },
    imageUrl: { type: String, required: true },
    timestamp: { type: Date, required: true },
    location: { type: String, required: true },
}, { _id: false });


const suspiciousVehicleSchema = new mongoose.Schema({
    license_plate: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: ['suspicious', 'confirmed_fraud'] },
    similarity_score: { type: Number, required: true },
    sighting1: { type: sightingSchema, required: true },
    sighting2: { type: sightingSchema, required: true },
    createdAt: { type: Date, default: Date.now }
});

const SuspiciousVehicle = mongoose.model('SuspiciousVehicle', suspiciousVehicleSchema);

export default SuspiciousVehicle;
