import SuspiciousVehicle from '../models/suspiciousVehicle.model.js';
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