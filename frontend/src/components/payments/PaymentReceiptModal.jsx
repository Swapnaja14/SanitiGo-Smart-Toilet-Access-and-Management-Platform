import React from 'react';
import {
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  Hash,
  Download,
  CheckCircle2,
  FileText,
  User,
  Sparkles,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';

export default function PaymentReceiptModal({
  isOpen,
  onClose,
  booking,
  payment: directPayment,
}) {
  if (!booking) return null;

  const payment = directPayment || booking.payment || {};
  const basePrice = Number(booking.amount || booking.toilet?.price || 20);
  const convenienceFee = 5.0;
  const totalAmount = Number(payment.amount || basePrice + convenienceFee);

  const receiptNumber =
    payment.transactionId?.replace(/[^a-zA-Z0-9]/g, '').slice(-8) ||
    booking.id?.slice(0, 8)?.toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  const isPaid = payment.paymentStatus === 'SUCCESS';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Payment Receipt"
      subtitle={`Receipt #${receiptNumber}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Printable Receipt Card */}
        <div
          id="printable-receipt"
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-5 print:border-none print:shadow-none"
        >
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                S
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  SanitiGo Access Pass
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Smart Sanitation & Urban Hygiene
                </p>
              </div>
            </div>

            <Badge
              variant={isPaid ? 'success' : payment.paymentStatus === 'REFUNDED' ? 'purple' : 'warning'}
              size="sm"
            >
              {isPaid ? 'PAID' : payment.paymentStatus || 'PENDING'}
            </Badge>
          </div>

          {/* Receipt Identifiers Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Receipt Number
              </span>
              <span className="font-mono font-bold text-slate-800">
                RCP-{receiptNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Issued Date
              </span>
              <span className="text-slate-700 font-medium">
                {formatDate(payment.paidAt || booking.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Transaction ID
              </span>
              <span className="font-mono text-slate-700 text-[11px] truncate block">
                {payment.transactionId || 'MOCK_VERIFIED'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Payment Method
              </span>
              <span className="font-semibold text-slate-800">
                {payment.paymentMethod || 'UPI'}
              </span>
            </div>
          </div>

          {/* Restroom & Booking Details */}
          <div className="space-y-2 text-xs">
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Reserved Facility
            </h4>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
              <p className="font-bold text-slate-900 text-sm">
                {booking.toilet?.name || 'Smart Restroom Pod'}
              </p>
              <p className="text-slate-500 text-[11px]">
                {booking.toilet?.address}, {booking.toilet?.city}
              </p>
              <div className="flex items-center gap-3 pt-1 text-slate-600 font-medium text-[11px]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  {formatDate(booking.scheduledDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  {booking.startTime?.slice(0, 5)} - {booking.endTime?.slice(0, 5)}
                </span>
              </div>
              {booking.token && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] uppercase text-slate-400 font-bold">
                    Turnstile Token
                  </span>
                  <span className="font-mono font-bold text-teal-700 tracking-wider">
                    {booking.token}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Itemized Charges */}
          <div className="space-y-2 text-xs">
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Itemized Charges
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Facility Access Pass (Single Entry)</span>
                <span className="font-medium text-slate-800">
                  {formatCurrency(basePrice)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sanitization & Touchless Tech Fee</span>
                <span className="font-medium text-slate-800">
                  {formatCurrency(convenienceFee)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Taxes & GST (Included)</span>
                <span>₹0.00</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                <span>Total Amount Paid</span>
                <span className="text-teal-700 font-extrabold text-base">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Footer Notice */}
          <div className="text-center pt-2 border-t border-dashed border-slate-200 space-y-1">
            <p className="text-[10px] text-slate-400">
              Electronic receipt valid for turnstile audit & expense claims.
            </p>
            <p className="text-[10px] text-teal-700 font-semibold">
              Thank you for supporting clean, accessible public sanitation!
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-3 print:hidden">
          <Button variant="outline" fullWidth onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handlePrint}
            leftIcon={Printer}
          >
            Print Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
