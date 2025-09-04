import { Server } from 'socket.io';

//map two things email =socket.id
let onlineUser=new Map();
let io;

export const setupSocket = (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });


    // Socket.IO
    io.on("connection", (socket) => {
        console.log("Successfully connected: " + socket.id);
        // User connection and room joining
        socket.on("Add", ({ from }) => {
            console.log("User connected: " + from);
            onlineUser.set(from, socket.id);
        });

        socket.on("disconnect", () => {
            onlineUser.delete(socket.id);
            console.log(" Client disconnected:", socket.id);
          });

    });
}

export function sendNotification(data)
{
    //get two locations
    let location1=data["location1"];
    let location2=data["location2"];

    //send notification to this location1
    if(onlineUser.get(location1))
    {
        io.to(onlineUser.get(location1)).emit("notification", { data });
    }

    //send notification to this location2
    if(onlineUser.get(location2))
    {
        io.to(onlineUser.get(location2)).emit("notification", { data });
    }

}
    
    
    