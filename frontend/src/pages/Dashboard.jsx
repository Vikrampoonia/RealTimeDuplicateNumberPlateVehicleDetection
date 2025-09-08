import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useQueryClient, useQuery } from "@tanstack/react-query";

// --- Configuration ---
const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL || "http://localhost:4000";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:4002";

const Dashboard = () => {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ sort: "date_desc", status: "", isRead: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [CLIENT_LOCATION, setClientLocation] = useState("Mumbai");
  const [currentPage, setCurrentPage] = useState(1);

  // --- Manage URL Search Params ---
  const [searchParams, setSearchParams] = useSearchParams();

  // Restore filters & search from URL on first load
  useEffect(() => {
    const status = searchParams.get("status") || "";
    const isRead = searchParams.get("isRead") || "";
    const sort = searchParams.get("sort") || "date_desc";
    const search = searchParams.get("search") || "";
    setFilters({ status, isRead, sort });
    setSearchTerm(search);
  }, []);

  // Update URL whenever filters/search change
  useEffect(() => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.isRead) params.isRead = filters.isRead;
    if (filters.sort) params.sort = filters.sort;
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params);
  }, [filters, debouncedSearch, CLIENT_LOCATION]);

  // Debounce search input (500ms)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // reset to first page on new search
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // --- Fetch vehicles ---
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vehicles", { filters, search: debouncedSearch, location: CLIENT_LOCATION, page: currentPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        sort: filters.sort,
      });
      if (filters.status) params.append("status", filters.status);
      if (filters.isRead) params.append("isRead", filters.isRead);
      if (debouncedSearch) params.append("search", debouncedSearch);
      params.append("location", CLIENT_LOCATION);

      const response = await axios.get(`${API_GATEWAY_URL}/api/vehicles?${params.toString()}`);
      return {
        vehicles: response.data.data || [],
        pagination: response.data.pagination || { currentPage: 1, totalPages: 1, totalDocuments: 0 },
      };
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 1, // 1 minute
    cacheTime: 1000 * 60 * 5, // 5 minutes
    onError: (err) => {
      console.error("Error fetching vehicles:", err);
    },
  });

  const vehicles = data?.vehicles || [];
  const pagination = data?.pagination || { currentPage: 1, totalPages: 1, totalDocuments: 0 };

  // --- WebSocket for real-time alerts ---
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("connect", () => socket.emit("Add", { from: CLIENT_LOCATION }));
    socket.on("notification", () => {
      queryClient.invalidateQueries(["vehicles"]);
    });
    return () => socket.disconnect();
  }, [queryClient, CLIENT_LOCATION]);

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); // reset page when filter changes
  };

  const clearFilters = () => {
    setFilters({ sort: "date_desc", status: "", isRead: "" });
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <header>
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
            Suspicious Vehicle Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time alerts from active monitoring stations.
          </p>
        </header>
        <div>
          <label className="mr-2 font-semibold text-black-700">Your Location:</label>
          <select value={CLIENT_LOCATION} onChange={(e) => setClientLocation(e.target.value)}>
            <option value="Mumbai">Mumbai</option>
            <option value="New Delhi">Delhi</option>
          </select>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <input
            type="text"
            placeholder="Search by plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <FilterDropdown
            name="sort"
            value={filters.sort}
            onChange={handleFilterChange}
            options={[
              { value: "date_desc", label: "Newest First" },
              { value: "date_asc", label: "Oldest First" },
            ]}
          />
          <FilterDropdown
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            options={[
              { value: "", label: "All Statuses" },
              { value: "suspicious", label: "Suspicious" },
              { value: "confirmed_fraud", label: "Confirmed Fraud" },
            ]}
          />
          <FilterDropdown
            name="isRead"
            value={filters.isRead}
            onChange={handleFilterChange}
            options={[
              { value: "", label: "All Messages" },
              { value: "false", label: "Unread" },
              { value: "true", label: "Read" },
            ]}
          />
        </div>
        <button
          onClick={clearFilters}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Clear All Filters
        </button>
      </div>

      {isError && (
        <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error.message}</div>
      )}

      {/* Vehicle list */}
      <div className="space-y-4">
        {!isLoading &&vehicles.length > 0 ? (
          vehicles.map((vehicle) => (
            <Link to={`/vehicles/${vehicle._id}`} key={vehicle._id} className="block">
              <div
                className={`border-l-4 rounded-r-lg p-4 shadow-md transition-all hover:shadow-xl hover:scale-[1.01] ${
                  !vehicle.isRead
                    ? "border-blue-500 bg-white"
                    : "border-gray-300 bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-xl font-semibold text-gray-700">
                    {vehicle.license_plate}
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${
                      vehicle.status === "confirmed_fraud"
                        ? "bg-red-200 text-red-800"
                        : "bg-yellow-200 text-yellow-800"
                    }`}
                  >
                    {vehicle.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Last seen:{" "}
                  {new Date(vehicle.sighting1.timestamp).toLocaleString()}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center text-gray-500">No vehicles found.</div>
        )}
      </div>

      {isLoading && <div className="mt-6 text-center text-gray-500">Loading...</div>}

      {!isLoading && vehicles.length === 0 && (
        <div className="text-center text-gray-500 mt-8 p-8 bg-white rounded-lg shadow-sm">
          <p className="font-semibold">No alerts found.</p>
          <p className="text-sm">Try adjusting your filters or search term.</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1 || isLoading}
          className="px-4 py-2 bg-black text-white border border-gray-300 rounded-lg hover:bg-black-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages || isLoading}
          className="px-4 py-2 bg-black text-white border border-gray-300 rounded-lg hover:bg-black-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// --- Helper dropdown component ---
const FilterDropdown = ({ name, value, onChange, options }) => (
  <div className="relative">
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {value && (
      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 font-bold">
        ✓
      </span>
    )}
  </div>
);

export default Dashboard;
