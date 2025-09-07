import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

// --- PROXY ROUTING ---
// Any request to the gateway that starts with '/api'
app.use('/api', createProxyMiddleware({
    target: process.env.CLIENT_API_SERVICE_URL,
    changeOrigin: true, // Recommended for virtual hosted sites
}));


// --- START SERVER ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 API Gateway is running on http://localhost:${PORT}`);
    console.log(`➡️  Forwarding /api requests to ${process.env.CLIENT_API_SERVICE_URL}`);
});
