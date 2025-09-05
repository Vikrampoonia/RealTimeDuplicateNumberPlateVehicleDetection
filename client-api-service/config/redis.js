import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient;

// This function establishes the connection to our Redis container.
const connectRedis = async () => {
    if (redisClient) {
        // If we are already connected, do nothing.
        return;
    }
    try {
        // Create a new Redis client using the URL from our .env file.
        redisClient = createClient({
            url: process.env.REDIS_URL
        });

        // Set up an error listener to catch any connection problems.
        redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));

        // Attempt to connect.
        await redisClient.connect();
        console.log('✅ Redis connected successfully!');
    } catch (error) {
        // If the connection fails, log the error and exit the application.
        console.error('❌ Redis connection failed:', error);
        process.exit(1);
    }
};

// We export the connected client so other files can use it,
// and we export the function so our main server file can call it.
export { redisClient, connectRedis };

