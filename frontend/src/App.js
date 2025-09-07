import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import VehicleDetails from "./pages/VehicleDetails.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vehicles/:id" element={<VehicleDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
