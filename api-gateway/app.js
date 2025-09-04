import express from 'express'
import cors from 'cors'
import flaskRoute from './routes/flaskRoute.js'
import clientRoute from './routes/clientRoute.js'


const app=express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));


app.get("/",async(req,res)=>{
    res.send("Server is running successfully");
})

app.use('/camera',flaskRoute);
app.use('/client',clientRoute);


const PORT=4000;
app.listen(PORT,()=>{
    console.log(`server listen on http://localhost:${PORT}`);
})