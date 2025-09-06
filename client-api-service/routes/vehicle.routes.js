import express from 'express';
import { getSuspiciousVehicles, markVehicleAsRead, getVehicleHistory } from '../controllers/vehicle.controller.js';

const router = express.Router();

// --- OPTIMIZED: API with Pagination ---
// Example Usage: GET /api/vehicles?page=2&limit=20
router.get('/vehicles', getSuspiciousVehicles);

router.patch('/vehicles/:id', markVehicleAsRead);

router.get('/vehicles/history/:plateNumber', getVehicleHistory);

export default router;
