import React, { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import './App.css';

// --- OPTIMIZATION: Load URLs from environment variables ---
// This makes the app configurable for different environments (dev vs. production)
const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL;
const SOCKET_SERVICE_URL = process.env.REACT_APP_SOCKET_SERVICE_URL;

const SuspiciousVehicles = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- OPTIMIZATION (PAGINATION): State to manage pagination ---
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true); // To know if there's more data to load

    // This is a hardcoded value for the demo. In a real app, this would
    // come from user authentication or GPS location.
    const clientLocation = "Mumbai";

    // --- OPTIMIZATION (PAGINATION): Function to fetch a page of data ---
    // useCallback ensures this function isn't recreated on every render
    const fetchVehicles = useCallback(async (pageNum) => {
        setLoading(true);
        try {
            // Connect to our new, paginated API endpoint via the API Gateway
            const response = await axios.get(`${API_GATEWAY_URL}/api/vehicles?page=${pageNum}&limit=10`);
            const { data, pagination } = response.data;
            
            console.log("Response.data:", response.data);

            // If it's the first page, replace the data. Otherwise, append it.
            setVehicles(prev => pageNum === 1 ? data : [...prev, ...data]);
            
            // Update if there are more pages to load
            setHasMore(pagination.currentPage < pagination.totalPages);

        } catch (err) {
            console.error("❌ Error fetching vehicle data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect for initial data load and setting up WebSocket
    useEffect(() => {
        // Fetch the first page of data when the component mounts
        fetchVehicles(1);

        // --- OPTIMIZATION: Connect directly to the client-api-service for WebSockets ---
        const socket = io(SOCKET_SERVICE_URL);

        socket.on('connect', () => {
            console.log(`✅ Socket connected with ID: ${socket.id}`);
            // --- OPTIMIZATION: Use a more descriptive event to register the client's location room ---
            socket.emit("register_location", clientLocation);
        });

        // Listen for our new, specific real-time alert event
        socket.on("suspicious_vehicle_alert", (newAlertData) => {
            console.log("🚨 Real-time alert received:", newAlertData);
            // Add the new alert to the top of the list for immediate visibility
            setVehicles(prev => [newAlertData, ...prev]);
        });

        // Cleanup function to disconnect the socket when the component unmounts
        return () => {
            console.log("🔌 Disconnecting socket...");
            socket.disconnect();
        };
    }, [fetchVehicles]); // Dependency array includes the memoized fetch function

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchVehicles(nextPage);
    }

    return (
        <div className="pageSection">
            <header>
                <h1>Real-Time Suspicious Vehicle Alerts</h1>
                <p>Location: {clientLocation}</p>
            </header>

            <div className="vehicle-list">
                {vehicles.length === 0 && !loading ? (
                    <div className="empty-state">No suspicious vehicles detected yet.</div>
                ) : (
                    vehicles.map((vehicle, index) => (
                        <div className="vehicleSection" key={vehicle._id || index}>
                            <div className="VehicleNumber">
                                <div>Plate: <strong>{vehicle.license_plate}</strong></div>
                                <div className={`status ${vehicle.status}`}>{vehicle.status.replace('_', ' ').toUpperCase()}</div>
                            </div>
                            <div className="similarity-score">
                                Similarity Score: <span>{(vehicle.similarity_score * 100).toFixed(2)}%</span>
                            </div>
                            <div className="vehicleInfoSection">
                                <div className="vehicleInfo">
                                    <h3>Sighting 1</h3>
                                    <p><strong>Category:</strong> {vehicle.sighting1.vehicle_class}</p>
                                    <p><strong>Location:</strong> {vehicle.sighting1.location}</p>
                                    <p><strong>Time:</strong> {new Date(vehicle.sighting1.timestamp).toLocaleString()}</p>
                                    {/* --- OPTIMIZATION: Use the direct imageUrl from S3 --- */}
                                    <img src={vehicle.sighting1.imageUrl} className="image" alt="First sighting" />
                                </div>
                                <div className="vehicleInfo">
                                    <h3>Sighting 2</h3>
                                    <p><strong>Category:</strong> {vehicle.sighting2.vehicle_class}</p>
                                    <p><strong>Location:</strong> {vehicle.sighting2.location}</p>
                                    <p><strong>Time:</strong> {new Date(vehicle.sighting2.timestamp).toLocaleString()}</p>
                                    <img src={vehicle.sighting2.imageUrl} className="image" alt="Second sighting" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {loading && <div className="loading-indicator">Loading...</div>}

            {/* --- OPTIMIZATION (PAGINATION): "Load More" button --- */}
            {hasMore && !loading && (
                <div className="load-more-container">
                    <button onClick={handleLoadMore} className="load-more-btn">
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default SuspiciousVehicles;
