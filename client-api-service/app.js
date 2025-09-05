import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import { setupSocket } from './services/socket.service.js';
import runConsumer from './services/kafka.consumer.js';
import vehicleRoutes from './routes/vehicle.routes.js';

// --- SETUP ---
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// --- INITIALIZATION ---
// 1. Connect to MongoDB
connectDB();

// 2. Connect to Redis
connectRedis();

// 3. Setup Socket.IO Server
setupSocket(server);

// 4. Start the Kafka Consumer to listen for alerts
runConsumer();


// --- API ROUTES ---
// Mount the API routes
app.use('/api', vehicleRoutes);


// --- START SERVER ---
const PORT = process.env.PORT || 4002;
server.listen(PORT, () => {
    console.log(`🚀 Client API Service is running on http://localhost:${PORT}`);
});
