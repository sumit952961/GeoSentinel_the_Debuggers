/**
 * ============================================================
 * AIDRS — AI Driven Disaster Response System
 * ============================================================
 * Main application shell with React Router navigation.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopBar from './components/Navigation/TopBar';
import Breadcrumb from './components/Navigation/Breadcrumb';
import LandingOverview from './pages/LandingOverview';
import ScenarioSelector from './pages/ScenarioSelector';
import DisasterMap from './pages/DisasterMap';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import ResearchMetrics from './pages/ResearchMetrics';
import ReportView from './pages/ReportView';
import SystemHealth from './pages/SystemHealth';
import ModelTraining from './pages/ModelTraining';
import ScenarioView from './pages/ScenarioView';
import EmergencyCADBoard from './pages/EmergencyCADBoard';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { TYPE } from './design-system/tokens';

function AppContent() {
  const { tokens } = useTheme();

  return (
    <BrowserRouter>
      <TopBar />
      <Breadcrumb />
      <main style={{
        paddingTop: 88, /* TopBar 52px + Breadcrumb 36px */
        minHeight: '100vh',
        background: tokens.bg,
        color: tokens.text,
        fontFamily: TYPE.fontFamily,
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}>
        <Routes>
          <Route path="/" element={<LandingOverview />} />
          <Route path="/scenarios" element={<ScenarioSelector />} />
          <Route path="/map" element={<DisasterMap />} />
          <Route path="/map/:scenarioId" element={<DisasterMap />} />
          <Route path="/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/reports" element={<ReportView />} />
          <Route path="/scenario-data" element={<ScenarioView />} />
          <Route path="/emergency" element={<EmergencyCADBoard />} />
          <Route path="/scenario/:scenarioId/emergency" element={<EmergencyCADBoard />} />
          <Route path="/scenario/:scenarioId/map" element={<DisasterMap />} />
          <Route path="/scenario/:scenarioId/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/scenario/:scenarioId/reports" element={<ReportView />} />
          <Route path="/research" element={<ResearchMetrics />} />
          <Route path="/model-training" element={<ModelTraining />} />
          <Route path="/system" element={<SystemHealth />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
