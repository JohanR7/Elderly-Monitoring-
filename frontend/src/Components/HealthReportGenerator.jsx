import React, { useState } from "react";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileText, Activity, Heart, Thermometer, TrendingUp, AlertTriangle, CheckCircle, Clock, Brain, Shield } from "lucide-react";
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

        // Generate AI-powered analysis using Gemini (simulated)
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
      : [];
  };

  // Helper functions
  const calculateAverage = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const analyzeTrends = (data) => {
    if (data.length < 2) return "Not enough data for trend analysis";

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

  const ActionButton = ({ children, variant, onClick, disabled = false }) => {
    const baseClasses = "w-full py-3 px-4 rounded-lg font-medium text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      blue: "bg-blue-500 hover:bg-blue-600 disabled:hover:bg-blue-500",
      green: "bg-green-500 hover:bg-green-600 disabled:hover:bg-green-500",
      purple: "bg-purple-500 hover:bg-purple-600 disabled:hover:bg-purple-500",
      red: "bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500"
    };
    return (
      <button
        className={`${baseClasses} ${variants[variant]}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  };

  const MetricCard = ({ icon: Icon, title, value, unit, color }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-gray-600 text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">Generating AI-powered health report...</p>
          <p className="text-gray-500 text-sm mt-2">Analyzing health data patterns</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">AI Health Report Generator</h1>
          </div>
          <p className="text-gray-600">Generate comprehensive health analysis reports</p>
        </div>

        {!report && !error && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <Brain className="w-16 h-16 text-purple-600 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Generate Your Health Report</h2>
              <p className="text-gray-600 mb-8">
                Our AI system will analyze your recent health data to provide comprehensive insights, 
                trends analysis, and personalized recommendations.
              </p>
              <ActionButton variant="purple" onClick={generateReport}>
                <div className="flex items-center justify-center gap-2">
                  <Brain className="w-5 h-5" />
                  Generate AI Health Report
                </div>
              </ActionButton>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 text-center">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6" />
              <h2 className="text-xl font-bold text-red-700 mb-4">Report Generation Failed</h2>
              <p className="text-red-600 mb-6">{error}</p>
              <ActionButton variant="red" onClick={generateReport}>
                Try Again
              </ActionButton>
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-800">AI-Powered Health Report</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Generated: {report.generatedAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Data Points: {report.dataPoints} readings</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>From: {report.timeRange.from}</span>
                </div>
              </div>
            </div>

            {/* Health Score */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-800">Overall Health Score</h3>
                </div>
                <div className="mb-4">
                  <div
                    className={`text-6xl font-bold mb-2 ${
                      report.healthScore >= 80
                        ? "text-green-600"
                        : report.healthScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {report.healthScore}/100
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      report.healthScore >= 80
                        ? "text-green-600"
                        : report.healthScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {report.healthScore >= 80
                      ? "Excellent Health"
                      : report.healthScore >= 60
                      ? "Good Health"
                      : "Needs Attention"}
                  </p>
                </div>
                {report.summary && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-gray-700 italic">{report.summary}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Average Readings */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-800">Average Vital Signs</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={Heart}
                  title="Heart Rate"
                  value={report.averages.heartRate}
                  unit="bpm"
                  color="text-red-500"
                />
                <MetricCard
                  icon={Activity}
                  title="SpO2"
                  value={report.averages.spo2}
                  unit="%"
                  color="text-blue-500"
                />
                <MetricCard
                  icon={Thermometer}
                  title="Temperature"
                  value={report.averages.temperature}
                  unit="°C"
                  color="text-orange-500"
                />
                <MetricCard
                  icon={Heart}
                  title="Blood Pressure"
                  value={report.averages.bloodPressure}
                  unit="mmHg"
                  color="text-purple-500"
                />
              </div>
            </div>

            {/* Health Trends */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-800">Health Trends Analysis</h3>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-700">{report.trends}</p>
              </div>
            </div>

            {/* Risk Factors */}
            {report.riskFactors && report.riskFactors.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-xl font-bold text-gray-800">Risk Factors</h3>
                </div>
                <div className="space-y-2">
                  {report.riskFactors.map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-800">AI Recommendations</h3>
              </div>
              <div className="space-y-3">
                {report.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActionButton variant="green" onClick={() => window.print()}>
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    Print Report
                  </div>
                </ActionButton>
                <ActionButton variant="blue" onClick={() => setReport(null)}>
                  <div className="flex items-center justify-center gap-2">
                    <Brain className="w-4 h-4" />
                    Generate New Report
                  </div>
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthReportGenerator;