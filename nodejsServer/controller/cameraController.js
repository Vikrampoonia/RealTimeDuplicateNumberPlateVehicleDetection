// consumer.js

import { Kafka } from 'kafkajs';
import { connectDB} from '../dataBase/connectionDB.js';
import { sendNotification } from './socketController.js';




// Message Handling Function
const cameraData = async (data) => {
  const getCollection=await connectDB(); // top-level await
  try {
    const jsonData = JSON.parse(data.value.toString());
    const result = await getCollection.insertOne(jsonData);
    //send notification to user 
    sendNotification(jsonData);
    console.log('📥 Data inserted:', result.insertedId);
  } catch (err) {
    console.error('❌ Error inserting data:', err);
  }
};

// Kafka Setup
const kafka = new Kafka({
  clientId: 'my-node-consumer',
  brokers: ['localhost:9092'],
  fetchMaxBytes: 52428800,           
  maxBytesPerPartition: 52428800 
});

const consumer = kafka.consumer({ groupId: 'vehicle-group' });

const runConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'vehicleTestingTopic', fromBeginning: true });
  console.log('🔁 Listening for messages...');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`📩 Received: ${message.value}`);
      await cameraData(message); // insert to MongoDB
    },
  });
};

runConsumer().catch(console.error);
