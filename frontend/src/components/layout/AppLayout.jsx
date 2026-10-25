import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ToastContainer from '../common/Toast';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top sticky navbar */}
      <Navbar />

      {/* Main page content slot */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Bottom footer */}
      <Footer />

      {/* Global toast notification system */}
      <ToastContainer />
    </div>
  );
}
