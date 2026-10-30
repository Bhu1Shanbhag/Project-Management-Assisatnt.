/**
 * api.js — Axios API Service
 *
 * Centralizes all backend HTTP requests.
 * Automatically attaches the JWT token to every request.
 * Handles 401 responses by redirecting to login.
 */

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach JWT token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle auth errors ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/register", data),
  login: (data) => api.post("/login", data),
};

// ── Projects ──────────────────────────────────────────────────────────────
export const projectsAPI = {
  create: (data) => api.post("/projects", data),
  list: () => api.get("/projects"),
  get: (id) => api.get(`/projects/${id}`),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  uploadDocument: (id, formData) =>
    api.post(`/projects/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────
export const tasksAPI = {
  create: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
  update: (taskId, data) => api.put(`/tasks/${taskId}`, data),
  delete: (taskId) => api.delete(`/tasks/${taskId}`),
};

// ── GitHub ────────────────────────────────────────────────────────────────
export const githubAPI = {
  connect: (data) => api.post("/github/connect", data),
  sync: (projectId) => api.post(`/github/sync?project_id=${projectId}`),
};

// ── Meetings ──────────────────────────────────────────────────────────────
export const meetingsAPI = {
  upload: (formData) =>
    api.post("/meetings/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Chat ───────────────────────────────────────────────────────────────────
export const chatAPI = {
  ask: (question, projectId = "") =>
    api.post("/chat", { question, project_id: projectId }),
};

// ── Summary ───────────────────────────────────────────────────────────────
export const summaryAPI = {
  get: (projectId, type = "daily") =>
    api.get(`/summary/${projectId}?summary_type=${type}`),
};

// ── Health ────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get("/health"),
};

export default api;
