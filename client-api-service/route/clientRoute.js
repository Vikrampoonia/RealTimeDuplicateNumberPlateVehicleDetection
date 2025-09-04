import express from 'express'
import {clientData} from '../controller/clientController.js';

const router= express.Router();

router.get("/data",clientData);



export default router;


