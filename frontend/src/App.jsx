import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProfilePage from './pages/auth/ProfilePage';
import ToiletDetailPage from './pages/toilets/ToiletDetailPage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import NotificationsPage from './pages/notifications/NotificationsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<AppLayout />}>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/toilets/:id" element={<ToiletDetailPage />} />

                {/* Notifications & User Profile (Any Authenticated User) */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

              {/* Customer Portal */}
              <Route
                path="/customer/bookings"
                element={
                  <ProtectedRoute allowedRoles={['USER', 'ADMIN']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/customer" element={<Navigate to="/customer/bookings" replace />} />

              {/* Toilet Owner Portal */}
              <Route
                path="/owner/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                    <OwnerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />

              {/* Admin Portal */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
