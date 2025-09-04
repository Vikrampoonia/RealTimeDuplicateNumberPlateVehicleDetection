import express from 'express'
import {cameraData} from '../controllers/camera.js';


const router = express.Router();

router.post('/event',cameraData);


export default router;
