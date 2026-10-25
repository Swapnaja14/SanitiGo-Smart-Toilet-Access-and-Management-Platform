import React from 'react';
import { Building2, QrCode, CheckCircle2, TrendingUp, Users, PlusCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function OwnerDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <Building2 className="w-3.5 h-3.5 text-teal-200" />
            Toilet Owner Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Facility Operations: {user?.fullName || 'Owner'}
          </h1>
          <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-xl">
            Monitor real-time occupancy, verify customer SG tokens, view usage sessions, and manage pricing.
          </p>
        </div>
        <Button variant="secondary" size="md" leftIcon={QrCode} className="bg-white text-teal-900 hover:bg-teal-50 border-0 shadow-lg">
          Launch Gate Scanner
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Registered Facilities</p>
            <p className="text-lg font-black text-slate-900">Active</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Token Validator</p>
            <p className="text-lg font-black text-emerald-600">Online</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Session Pipeline</p>
            <p className="text-lg font-black text-slate-900">Synchronized</p>
          </div>
        </div>
      </div>

      {/* Placeholder content card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Owner Portal Foundation Initialized</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          The owner authentication guard, role verification (`OWNER`), and API client are active. Restroom listing editors and gate scanner tools will connect in Part 3.
        </p>
        <div className="inline-flex items-center gap-2">
          <Badge status="VERIFIED" size="md" withDot>
            OWNER PRIVILEGES ACTIVE
          </Badge>
        </div>
      </div>
    </div>
  );
}
