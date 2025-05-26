import React from 'react';
import './App.css';
import LatestHealthData from './Components/LatestHealthData';
import PatientContactInfo from './Components/PatientContactInfo';

function App() {
  return (
    <div className="container">
      <h1>Health Monitoring Dashboard</h1>
      
      <section>
        <h2>Current Status</h2>
        <LatestHealthData />
      </section>
      
      <section>
        <h2>Contact Information</h2>
        <PatientContactInfo />
      </section>
    </div>
  );
}

export default App;