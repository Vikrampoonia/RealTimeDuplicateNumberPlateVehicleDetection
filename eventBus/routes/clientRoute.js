import express from 'express'
import {clientData} from '../controllers/client.js';


const router = express.Router();

router.post('/event',clientData);


export default router;
