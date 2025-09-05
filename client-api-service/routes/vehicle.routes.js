import express from 'express';
import { getSuspiciousVehicles } from '../controllers/vehicle.controller.js';

const router = express.Router();

// --- OPTIMIZED: API with Pagination ---
// Example Usage: GET /api/vehicles?page=2&limit=20
router.get('/vehicles', getSuspiciousVehicles);

export default router;
