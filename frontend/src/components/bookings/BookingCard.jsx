import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Copy,
  Check,
  Building2,
  XCircle,
  Sparkles,
  CreditCard,
  FileText,
  RotateCcw,
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';

export default function BookingCard({
  booking,
  onViewPass,
  onCancelBooking,
  onViewReceipt,
  onRetryPayment,
}) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  if (!booking) return null;

  const handleCopyToken = (e) => {
    e.stopPropagation();
    if (booking.token) {
      navigator.clipboard.writeText(booking.token);
      setCopied(true);
      success('Pass token copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isCancellable =
    booking.status === 'PENDING' || booking.status === 'CONFIRMED';

  const toilet = booking.toilet || {};
  const paymentStatus =
    booking.payment?.paymentStatus || booking.payment?.status;
  const isPaid = paymentStatus === 'SUCCESS' || booking.status === 'CONFIRMED';
  const isPaymentFailed = paymentStatus === 'FAILED';
  const isPaymentPending = booking.status === 'PENDING' && !isPaid;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Header row: Status, Payment Badge, and Price */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={booking.status} withDot size="sm">
              {booking.status}
            </Badge>

            {isPaid ? (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                Paid
              </span>
            ) : isPaymentFailed ? (
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                Payment Failed
              </span>
            ) : isPaymentPending ? (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                Payment Pending
              </span>
            ) : null}

            {paymentStatus === 'REFUNDED' && (
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                Refunded
              </span>
            )}
          </div>

          <span className="text-base font-black text-slate-900">
            {formatCurrency(booking.amount || toilet.price)}
          </span>
        </div>

        {/* Toilet Details */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0 text-teal-700">
            <Building2 className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 truncate">
              {toilet.name || 'SanitiGo Facility'}
            </h3>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              {toilet.address ? `${toilet.address}, ${toilet.city || ''}` : 'Location provided in pass'}
            </p>
          </div>
        </div>

        {/* Schedule & Token Row */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs mb-4">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Scheduled Date</p>
            <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              {formatDate(booking.scheduledDate)}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-slate-400 font-medium">Time Window</p>
            <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {booking.startTime} - {booking.endTime}
            </p>
          </div>

          {booking.token && (
            <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Turnstile Entry Code</p>
                <p className="font-mono text-sm font-black text-slate-900 tracking-wider">
                  {booking.token}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Copy Token"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          {/* If pass is active, provide View QR Pass button */}
          {isPaid && (
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              leftIcon={QrCode}
              onClick={() => onViewPass?.(booking)}
            >
              View QR Pass
            </Button>
          )}

          {/* If payment pending or failed, provide Pay Now / Retry button */}
          {isPaymentPending && (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              leftIcon={isPaymentFailed ? RotateCcw : CreditCard}
              onClick={() => onRetryPayment?.(booking)}
            >
              {isPaymentFailed ? 'Retry Payment' : 'Complete Payment'}
            </Button>
          )}

          {/* Official Printable Receipt Button */}
          {isPaid && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={FileText}
              onClick={() => onViewReceipt?.(booking)}
              title="View Payment Receipt"
            >
              Receipt
            </Button>
          )}

          {/* Cancel Booking Action */}
          {isCancellable && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
              onClick={() => onCancelBooking?.(booking)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
