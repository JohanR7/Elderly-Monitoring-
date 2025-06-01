import React from "react";
import "./App.css";
import LatestHealthData from "./Components/LatestHealthData";
import PatientContactInfo from "./Components/PatientContactInfo";
import HealthReportGenerator from "./components/HealthReportGenerator";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <section >
        <LatestHealthData />
      </section>
      <section >
        <HealthReportGenerator />
      </section>

      <section>
        <PatientContactInfo />
      </section>
    </div>
  );
}

export default App;
