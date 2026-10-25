import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullPage message="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role;
    if (!allowedRoles.includes(userRole)) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
              !
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h3>
            <p className="text-xs text-slate-600 mb-6">
              Your account role (<strong>{userRole || 'UNKNOWN'}</strong>) does not have authorization to view this portal.
            </p>
            <Navigate to="/" replace />
          </div>
        </div>
      );
    }
  }

  return children;
}
