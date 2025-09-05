import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME,
        });
        console.log("✅ MongoDB connected successfully!");
    } catch (error) {
        console.error(`❌ MongoDB connection failed: ${error.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

export default connectDB;
