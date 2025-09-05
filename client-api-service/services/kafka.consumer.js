import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import SuspiciousVehicle from '../models/suspiciousVehicle.model.js';
import { sendNotification } from './socket.service.js';

dotenv.config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

const runConsumer = async () => {
    try {
        await consumer.connect();
        await consumer.subscribe({ 
            topic: process.env.KAFKA_SUSPICIOUS_VEHICLES_TOPIC, 
            fromBeginning: true 
        });
        console.log(`🔁 Kafka consumer is listening to topic: "${process.env.KAFKA_SUSPICIOUS_VEHICLES_TOPIC}"`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const alertData = JSON.parse(message.value.toString());
                    console.log(`📩 Consumed suspicious alert for plate: ${alertData.license_plate}`);
                    
                    // 1. Save the validated alert to the database
                    const newAlert = new SuspiciousVehicle(alertData);
                    await newAlert.save();
                    console.log(`💾 Alert for ${alertData.license_plate} saved to MongoDB.`);

                    // 2. Push the real-time notification to connected clients
                    sendNotification(alertData);

                } catch (err) {
                    console.error('❌ Error processing message:', err);
                }
            },
        });
    } catch(error) {
        console.error("❌ Failed to start Kafka consumer:", error);
        process.exit(1);
    }
};

export default runConsumer;
