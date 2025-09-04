import { connectDB} from '../dataBase/connectionDB.js';
const getCollection=await connectDB(); // top-level await is allowed in ES Modules

const clientData=async(req,res)=>{
        console.log("fetch data from db ");
        //send data to client 
        const result = await getCollection.find().toArray();
        res.status(200).json({'data':result});
}


export {clientData};
