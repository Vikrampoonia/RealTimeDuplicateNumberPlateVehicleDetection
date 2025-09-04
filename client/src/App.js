import React, { useEffect, useState } from "react";
import { io } from "socket.io-client"; 
import axios from "axios";
import './App.css';


const SuspiciousVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const clientLocation = "Jaipur";

  useEffect(() => {

    socket.emit("Add", {clientLocation});

    axios.post("http://localhost:4000/client/event")
      .then(res => {
        console.log(res.data.data.data);
        setVehicles(res.data.data.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

      socket.on("notification", (newData) => {
        console.log("🚨 Real-time detection received:", newData);
        setVehicles(prev => [newData, ...prev]); // Add new data at the top
      });
  
      // Cleanup
      return () => {
        socket.disconnect();
      };


  }, []);

  return (
    <div className="pageSection">
      <div>Hello Vikram</div>

      {(loading || vehicles.length==0 ) ? (
        <div>Loading data...</div>
      ) : (
        vehicles.map((vehicle, index) => (
          <div className="vehicleSection" key={index}>
            <div className="VehicleNumber">
              <div>{vehicle.license_plate}</div>
              <div>8003980678</div> {/* Replaced with contact number */}
              <div>Suspecious </div>
            </div>
            <div className="vehicleInfoSection">
              <div className="vehicleInfo">
                <div>Category: {vehicle.vehicle_class1}</div>
                <div>Location: {vehicle.vehicle_location1}</div>
                <div>Time: {vehicle.vehicle_time1}</div>
                <div>
                    <img src={`data:image/jpeg;base64,${vehicle.vehicle_image1}`} className="image" alt="first image" />
                </div>
              </div>
              <div className="vehicleInfo">
                <div>Category: {vehicle.vehicle_class2}</div>
                <div>Location: {vehicle.vehicle_location2}</div>
                <div>Time: {vehicle.vehicle_time2}</div>
                <div>
                      <img src={`data:image/jpeg;base64,${vehicle.vehicle_image2}`} className="image" alt="second image" />
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SuspiciousVehicles;
