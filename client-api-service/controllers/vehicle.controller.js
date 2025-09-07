import SuspiciousVehicle from '../models/suspiciousVehicle.model.js';
import DetectionHistory from '../models/detectionHistory.model.js';
import { redisClient } from '../config/redis.js';

// We will cache API responses for 30 seconds to improve performance.
const CACHE_EXPIRATION_SECONDS = 30; 

export const getSuspiciousVehicles = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, isRead, search, sort, location } = req.query;

    const filter = {};

    if (location) {
        // Match either sighting1.location or sighting2.location
        filter.$or = [
            { "sighting1.location": location },
            { "sighting2.location": location }
        ];
    }

    if (status) filter.status = status;
    if (isRead !== undefined && isRead !== "") filter.isRead = isRead === "true";
    if (search) filter.license_plate = { $regex: search, $options: "i" }; // case-insensitive search

    const sortOption = sort === "date_asc" ? { vehicle_time1: 1 } : { vehicle_time1: -1 };

    try {
        const totalDocuments = await SuspiciousVehicle.countDocuments(filter);
        const vehicles = await SuspiciousVehicle.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const result = {
            success: true,
            data: vehicles,
            pagination: {
                totalDocuments,
                totalPages: Math.ceil(totalDocuments / limit),
                currentPage: page,
                limit: limit
            }
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching suspicious vehicles:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


// --- NEW FUNCTION to handle marking an alert as read ---
export const markVehicleAsRead = async (req, res) => {
    // Get the unique ID of the alert from the URL parameters.

    //console.log("Request is there with id:", req.params.id);
    const { id } = req.params;

    try {
        // Find the alert by its ID and update its 'isRead' field to true.
        const updatedVehicle = await SuspiciousVehicle.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true } 
        );

        if (!updatedVehicle) {
            return res.status(404).json({ success: false, message: "Vehicle alert not found." });
        }

        // --- CACHE INVALIDATION ---
        console.log('CACHE INVALIDATION: Data updated, clearing vehicle list cache.');
        const keys = await redisClient.keys('vehicles:*');
        if (keys.length > 0) {
            await redisClient.del(keys);
        }

        res.status(200).json({ success: true, data: updatedVehicle });

    } catch (error) {
        console.error("Error updating vehicle status:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
               

export const getVehicleHistory = async (req, res) => {
    console.log("Fetching history for plate:", req.params.plateNumber+" length:", req.params.plateNumber.length);
    const { plateNumber } = req.params;
     console.log("🔍 API received plateNumber:", JSON.stringify(plateNumber));

    try {

        // The TTL index on the database (created by the validation-service) automatically handles the "10-day" limit.
        const history = await DetectionHistory.find({
            license_plate: { $regex: `^${plateNumber.trim()}$`, $options: "i" }
        }).sort({ timestamp: -1 });


            console.log("History fetched:", history);

        if (!history || history.length === 0) {
            return res.status(404).json({ success: false, message: "No history found for this vehicle." });
        }

        res.status(200).json({ success: true, data: history });

    } catch (error) {
        console.error(`Error fetching history for plate ${plateNumber}:`, error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


export const getVehicleAlertById = async (req, res) => {
    const { id } = req.params;
    console.log("Fetching vehicle alert with id:", id);
    try {
        const vehicle = await SuspiciousVehicle.findById(id);
        if (!vehicle) {
            return res.status(404).json({ success: false, message: "Vehicle alert not found." });
        }
        res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
        console.error(`Error fetching vehicle alert with id ${id}:`, error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
