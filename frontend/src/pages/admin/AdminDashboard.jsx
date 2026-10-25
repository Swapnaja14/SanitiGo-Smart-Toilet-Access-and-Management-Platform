import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Activity,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import { adminApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import AdminKpiCards from '../../components/admin/AdminKpiCards';
import UserDirectory from '../../components/admin/UserDirectory';
import ToiletVerificationQueue from '../../components/admin/ToiletVerificationQueue';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState('toilets'); // 'toilets' | 'users' | 'system'
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch KPI statistics
  const fetchStats = useCallback(async (showToast = false) => {
    try {
      setLoadingStats(true);
      const data = await adminApi.getStats();
      setStats(data);
      if (showToast) {
        success('Platform metrics synchronized successfully.');
      }
    } catch (err) {
      console.error('Failed to load platform stats', err);
      toastError('Could not sync platform metrics.');
    } finally {
      setLoadingStats(false);
    }
  }, [success, toastError]);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  const pendingVerificationCount = stats?.toilets?.unverified ?? 0;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 flex-1 w-full">
      {/* Admin Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-navy-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              RBAC Guard: SuperUser Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Platform Administration & Moderation
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Oversee smart toilet facilities, review newly submitted partner listings, manage user
              account statuses, and monitor real-time platform transactions.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <Button
              variant="accent"
              size="md"
              icon={RefreshCw}
              onClick={() => fetchStats(true)}
              loading={loadingStats}
              className="shadow-lg shadow-teal-500/20 bg-teal-500 hover:bg-teal-600 text-white font-bold"
            >
              Sync Metrics
            </Button>
          </div>
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Platform KPI Metrics */}
      <AdminKpiCards stats={stats} loading={loadingStats} />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('toilets')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs font-bold transition-all relative whitespace-nowrap ${
            activeTab === 'toilets'
              ? 'text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Toilet Verification Queue</span>
          {pendingVerificationCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
              {pendingVerificationCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs font-bold transition-all relative whitespace-nowrap ${
            activeTab === 'users'
              ? 'text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory & Moderation</span>
          {stats?.users?.total && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
              {stats.users.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs font-bold transition-all relative whitespace-nowrap ${
            activeTab === 'system'
              ? 'text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System & Operational Health</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'toilets' && (
        <ToiletVerificationQueue onStatsUpdated={() => fetchStats(false)} />
      )}

      {activeTab === 'users' && (
        <UserDirectory onStatsUpdated={() => fetchStats(false)} />
      )}

      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                PostgreSQL & Prisma
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">Database Connection Pool</p>
              <p className="text-xs text-slate-500">
                Primary relational database storing users, verified toilets, tokens, and financial outbox events.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
              <span>Connection Latency:</span>
              <span className="font-semibold text-slate-900">&lt; 15ms</span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                RabbitMQ Message Broker
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3 text-emerald-600" /> Active
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">Event-Driven Notification Stream</p>
              <p className="text-xs text-slate-500">
                Asynchronous event pub/sub connecting Express backend to Java Notification Service.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
              <span>Dead Letter Queue (DLQ):</span>
              <span className="font-semibold text-emerald-700">0 Items</span>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Security & RBAC
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-teal-600" /> Enforced
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">Admin Authorization Filter</p>
              <p className="text-xs text-slate-500">
                All `/api/v1/admin/*` endpoints strictly require verified JWTs bearing `role === "ADMIN"`.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
              <span>Active SuperUser:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                {user?.email || 'admin@sanitigo.com'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
