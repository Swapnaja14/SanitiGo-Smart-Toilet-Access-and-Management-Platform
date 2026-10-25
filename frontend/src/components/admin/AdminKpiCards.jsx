import React from 'react';
import {
  Users,
  Building2,
  CalendarCheck2,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Activity,
  CheckCircle,
} from 'lucide-react';

export default function AdminKpiCards({ stats, loading = false }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-white/80 rounded-2xl border border-slate-200/80 shadow-sm animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-200" />
              <div className="w-16 h-4 bg-slate-200 rounded-full" />
            </div>
            <div className="h-7 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const { users, toilets, bookings, financials, sessions } = stats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Platform Users */}
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 border border-brand-200/60 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Directory
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Platform Users
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {users?.total?.toLocaleString() ?? 0}
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
            {users?.customers ?? 0} Customers
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
            {users?.owners ?? 0} Owners
          </span>
        </div>
      </div>

      {/* 2. Facility Registry & Verification */}
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/60 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          {toilets?.unverified > 0 ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
              {toilets.unverified} In Review
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              All Verified
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Registered Toilets
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {toilets?.total?.toLocaleString() ?? 0}
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            {toilets?.verified ?? 0} Verified
          </span>
          {toilets?.unverified > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              <AlertCircle className="w-3.5 h-3.5" />
              {toilets.unverified} Pending
            </span>
          )}
        </div>
      </div>

      {/* 3. Bookings & Usage Sessions */}
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
            Activity
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total Reservations
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {bookings?.total?.toLocaleString() ?? 0}
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
            <CheckCircle className="w-3.5 h-3.5" />
            {bookings?.completed ?? 0} Completed
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            <Activity className="w-3.5 h-3.5" />
            {sessions?.total ?? 0} Sessions
          </span>
        </div>
      </div>

      {/* 4. Financial Performance */}
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Revenue
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Processed Volume
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{(financials?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            {financials?.successfulTransactions ?? 0} Settled Payments
          </span>
        </div>
      </div>
    </div>
  );
}
