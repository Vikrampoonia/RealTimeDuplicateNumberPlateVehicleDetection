import SuspiciousVehicle from '../models/suspiciousVehicle.model.js';

export const getSuspiciousVehicles = async (req, res) => {
    try {
        // --- PAGINATION LOGIC ---
        // Get page and limit from query params, with default values
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        // Fetch a paginated subset of documents
        const vehicles = await SuspiciousVehicle.find()
            .sort({ createdAt: -1 }) // Show the most recent alerts first
            .skip(skip)
            .limit(limit);

        // Get the total number of documents to calculate total pages
        const totalDocuments = await SuspiciousVehicle.countDocuments();
        
        res.status(200).json({
            success: true,
            data: vehicles,
            pagination: {
                totalDocuments,
                totalPages: Math.ceil(totalDocuments / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error("❌ Error fetching suspicious vehicles:", error.message);
        res.status(500).json({ success: false, message: "Server error while fetching data." });
    }
};
