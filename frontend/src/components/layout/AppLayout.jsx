import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ToastContainer from '../common/Toast';
import ErrorBoundary from '../common/ErrorBoundary';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all"
      >
        Skip to main content
      </a>

      {/* Top sticky navbar */}
      <Navbar />

      {/* Main page content slot wrapped in ErrorBoundary */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Bottom footer */}
      <Footer />

      {/* Global toast notification system */}
      <ToastContainer />
    </div>
  );
}
