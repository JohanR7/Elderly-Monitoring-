import React, { useState } from "react";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { API_BASE_URL, GEMINI_API_KEY } from "../config";

function HealthReportGenerator() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      // Using GET with the correct endpoint
      const response = await axios.get(`${API_BASE_URL}/health-data/latest`);

      if (response.data && response.data.length > 0) {
        // Process data for AI analysis
        const healthData = response.data;

        // Generate summary statistics
        const avgHeartRate = calculateAverage(
          healthData.map((d) => d.heart_rate).filter(Boolean)
        );
        const avgSpo2 = calculateAverage(
          healthData.map((d) => d.spo2).filter(Boolean)
        );
        const avgTemp = calculateAverage(
          healthData.map((d) => d.body_temp).filter(Boolean)
        );
        const avgBP = calculateAverage(
          healthData
            .map((d) => parseFloat(d.blood_pressure || "0"))
            .filter(Boolean)
        );
        const fallEvents = healthData.filter((d) => d.fall_detected).length;

        // Generate AI-powered analysis using Gemini
        const aiAnalysis = await generateAIAnalysis(healthData, {
          avgHeartRate,
          avgSpo2,
          avgTemp,
          avgBP,
          fallEvents,
        });

        // Create a summary report
        const reportData = {
          generatedAt: new Date().toLocaleString(),
          dataPoints: healthData.length,
          timeRange: {
            from: new Date(
              healthData[healthData.length - 1].timestamp
            ).toLocaleString(),
            to: new Date(healthData[0].timestamp).toLocaleString(),
          },
          averages: {
            heartRate: avgHeartRate.toFixed(1),
            spo2: avgSpo2.toFixed(1),
            temperature: avgTemp.toFixed(1),
            bloodPressure: avgBP.toFixed(1),
          },
          fallEvents,
          trends: aiAnalysis.trends || analyzeTrends(healthData),
          recommendations:
            aiAnalysis.recommendations || generateRecommendations(healthData),
          healthScore: aiAnalysis.healthScore,
          riskFactors: aiAnalysis.riskFactors,
          summary: aiAnalysis.summary,
        };

        setReport(reportData);
      } else {
        setError("Not enough health data to generate a report");
      }
    } catch (err) {
      console.error("Error generating health report:", err);
      setError("Failed to generate health report. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  // AI-powered analysis using Gemini
  const generateAIAnalysis = async (healthData, statistics) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Prepare health data summary for AI analysis
      const dataString = JSON.stringify({
        totalDataPoints: healthData.length,
        averages: statistics,
        recentReadings: healthData.slice(0, 5),
        timeSpan: {
          from: healthData[healthData.length - 1]?.timestamp,
          to: healthData[0]?.timestamp,
        },
      });

      const prompt = `
As a healthcare AI assistant, analyze the following elderly patient health monitoring data and provide a comprehensive health report:

Health Data:
${dataString}

Please provide a detailed analysis including:

1. **Health Score** (1-100 scale): Overall health assessment based on all vitals
2. **Trends**: Identify patterns in heart rate, SpO2, temperature, and blood pressure over time
3. **Risk Factors**: Any concerning patterns or values that indicate health risks
4. **Recommendations**: Specific, actionable health recommendations for the elderly patient
5. **Summary**: A brief overall health status summary

Focus on elderly-specific health concerns such as:
- Fall risk assessment
- Cardiovascular health
- Respiratory function
- Temperature regulation
- Blood pressure management

Provide practical, easy-to-understand recommendations suitable for elderly care.

Please format your response as a JSON object with the following structure:
{
  "healthScore": number,
  "trends": "detailed trends analysis",
  "riskFactors": ["risk1", "risk2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...],
  "summary": "brief overall summary"
}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the AI response
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiAnalysis = JSON.parse(jsonMatch[0]);
          return aiAnalysis;
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
      }

      // Fallback to basic analysis if AI parsing fails
      return {
        healthScore: calculateBasicHealthScore(statistics),
        trends: analyzeTrends(healthData),
        riskFactors: identifyRiskFactors(statistics),
        recommendations: generateRecommendations(healthData),
        summary: "AI analysis temporarily unavailable, using basic assessment.",
      };
    } catch (error) {
      console.error("Gemini AI Error:", error);
      // Fallback to basic analysis
      return {
        healthScore: calculateBasicHealthScore(statistics),
        trends: analyzeTrends(healthData),
        riskFactors: identifyRiskFactors(statistics),
        recommendations: generateRecommendations(healthData),
        summary: "AI analysis temporarily unavailable, using basic assessment.",
      };
    }
  };

  // Fallback functions for when AI is not available
  const calculateBasicHealthScore = (stats) => {
    let score = 100;

    // Heart rate assessment (normal range 60-100 bpm for elderly)
    if (stats.avgHeartRate < 50 || stats.avgHeartRate > 110) score -= 20;
    else if (stats.avgHeartRate < 60 || stats.avgHeartRate > 100) score -= 10;

    // SpO2 assessment (normal > 95%)
    if (stats.avgSpo2 < 90) score -= 25;
    else if (stats.avgSpo2 < 95) score -= 15;

    // Temperature assessment (normal 36.1-37.2°C)
    if (stats.avgTemp < 35 || stats.avgTemp > 38) score -= 20;
    else if (stats.avgTemp < 36 || stats.avgTemp > 37.5) score -= 10;

    // Fall events assessment
    if (stats.fallEvents > 2) score -= 30;
    else if (stats.fallEvents > 0) score -= 15;

    return Math.max(score, 0);
  };

  const identifyRiskFactors = (stats) => {
    const risks = [];

    if (stats.avgHeartRate > 100) risks.push("Elevated heart rate");
    if (stats.avgHeartRate < 60) risks.push("Low heart rate");
    if (stats.avgSpo2 < 95) risks.push("Low oxygen saturation");
    if (stats.avgTemp > 37.5) risks.push("Elevated body temperature");
    if (stats.fallEvents > 0) risks.push("Fall incidents detected");
    if (stats.avgBP > 140) risks.push("High blood pressure");

    return risks.length > 0
      ? risks
      : ["No significant risk factors identified"];
  };

  // Helper functions
  const calculateAverage = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const analyzeTrends = (data) => {
    // Simple trend analysis (could be expanded with AI integration)
    if (data.length < 2) return "Not enough data for trend analysis";

    // Compare most recent with earlier readings
    const recent = data.slice(0, Math.min(5, data.length));
    const older = data.slice(Math.max(0, data.length - 5));

    const recentHR = calculateAverage(
      recent.map((d) => d.heart_rate).filter(Boolean)
    );
    const olderHR = calculateAverage(
      older.map((d) => d.heart_rate).filter(Boolean)
    );

    let trends = [];

    if (recentHR > olderHR + 5) {
      trends.push("Heart rate has been trending upward");
    } else if (recentHR < olderHR - 5) {
      trends.push("Heart rate has been trending downward");
    } else {
      trends.push("Heart rate has been relatively stable");
    }

    return trends.join(". ");
  };

  const generateRecommendations = (data) => {
    // This would ideally integrate with an AI service like Gemini
    // For now, we'll use basic rules-based recommendations
    const recommendations = [];
    const latest = data[0];

    if (latest.heart_rate > 100) {
      recommendations.push(
        "Heart rate appears elevated. Consider rest and monitoring."
      );
    }

    if (latest.spo2 < 95) {
      recommendations.push(
        "Oxygen saturation is below optimal levels. Consider discussing with healthcare provider."
      );
    }

    if (latest.body_temp > 37.5) {
      recommendations.push(
        "Body temperature is slightly elevated. Monitor for other symptoms."
      );
    }

    if (data.some((d) => d.fall_detected)) {
      recommendations.push(
        "Fall events detected in records. Consider environmental safety assessment."
      );
    }

    return recommendations.length
      ? recommendations
      : [
          "All vitals appear within normal ranges. Continue regular monitoring.",
        ];
  };

  if (loading)
    return <p className="loading">Generating AI-powered health report...</p>;

  return (
    <div className="health-report">
      {!report && (
        <button onClick={generateReport} className="report-button">
          Generate AI Health Report
        </button>
      )}

      {error && <p className="error">{error}</p>}

      {report && (
        <div className="report-content">
          <h3>AI-Powered Health Report</h3>
          <p>
            <strong>Generated:</strong> {report.generatedAt}
          </p>
          <p>
            <strong>Based on:</strong> {report.dataPoints} readings from{" "}
            {report.timeRange.from} to {report.timeRange.to}
          </p>

          {report.healthScore && (
            <div style={{ textAlign: "center", margin: "2rem 0" }}>
              <h4>Health Score</h4>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "bold",
                  color:
                    report.healthScore >= 80
                      ? "#38a169"
                      : report.healthScore >= 60
                      ? "#d69e2e"
                      : "#e53e3e",
                }}
              >
                {report.healthScore}/100
              </div>
              <p
                style={{
                  color:
                    report.healthScore >= 80
                      ? "#38a169"
                      : report.healthScore >= 60
                      ? "#d69e2e"
                      : "#e53e3e",
                  fontWeight: "bold",
                }}
              >
                {report.healthScore >= 80
                  ? "Good Health"
                  : report.healthScore >= 60
                  ? "Fair Health"
                  : "Needs Attention"}
              </p>
            </div>
          )}

          {report.summary && (
            <>
              <h4>Health Summary</h4>
              <p
                style={{
                  fontStyle: "italic",
                  backgroundColor: "rgba(102, 126, 234, 0.1)",
                  padding: "1rem",
                  borderRadius: "8px",
                }}
              >
                {report.summary}
              </p>
            </>
          )}

          <h4>Average Readings</h4>
          <p>Heart Rate: {report.averages.heartRate} bpm</p>
          <p>SpO2: {report.averages.spo2}%</p>
          <p>Temperature: {report.averages.temperature} °C</p>
          <p>Blood Pressure: {report.averages.bloodPressure} mmHg</p>
          <p>Fall Events: {report.fallEvents}</p>

          <h4>Health Trends</h4>
          <p>{report.trends}</p>

          {report.riskFactors && report.riskFactors.length > 0 && (
            <>
              <h4>Risk Factors</h4>
              <ul>
                {report.riskFactors.map((risk, idx) => (
                  <li key={idx} style={{ color: "#e53e3e" }}>
                    {risk}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4>AI Recommendations</h4>
          <ul>
            {report.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>

          <button onClick={() => setReport(null)} className="report-button">
            Close Report
          </button>
        </div>
      )}
    </div>
  );
}

export default HealthReportGenerator;
