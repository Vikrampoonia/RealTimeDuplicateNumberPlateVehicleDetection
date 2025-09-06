import SuspiciousVehicle from '../models/suspiciousVehicle.model.js';
import DetectionHistory from '../models/detectionHistory.model.js';
import { redisClient } from '../config/redis.js';

// We will cache API responses for 30 seconds to improve performance.
const CACHE_EXPIRATION_SECONDS = 30; 

export const getSuspiciousVehicles = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Create a unique key for this specific page of data.
    const cacheKey = `vehicles:page:${page}:limit:${limit}`;

    try {
        // --- Step 1: Check Redis Cache First ---
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
            console.log(`CACHE HIT for key: ${cacheKey}`);
            const result = JSON.parse(cachedData);
            // If data is in the cache, return it instantly.
            return res.status(200).json(result);
        }

        // --- Step 2: If Cache Miss, Fetch from MongoDB ---
        console.log(`CACHE MISS for key: ${cacheKey}. Fetching from DB.`);
        
        const totalDocuments = await SuspiciousVehicle.countDocuments();
        const vehicles = await SuspiciousVehicle.find()
            .sort({ vehicle_time1: -1 }) // Sort by most recent
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

        // --- Step 3: Store the Fresh Data in the Cache ---
        // Save the result to Redis with a 30-second expiration time.
        await redisClient.set(cacheKey, JSON.stringify(result), {
            EX: CACHE_EXPIRATION_SECONDS,
        });

        // Return the data fetched from the database.
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
    console.log("Fetching history for plate:", req.params.plateNumber);
    const { plateNumber } = req.params;

    try {

        // The TTL index on the database (created by the validation-service) automatically handles the "10-day" limit.
        const history = await DetectionHistory.find({ license_plate: plateNumber })
            .sort({ timestamp: -1 }); // Sort by most recent sighting first

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

