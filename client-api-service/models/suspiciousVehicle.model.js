import mongoose from 'mongoose';

// --- Sub-schema for consistent sighting data ---
// This is a cleaner way to group related information for each sighting.
const sightingSchema = new mongoose.Schema({
    vehicle_class: { type: String, required: true },
    imageUrl: { type: String, required: true },
    timestamp: { type: Date, required: true },
    location: { type: String, required: true },
}, { _id: false }); // _id: false prevents MongoDB from creating an _id for sub-documents

const suspiciousVehicleSchema = new mongoose.Schema({
    license_plate: { type: String, required: true, index: true },
    status: { type: String, required: true, enum: ['suspicious', 'confirmed_fraud', 'correct'] },
    similarity_score: { type: Number, required: true },
    
    // We now use the sub-schema for each sighting, which is much more organized.
    sighting1: { type: sightingSchema, required: true },
    sighting2: { type: sightingSchema, required: true },

    // This field tracks if a user has viewed/acknowledged the alert.
    // It defaults to 'false', meaning every new alert is "unread".
    isRead: {
        type: Boolean,
        default: false,
        required: true,
    }
}, { timestamps: true }); // timestamps adds createdAt and updatedAt fields automatically

const SuspiciousVehicle = mongoose.model('SuspiciousVehicle', suspiciousVehicleSchema);

export default SuspiciousVehicle;

