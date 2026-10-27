/**
 * ============================================================
 * API Service — HTTP client for talking to the backend
 * ============================================================
 *
 * What this does:
 *   Creates a pre-configured HTTP client (using axios) that
 *   points at our Spring Boot backend (http://localhost:8080/api).
 *
 *   Every API call from the frontend goes through this file.
 *   This way, if the backend URL changes, we only change it
 *   in one place.
 *
 * How it works:
 *   import api from './services/api';
 *   const response = await api.get('/health');
 */

import axios from 'axios';

// The base URL of our Spring Boot backend.
// Dynamically resolves to current host or Vite proxy for tunnels (e.g. Cloudflare).
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    // If accessed through a tunnel or public domain, use Vite proxy
    if (host.includes('trycloudflare.com') || host.includes('loca.lt') || (!host.includes('192.168.') && host !== '127.0.0.1' && host !== 'localhost')) {
      return '/api';
    }
    const configured = import.meta.env.VITE_API_BASE_URL;
    if (configured) {
      return configured.replace('127.0.0.1', host).replace('localhost', host);
    }
    return `http://${host}:8081/api`;
  }
  return 'http://127.0.0.1:8081/api';
};

export const getAiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    // If accessed through a tunnel or public domain, use Vite proxy
    if (host.includes('trycloudflare.com') || host.includes('loca.lt') || (!host.includes('192.168.') && host !== '127.0.0.1' && host !== 'localhost')) {
      return '/ai-api';
    }
    const configured = import.meta.env.VITE_AI_BASE_URL;
    if (configured) {
      return configured.replace('127.0.0.1', host).replace('localhost', host);
    }
    return `http://${host}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Hazard zones
  getHazardZones: (scenarioId) => api.get(`/map-layers/hazards/${scenarioId}`),
  // Data sources
  getDataSources: (scenarioId) => api.get(`/data-sources?scenarioId=${scenarioId}`),
  // Models
  getModels: () => api.get('/models'),
  getModelById: (id) => api.get(`/models/${id}`),
  // Reports
  getReport: (scenarioId) => api.get(`/reports/${scenarioId}`),
};

export default api;
