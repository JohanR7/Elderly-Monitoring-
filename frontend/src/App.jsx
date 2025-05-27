import React from "react";
import "./App.css";
import LatestHealthData from "./Components/LatestHealthData";
import PatientContactInfo from "./Components/PatientContactInfo";
import HealthReportGenerator from "./components/HealthReportGenerator";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Health Monitoring Dashboard</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Current Status</h2>
        <LatestHealthData />
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Health Reports</h2>
        <HealthReportGenerator />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Contact Information</h2>
        <PatientContactInfo />
      </section>
    </div>
  );
}

export default App;
