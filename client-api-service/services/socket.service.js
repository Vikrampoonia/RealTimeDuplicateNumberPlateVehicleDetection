import { Server } from 'socket.io';

let io;
// This map is a simple in-memory solution. For a real production system,
// you would use Redis to store this mapping to allow for multiple server instances.
const onlineUsers = new Map();

export const setupSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: '*', // In production, restrict this to your frontend's domain
            methods: ['GET', 'POST']
        }
    });

    io.on("connection", (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        socket.on("register_location", (location) => {
            console.log(`📍 Client ${socket.id} registered for location: ${location}`);
            // Join a "room" based on location. This is more efficient.
            socket.join(location);
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const sendNotification = (data) => {
    if (!io) {
        console.error("Socket.IO not initialized!");
        return;
    }

    const location1 = data.sighting1.location;
    const location2 = data.sighting2.location;

    console.log(`📢 Sending notification for plate ${data.license_plate} to locations: ${location1}, ${location2}`);
    // Emit the event to all clients in the specific location "rooms"
    io.to(location1).emit("suspicious_vehicle_alert", data);
    
    // Avoid sending duplicate notifications if locations are the same
    if (location1 !== location2) {
        io.to(location2).emit("suspicious_vehicle_alert", data);
    }
};
