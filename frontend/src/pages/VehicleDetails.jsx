import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL || "http://localhost:4000";

const VehicleDetails = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  // --- Fetch alert details ---
  const {
    data: alert,
    isLoading: isAlertLoading,
    isError: isAlertError,
    error: alertError,
  } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const res = await axios.get(`${API_GATEWAY_URL}/api/vehicles/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 1, // 1 min
  });

  // --- Fetch history (only after alert is loaded) ---
  const {
    data: history = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    error: historyError,
  } = useQuery({
    queryKey: ["history", alert?.license_plate],
    queryFn: async () => {
      const res = await axios.get(
        `${API_GATEWAY_URL}/api/vehicles/history/${alert.license_plate}`
      );
      return res.data.data || [];
    },
    enabled: !!alert?.license_plate,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // --- Mark alert as read (PATCH) ---
  useEffect(() => {
    if (!id) return;
    const updateReadStatus = async () => {
      try {
        await axios.patch(`${API_GATEWAY_URL}/api/vehicles/${id}`);
        // Invalidate dashboard list so "read" status updates
        queryClient.invalidateQueries(["vehicles"]);
      } catch (err) {
        console.error("Not able to update read status:", err);
      }
    };
    updateReadStatus();
  }, [id, queryClient]);

  // --- Loading / Error States ---
  if (isAlertLoading) return <div className="p-8 text-center">Loading alert...</div>;
  if (isAlertError) return <div className="p-8 text-center text-red-600">{alertError.message}</div>;
  if (!alert) return <div className="p-8 text-center">Alert not found.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 font-mono">
          {alert.license_plate}
        </h1>
        <Link
          to="/"
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </header>

      {/* Alert details */}
      <div className="mb-8 bg-white border rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Alert Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SightingCard sighting={alert.sighting1} title="Current Sighting" />
          <SightingCard sighting={alert.sighting2} title="Previous Sighting" />
        </div>
        <div className="mt-4 text-center font-semibold text-lg">
          Similarity Score: {Math.round(alert.similarity_score * 100)}%
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Sighting History (Last 10 Days)</h2>

        {isHistoryLoading && (
          <div className="text-center text-gray-500">Loading history...</div>
        )}
        {isHistoryError && (
          <div className="text-center text-red-600">{historyError.message}</div>
        )}

        {!isHistoryLoading && history.length === 0 ? (
          <div className="text-gray-500 bg-white p-6 rounded-lg shadow-sm">
            No other sightings found in the last 10 days.
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-0 top-0 h-full w-0.5 bg-gray-200"></div>
            <ul className="space-y-8">
              {history.map((sighting) => (
                <li key={sighting._id} className="relative">
                  <div className="absolute -left-8 top-1 h-4 w-4 bg-white border-2 border-blue-500 rounded-full"></div>
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <p>
                      <strong>Location:</strong> {sighting.location}
                    </p>
                    <p>
                      <strong>Time:</strong>{" "}
                      {new Date(sighting.timestamp).toLocaleString()}
                    </p>
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

const SightingCard = ({ sighting, title }) => (
  <div className="bg-gray-50 p-4 rounded-lg border">
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    <img
      src={`http://${sighting.imageUrl}`}
      alt="vehicle"
      className="w-full rounded mb-3"
    />
    <p>
      <strong>Time:</strong> {new Date(sighting.timestamp).toLocaleString()}
    </p>
    <p>
      <strong>Class:</strong> {sighting.vehicle_class}
    </p>
    <p>
      <strong>Location:</strong> {sighting.location}
    </p>
  </div>
);

export default VehicleDetails;
