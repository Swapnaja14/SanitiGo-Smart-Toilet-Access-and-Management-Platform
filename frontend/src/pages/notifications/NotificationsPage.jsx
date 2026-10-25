import React from 'react';
import { Bell, Mail, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import NotificationList from '../../components/notifications/NotificationList';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-semibold">
              <Bell className="w-3.5 h-3.5 text-brand-400" />
              Real-time Activity Log
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Notification Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Track live updates regarding your smart toilet bookings, automated access PINs,
              payment confirmations, and completed hygiene visits.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 self-start md:self-auto">
            <div className="w-9 h-9 rounded-xl bg-brand-500/30 flex items-center justify-center text-brand-300">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Dual Delivery Active</p>
              <p className="text-[11px] text-slate-300">Web alerts + Email delivery</p>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Background Notification Service Banner */}
      <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/80 text-teal-900 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 flex-shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <p className="font-bold text-teal-950">Email Delivery Notice</p>
          <p className="text-teal-800 leading-relaxed">
            Transactional email confirmations, QR code passkeys, and payment receipts are processed
            and dispatched by the dedicated SanitiGo Java Notification Service directly to your account
            inbox.
          </p>
        </div>
      </div>

      {/* Main Notifications List */}
      <NotificationList />
    </div>
  );
}
