import React, { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import './App.css';

// --- Configuration ---
const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL || "http://localhost:4000";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:4002";
const CLIENT_LOCATION = "Mumbai";

// --- Main Component ---
const SuspiciousVehiclesDashboard = () => {
    // --- State Management ---
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [filters, setFilters] = useState({ sort: 'date_desc', status: '' });

    // --- NEW STATE for History Modal ---
    const [historyModal, setHistoryModal] = useState({
        isOpen: false,
        isLoading: false,
        data: [],
        error: null,
        plateNumber: null
    });
    
    // --- API & Data Fetching ---
    const fetchVehicles = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page, limit: 10, sort: filters.sort });
            if (filters.status) { params.append('status', filters.status); }
            const response = await axios.get(`${API_GATEWAY_URL}/api/vehicles?${params.toString()}`);
            setVehicles(prev => page === 1 ? response.data.data : [...prev, ...response.data.data]);
            setPagination({ currentPage: response.data.pagination.currentPage, totalPages: response.data.pagination.totalPages });
        } catch (err) {
            console.error("Error fetching vehicles:", err);
            setError("Failed to load vehicle data. Please try again later.");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // --- Side Effects ---
    useEffect(() => { fetchVehicles(1); }, [fetchVehicles]);

    useEffect(() => {
        const socket = io(SOCKET_URL);
        socket.on('connect', () => {
            console.log("✅ Socket connected:", socket.id);
            socket.emit("Add", { from: CLIENT_LOCATION });
        });
        socket.on("notification", (newAlert) => {
            console.log("🚨 Real-time alert received:", newAlert);
            setVehicles(prev => [newAlert.data, ...prev]);
        });
        return () => { socket.disconnect(); };
    }, []);

    // --- Event Handlers ---
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const handleLoadMore = () => {
        if (pagination.currentPage < pagination.totalPages) {
            fetchVehicles(pagination.currentPage + 1);
        }
    };

    const handleMarkAsRead = async (vehicleId) => {
        try {
            setVehicles(prev => prev.map(v => v._id === vehicleId ? { ...v, isRead: true } : v));
            await axios.patch(`${API_GATEWAY_URL}/api/vehicles/${vehicleId}`);
        } catch (err) {
            console.error("Failed to mark as read:", err);
            setVehicles(prev => prev.map(v => v._id === vehicleId ? { ...v, isRead: false } : v));
            alert("Could not update the alert. Please try again.");
        }
    };

    // --- NEW HANDLER for fetching vehicle history ---
    const handleViewHistory = async (plateNumber) => {
        setHistoryModal({ isOpen: true, isLoading: true, data: [], error: null, plateNumber });
        try {
            const response = await axios.get(`${API_GATEWAY_URL}/api/vehicles/history/${plateNumber}`);
            setHistoryModal(prev => ({ ...prev, isLoading: false, data: response.data.data }));
        } catch (err) {
            console.error(`Error fetching history for ${plateNumber}:`, err);
            setHistoryModal(prev => ({ ...prev, isLoading: false, error: "Could not load vehicle history." }));
        }
    };

    const closeHistoryModal = () => {
        setHistoryModal({ isOpen: false, isLoading: false, data: [], error: null, plateNumber: null });
    };

    // --- Rendering ---
    return (
        <>
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <h1>Suspicious Vehicle Alerts</h1>
                    <div className="filter-controls">
                        <div className="control-group">
                            <label htmlFor="sort">Sort By:</label>
                            <select id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}>
                                <option value="date_desc">Newest First</option>
                                <option value="date_asc">Oldest First</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label htmlFor="status">Filter by Status:</label>
                            <select id="status" name="status" value={filters.status} onChange={handleFilterChange}>
                                <option value="">All</option>
                                <option value="suspicious">Suspicious</option>
                                <option value="confirmed_fraud">Confirmed Fraud</option>
                            </select>
                        </div>
                    </div>
                </header>
                
                <main className="alerts-list">
                    {error && <div className="error-message">{error}</div>}
                    {vehicles.length === 0 && !loading && <div className="empty-state">No suspicious vehicles found.</div>}
                    
                    {vehicles.map((vehicle) => (
                        <div className={`alert-card ${!vehicle.isRead ? 'is-unread' : ''}`} key={vehicle._id}>
                            <div className="card-header">
                                <span className="plate-number">{vehicle.license_plate}</span>
                                <span className={`status-badge status-${vehicle.status}`}>{vehicle.status.replace('_', ' ')}</span>
                            </div>
                            <div className="card-body">
                                <SightingDetails sighting={vehicle.sighting1} title="Current Sighting" />
                                <SightingDetails sighting={vehicle.sighting2} title="Previous Sighting" />
                            </div>
                            <div className="card-footer">
                                <span>Similarity Score: {Math.round(vehicle.similarity_score * 100)}%</span>
                                <div className="card-actions">
                                    {/* NEW BUTTON */}
                                    <button onClick={() => handleViewHistory(vehicle.license_plate)} className="history-btn">
                                        View History
                                    </button>
                                    {!vehicle.isRead && (
                                        <button onClick={() => handleMarkAsRead(vehicle._id)} className="mark-read-btn">
                                            Mark as Read
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && <div className="loading-spinner">Loading...</div>}
                    
                    {!loading && pagination.currentPage < pagination.totalPages && (
                        <button onClick={handleLoadMore} className="load-more-btn">Load More</button>
                    )}
                </main>
            </div>

            {/* --- NEW: Conditionally render the history modal --- */}
            {historyModal.isOpen && (
                <HistoryModal
                    plateNumber={historyModal.plateNumber}
                    history={historyModal.data}
                    isLoading={historyModal.isLoading}
                    error={historyModal.error}
                    onClose={closeHistoryModal}
                />
            )}
        </>
    );
};

// --- Helper Components ---
const SightingDetails = ({ sighting, title }) => (
    <div className="sighting-details">
        <h4>{title}</h4>
        <img src={sighting.imageUrl} alt={`Vehicle sighting`} className="vehicle-image" />
        <p><strong>Class:</strong> {sighting.vehicle_class}</p>
        <p><strong>Location:</strong> {sighting.location}</p>
        <p><strong>Time:</strong> {new Date(sighting.timestamp).toLocaleString()}</p>
    </div>
);

// --- NEW History Modal Component ---
const HistoryModal = ({ plateNumber, history, isLoading, error, onClose }) => {
    // This allows closing the modal with the "Escape" key
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Sighting History for {plateNumber}</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {isLoading && <div className="loading-spinner">Loading history...</div>}
                    {error && <div className="error-message">{error}</div>}
                    {!isLoading && !error && history.length === 0 && (
                        <div className="empty-state">No history found.</div>
                    )}
                    {!isLoading && !error && history.length > 0 && (
                        <ul className="history-timeline">
                            {history.map((sighting) => (
                                <li key={sighting._id} className="timeline-item">
                                    <div className="timeline-marker"></div>
                                    <div className="timeline-content">
                                        <p><strong>Location:</strong> {sighting.location}</p>
                                        <p><strong>Time:</strong> {new Date(sighting.timestamp).toLocaleString()}</p>
                                        <p><strong>Class:</strong> {sighting.vehicle_class}</p>
                                        <img src={sighting.imageUrl} alt="Vehicle" className="timeline-image" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuspiciousVehiclesDashboard;

