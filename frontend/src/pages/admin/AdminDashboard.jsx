import React from 'react';
import { ShieldCheck, Activity, Users, Building2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-navy-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-700/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            System Administrator Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Admin Center: {user?.fullName || 'SuperAdmin'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Inspect platform diagnostics, verify newly registered toilet listings, toggle user account active states, and review transactional outbox health.
          </p>
        </div>
        <Button variant="accent" size="md" leftIcon={RefreshCw} className="shadow-lg shadow-teal-500/20">
          Sync Metrics
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">RBAC Guard</p>
            <p className="text-lg font-black text-slate-900">Enforced</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Operational Health</p>
            <p className="text-lg font-black text-emerald-600">HEALTHY</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Toilet Registry</p>
            <p className="text-lg font-black text-slate-900">10 Verified</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Outbox DLQ Depth</p>
            <p className="text-lg font-black text-slate-900">0 Items</p>
          </div>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-teal-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Admin Command Foundation Online</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          The superuser authentication layer, authorization guard (`authorizeRoles("ADMIN")`), and administrative state monitors are initialized. Management tables for toilets, users, and audit logs will link in Part 4.
        </p>
        <div className="inline-flex items-center gap-2">
          <Badge status="ACTIVE" size="md" withDot>
            SUPERUSER PRIVILEGES READY
          </Badge>
        </div>
      </div>
    </div>
  );
}
