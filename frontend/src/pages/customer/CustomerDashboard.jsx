import React from 'react';
import { Calendar, QrCode, Search, Clock, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Link } from 'react-router-dom';

export default function CustomerDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
            Customer Access Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome back, {user?.fullName || 'Traveler'}!
          </h1>
          <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-xl">
            View active digital access passes, track real-time booking history, and find restrooms near you.
          </p>
        </div>
        <Link to="/">
          <Button variant="secondary" size="md" rightIcon={Search} className="bg-white text-teal-900 hover:bg-teal-50 border-0 shadow-lg">
            Find New Restroom
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Entry Pass</p>
            <p className="text-lg font-black text-slate-900">Ready</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Bookings</p>
            <p className="text-lg font-black text-slate-900">Connected</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Account Status</p>
            <p className="text-lg font-black text-emerald-600">Verified</p>
          </div>
        </div>
      </div>

      {/* Placeholder content card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Customer Portal Foundation Initialized</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          The core layout, token interceptors, and authenticated customer session are running. Customer booking workflows and live QR token passes will render here in Part 2.
        </p>
        <div className="inline-flex items-center gap-2">
          <Badge status="CONFIRMED" size="md" withDot>
            SESSION READY
          </Badge>
        </div>
      </div>
    </div>
  );
}
