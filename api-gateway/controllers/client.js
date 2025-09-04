import axios from 'axios'


const clientData=async(req,res)=>{
   //change this part also
    try {
        //fetch data from nodejs server
        console.log("data send to nodejs server for client");
        const response = await axios.get('http://localhost:4002/client/data');
        res.status(200).json({
            data:response.data,
            success:true
        })

    } 
    catch (error) 
    {
        console.error('Error fetching from Flask:', error.message);
    }

}

export {clientData} ;



