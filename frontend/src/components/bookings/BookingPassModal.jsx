import React, { useState } from 'react';
import { QrCode, CheckCircle2, Copy, Check, MapPin, Calendar, Clock, ShieldCheck, X } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

export default function BookingPassModal({ isOpen, onClose, booking }) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  if (!booking) return null;

  const handleCopy = () => {
    if (booking.token) {
      navigator.clipboard.writeText(booking.token);
      setCopied(true);
      success('Pass token copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExpired = booking.status === 'EXPIRED';
  const isCancelled = booking.status === 'CANCELLED';
  const isCompleted = booking.status === 'COMPLETED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SanitiGo Digital Access Pass"
      subtitle="Present this QR or code to the turnstile reader"
      size="sm"
    >
      <div className="space-y-5 text-center">
        {/* Pass Graphic */}
        <div
          className={`rounded-3xl border-2 border-dashed p-6 relative overflow-hidden ${
            isExpired || isCancelled
              ? 'bg-rose-50/50 border-rose-300'
              : 'bg-gradient-to-b from-teal-50 to-white border-teal-300'
          }`}
        >
          {/* Status Badge */}
          <div className="mb-4">
            <Badge status={booking.status} withDot size="sm">
              {booking.status}
            </Badge>
          </div>

          {/* Large Token Code */}
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1">
            Access Code
          </p>
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-inner mb-4">
            <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
              {booking.token || 'NO TOKEN'}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Copy Token"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* QR Code */}
          <div className="w-40 h-40 bg-white border border-slate-200 rounded-2xl p-3 mx-auto mb-4 shadow-sm flex items-center justify-center">
            <QrCode
              className={`w-full h-full ${
                isExpired || isCancelled ? 'text-slate-300' : 'text-slate-900'
              }`}
            />
          </div>

          {/* Restroom & Schedule Info */}
          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3 text-left">
            <p className="font-extrabold text-slate-900">{booking.toilet?.name || 'SanitiGo Facility'}</p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-teal-600 flex-shrink-0" />
              {booking.toilet?.address}, {booking.toilet?.city}
            </p>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 pt-1">
              <span>Date: {formatDate(booking.scheduledDate)}</span>
              <span>Time: {booking.startTime} - {booking.endTime}</span>
            </div>
          </div>
        </div>

        {/* Turnstile Instructions */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed text-left">
          <p className="font-bold text-slate-700 mb-0.5">How to enter:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Hold the QR code directly under the turnstile glass scanner.</li>
            <li>Alternatively, read the 6-digit access code to the operator.</li>
            <li>Single entry allowed per pass.</li>
          </ol>
        </div>

        <Button variant="outline" size="sm" fullWidth onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
