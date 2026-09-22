# 🚢 Arctic Ship Navigation & Route Optimization System (AROS)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-1F4257?style=for-the-badge&logo=openlayers&logoColor=white)](https://openlayers.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

An enterprise-grade maritime navigation and decision-support platform engineered specifically for the extreme challenges of **Arctic and Antarctic polar navigation**. 

AROS combines **GEBCO bathymetric depth modeling**, **A\* heuristic water-only pathfinding**, **real-time Open-Meteo weather intelligence**, **dynamic route risk calculation**, and **machine learning fuel modeling**.

---

## 📚 Project Documentation & Presentation

- 📖 **[Comprehensive Technical Documentation (PROJECT_DOCUMENTATION.md)](file:///c:/Users/harsh/OneDrive/Attachments/Arctic-Route-Optimization-System/Arctic-Ship-Navigation/PROJECT_DOCUMENTATION.md)**: Detailed system architecture, algorithmic analysis, API references, data models, and module breakdown.
- 🎯 **[Team & Stakeholder Presentation Deck (PRESENTATION.md)](file:///c:/Users/harsh/OneDrive/Attachments/Arctic-Route-Optimization-System/Arctic-Ship-Navigation/PRESENTATION.md)**: 13-slide ready-to-present deck with talking points, visual concepts, live demonstration script, and defense Q&A.

---

## 🌟 Key Features

- 🗺️ **True Water-Only Marine Pathfinding**: Powered by GEBCO bathymetric ocean depth grids. Strictly enforces vessel draft clearances and mathematically eliminates land crossings.
- ⚡ **Multi-Strategy Route Options**: Computes and compares **Optimal**, **Safest (Deep Water Corridor)**, and **Northern Sea Route** alternatives with automatic overlap detection.
- 🌦️ **Continuous Route Weather Sampling**: Live meteorological observations (polar wind, gale gusts, wave height, sub-zero air temperature) sampled along the entire voyage geometry via Open-Meteo.
- 🛡️ **Dynamic Polar Code Risk Scoring**: Evaluates multi-factor composite risk indices (Low, Moderate, High, Severe) in accordance with IMO Polar Code standards.
- 📡 **Real-Time Telemetry & WebSockets**: Bidirectional Socket.IO event broadcasting for vessel position updates, port congestion, and iceberg drift alerts.
- 🤖 **Machine Learning Optimization**: TensorFlow.js neural network inference and ML regression models for non-linear fuel consumption estimates based on sea state and ice hull resistance.
- 🧭 **High-Performance Polar Mapping**: OpenLayers visualization engine supporting polar stereographic projections, waypoint management, and telemetry dashboards.

---

## 🏗️ System Architecture

```
[ Frontend: React 18 + OpenLayers + Zustand ]
                     ▲
                     │ REST API & WebSockets
                     ▼
[ Backend: Node.js + Express + TypeScript ]
  ├── GEBCO Bathymetric Grid & A* Pathfinder
  ├── Open-Meteo Live Weather Service
  ├── Route Risk Evaluator & Alternative Generator
  └── Prisma ORM (PostgreSQL with In-Memory Fallback)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 1. Start Backend Server
```bash
cd backend
npm install
npm run dev
```
Backend API will be live at: **[http://localhost:4000](http://localhost:4000)**  
Health endpoint: **[http://localhost:4000/api/health](http://localhost:4000/api/health)**

### 2. Start Frontend Application
In a separate terminal:
```bash
npm install
npm run dev
```
Frontend application will be live at: **[http://localhost:5173](http://localhost:5173)**

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check and live status |
| `GET` | `/api/ports` | Arctic & Antarctic ports with congestion data |
| `GET` | `/api/weather?latitude=...&longitude=...` | Real-time weather observation |
| `POST` | `/api/routes/generate` | Generates water-only routes & alternatives |
| `GET` | `/api/routes/:id/monitoring` | Real-time environmental monitoring along route |
| `GET` | `/api/routing/status` | Status of the GEBCO routing provider |

---

## 👥 Contributors & Repository

- **GitHub Repository**: [https://github.com/harshalpatil63/Arctic-Ship-Navigation-](https://github.com/harshalpatil63/Arctic-Ship-Navigation-)
- **Owner**: [harshalpatil63](https://github.com/harshalpatil63)
