import express from 'express'
import cors from 'cors'
import http from 'http';
import { setupSocket } from './controller/socketController.js';
import './controller/cameraController.js'
import clientRoute from './route/clientRoute.js';

//mongodb+srv://pooniavikram348:<vehicleDetectionList>@cluster0.eoe4fjs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

const app=express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);

setupSocket(server);



//app.use("/camera",cameraRoute);
app.use("/client",clientRoute);





const PORT=4002;

app.listen(PORT,()=>{
    console.log(`server listen at http://localhost:${PORT}`);
})



