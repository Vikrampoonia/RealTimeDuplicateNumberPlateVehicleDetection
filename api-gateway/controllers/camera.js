import axios from 'axios'


const cameraData=async(req,res)=>{
    
    //flask and nodejs communicate through kafka broker 

    try {
        const response = axios.post('http://localhost:4001/cameraData',req.body);
        return res.status(200).json({ message: 'Use kafka' });


    } 
    catch (error) 
    {
        console.error('Error fetching from Flask:', error.message);
    }


}

export {cameraData} ;



