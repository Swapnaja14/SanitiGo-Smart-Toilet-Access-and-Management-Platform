# SanitiGo — Frontend Web Platform

SanitiGo is a modern, responsive web application for smart toilet access, real-time reservations, cashless access passes, verified facility listings, and multi-tenant administration.

Built with **React 19**, **Vite**, **Tailwind CSS**, and **React Router 7**, connected directly to the SanitiGo Express REST APIs and Java Notification Service.

---

## 🌟 Feature Overview

### 1. Customer Workflow
- **Facility Discovery**: Geospatial search, live distance calculation, amenities filtering (accessible, baby-care, contactless, showers), price sorting, and operating status.
- **Facility Details**: High-resolution image carousels, verified badges, live star ratings, hourly pricing, and full amenity tags.
- **Booking & Pass Generation**: Slot reservation with automatic token generation (PIN and QR access pass).
- **Payment Gateway**: Seamless checkout with dev mock simulation and production Razorpay integration.
- **Ratings & Reviews**: Verified visitor feedback with 5-star ratings, rating distributions, and edit/delete permissions.
- **Notification Center**: Real-time notifications for booking confirmations, passkeys, payments, and session completions.

### 2. Toilet Owner Portal
- **Listing Management**: Register new facilities, manage operating hours, toggle live availability, and set pricing.
- **Access Control & Usage Sessions**: Verify customer entry passes, initiate usage sessions, and mark sessions complete.
- **Facility Amenities & Photos**: Add, modify, or remove facility amenities and primary photos.
- **Analytics & Booking Feed**: Track customer bookings, completed sessions, and facility performance.

### 3. SuperAdmin Console
- **Platform Analytics**: Real-time KPI cards for platform users, facility counts, bookings, sessions, and gross revenue volume.
- **Verification Queue**: Review newly submitted toilet facilities, preview public pages, and certify or revoke verification with audit confirmations.
- **User Directory**: Search and filter platform users by role (`USER`, `OWNER`, `ADMIN`), view activity, and toggle account activation status.
- **System Diagnostics**: Health monitors for PostgreSQL pool, RabbitMQ message brokers, and RBAC authorization filters.

---

## 🛠️ Tech Stack & Architecture

- **Core**: React 19 + Vite 8
- **Styling**: Tailwind CSS 3 + Glassmorphic Design System
- **Icons**: Lucide React
- **Routing**: React Router 7 with declarative `ProtectedRoute` guards
- **State & Contexts**:
  - `AuthContext`: Session tokens, user roles, auto-expiration handlers
  - `NotificationContext`: Real-time unread badges, background polling, push updates
  - `ToastContext`: Global animated alert feedback
- **HTTP Client**: Axios with Bearer token interceptor and 401 session expiry handling
- **Resilience**: React `ErrorBoundary` and accessible skip-to-content anchors

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### Installation
```bash
cd frontend
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME=SanitiGo
VITE_ENABLE_MOCK_PAYMENT=true
```

### Development Server
```bash
npm run dev
```
Access the application at `http://localhost:3000`.

### Production Build & Preview
```bash
npm run build
npm run preview
```

---

## 🐳 Docker & Production Deployment

A production-ready multi-stage Docker build is included:
```bash
# Build Docker image
docker build -t sanitigo-frontend .

# Run container on port 80
docker run -p 80:80 sanitigo-frontend
```
Nginx is preconfigured with SPA fallback routing, gzip compression, and HTTP security headers.
