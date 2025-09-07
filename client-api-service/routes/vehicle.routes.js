import express from 'express';
import { getSuspiciousVehicles, markVehicleAsRead, getVehicleHistory, getVehicleAlertById } from '../controllers/vehicle.controller.js';

const router = express.Router();


router.get('/vehicles', getSuspiciousVehicles);

router.patch('/vehicles/:id', markVehicleAsRead);

router.get('/vehicles/history/:plateNumber', getVehicleHistory);

router.get('/vehicles/:id', getVehicleAlertById);

export default router;
