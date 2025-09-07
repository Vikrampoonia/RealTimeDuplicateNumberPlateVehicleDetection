import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL || "http://localhost:4000";

const VehicleDetails = () => {
    const { id } = useParams(); // Use the unique alert ID from the URL
   // console.log("Fetching details for alert ID:", id);
    const [alert, setAlert] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    //const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            //setError(null);
            try {
                // Fetch the specific alert by its ID
                const alertRes = await axios.get(`${API_GATEWAY_URL}/api/vehicles/${id}`);
                setAlert(alertRes.data.data);

                //console.log("Alert Response:", JSON.stringify(alertRes, null, 2));

                // Once we have the alert, use its plate number to fetch the history
                if (alertRes.data.data) {
                    const historyRes = await axios.get(`${API_GATEWAY_URL}/api/vehicles/history/${alertRes.data.data.license_plate}`);
                    //console.log("History Response:", JSON.stringify(historyRes, null, 2));
                    if(historyRes.data.data.length) {
                        setHistory(historyRes.data.data);
                    }
                }
            } catch (err) {
                //setError("Could not load vehicle details.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);
    
    useEffect(() => {
        const updateReadStatus = async () => {
        
            try {
                // update read status
                const alertRes = await axios.patch(`${API_GATEWAY_URL}/api/vehicles/${id}`);
                console.log("Update Read Status Response:", JSON.stringify(alertRes, null, 2));

            } catch (err) {
                //setError("Could not load vehicle details.");
                console.log("Not able to update read status:", err);
            }
        };
        updateReadStatus();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    //if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
    if (!alert) return <div className="p-8 text-center">Alert not found.</div>;

    //console.log("Rendering details for alert:", JSON.stringify(alert.sighting1, null, 2));

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 font-mono">{alert.license_plate}</h1>
                <Link to="/" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors">← Back to Dashboard</Link>
            </header>
            
            <div className="mb-8 bg-white border rounded-lg p-6 shadow-md">
                <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Alert Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SightingCard sighting={alert.sighting1} title="Current Sighting" />
                    <SightingCard sighting={alert.sighting2} title="Previous Sighting" />
                </div>
                 <div className="mt-4 text-center font-semibold text-lg">Similarity Score: {Math.round(alert.similarity_score * 100)}%</div>
            </div>

            <div>
                <h2 className="text-2xl font-semibold mb-4">Sighting History (Last 10 Days)</h2>
                {history.length === 0 ? (
                    <div className="text-gray-500 bg-white p-6 rounded-lg shadow-sm">No other sightings found in the last 10 days.</div>
                ) : (
                    <div className="relative pl-6">
                        <div className="absolute left-0 top-0 h-full w-0.5 bg-gray-200"></div>
                        <ul className="space-y-8">
                            {history.map((sighting) => (
                                <li key={sighting._id} className="relative">
                                    <div className="absolute -left-8 top-1 h-4 w-4 bg-white border-2 border-blue-500 rounded-full"></div>
                                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                                        <p><strong>Location:</strong> {sighting.location}</p>
                                        <p><strong>Time:</strong> {new Date(sighting.timestamp).toLocaleString()}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

const SightingCard = ({sighting, title}) => (
    
    <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <img src={`http://${sighting.imageUrl}`} alt="vehicle" className="w-full rounded mb-3" />
        <p><strong>Time:</strong> {new Date(sighting.timestamp).toLocaleString()}</p>
        <p><strong>Class:</strong> {sighting.vehicle_class}</p>
        <p><strong>Location:</strong> {sighting.location}</p>
    </div>
)

export default VehicleDetails;
