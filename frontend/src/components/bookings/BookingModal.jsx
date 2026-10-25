import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ArrowRight,
  AlertCircle,
  Building2,
  MapPin,
  Sparkles,
  Check,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import bookingsApi from '../../api/bookings.api';
import paymentsApi from '../../api/payments.api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

// Helper to format today and tomorrow dates in YYYY-MM-DD
function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Helper to get default 1-hour time window starting now or next hour
function getDefaultTimeSlots() {
  const now = new Date();
  const startHour = String((now.getHours() + 1) % 24).padStart(2, '0');
  const endHour = String((now.getHours() + 2) % 24).padStart(2, '0');
  return {
    startTime: `${startHour}:00`,
    endTime: `${endHour}:00`,
  };
}

export default function BookingModal({ isOpen, onClose, toilet, onBookingSuccess }) {
  const { success, error: showErrorToast } = useToast();

  const [step, setStep] = useState(1); // 1 = Details, 2 = Confirmation / Token Pass
  const [scheduledDate, setScheduledDate] = useState(getLocalDateString(0));
  const [timeSlot, setTimeSlot] = useState(getDefaultTimeSlots());
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!toilet) return null;

  const handleDateSelect = (offsetDays) => {
    setScheduledDate(getLocalDateString(offsetDays));
  };

  const handleSlotSelect = (start, end) => {
    setTimeSlot({ startTime: start, endTime: end });
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Create booking
      const payload = {
        toiletId: toilet.id,
        scheduledDate,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        paymentMethod,
      };

      const bookingRes = await bookingsApi.createBooking(payload);
      const bookingData = bookingRes?.data || bookingRes;

      // 2. Safely initiate payment session on server
      try {
        await paymentsApi.initiatePayment(bookingData.id, paymentMethod);

        const isMockAllowed =
          import.meta.env.VITE_ENABLE_MOCK_PAYMENT === 'true' ||
          import.meta.env.MODE === 'development';

        if (isMockAllowed) {
          const simRes = await paymentsApi.simulateMockPayment(
            bookingData.id,
            'SUCCESS'
          );
          const verifiedPayment =
            simRes?.data?.payment || simRes?.payment;
          if (verifiedPayment?.paymentStatus === 'SUCCESS') {
            bookingData.status = 'CONFIRMED';
            bookingData.payment = verifiedPayment;
          }
        }
      } catch (payErr) {
        console.warn('Payment processing notice:', payErr);
      }

      setConfirmedBooking(bookingData);
      setStep(2);
      success('Restroom booking confirmed! Your digital token is ready.');
      onBookingSuccess?.(bookingData);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      showErrorToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    if (confirmedBooking?.token) {
      navigator.clipboard.writeText(confirmedBooking.token);
      setCopied(true);
      success('Booking token copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setStep(1);
    setConfirmedBooking(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Book Restroom Access Pass' : 'Booking Confirmed!'}
      subtitle={
        step === 1
          ? `Reserve access for ${toilet.name}`
          : 'Present this digital pass at the turnstile gate'
      }
      size="md"
    >
      {step === 1 ? (
        /* STEP 1: Select Date, Time Slot, and Payment */
        <form onSubmit={handleSubmitBooking} className="space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Restroom Overview Card */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold flex-shrink-0">
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-900 truncate">{toilet.name}</h4>
              <p className="text-[11px] text-slate-500 truncate">{toilet.address}, {toilet.city}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-teal-600">{formatCurrency(toilet.price)}</span>
            </div>
          </div>

          {/* Date Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              Select Date
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Today', offset: 0 },
                { label: 'Tomorrow', offset: 1 },
                { label: 'Day After', offset: 2 },
              ].map((btn) => {
                const dateStr = getLocalDateString(btn.offset);
                const isSelected = scheduledDate === dateStr;
                return (
                  <button
                    key={btn.offset}
                    type="button"
                    onClick={() => handleDateSelect(btn.offset)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>{btn.label}</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                      {formatDate(dateStr)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              Select Time Window
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Morning', start: '09:00', end: '10:00' },
                { label: 'Afternoon', start: '14:00', end: '15:00' },
                { label: 'Evening', start: '18:00', end: '19:00' },
              ].map((slot) => {
                const isSelected =
                  timeSlot.startTime === slot.start && timeSlot.endTime === slot.end;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => handleSlotSelect(slot.start, slot.end)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>{slot.label}</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                      {slot.start} - {slot.end}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-600" />
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'UPI', label: 'UPI / QR' },
                { id: 'CARD', label: 'Debit/Credit' },
                { id: 'CASH', label: 'Pay at Gate' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`py-2 px-3 rounded-xl border font-semibold transition-all text-center ${
                    paymentMethod === method.id
                      ? 'border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary / Price Breakdown */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Facility Access Fee</span>
              <span>{formatCurrency(toilet.price)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SanitiGo Digital Pass Convenience</span>
              <span className="text-emerald-600 font-bold">FREE</span>
            </div>
            <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200">
              <span>Total Payable</span>
              <span className="text-teal-600 text-sm">{formatCurrency(toilet.price)}</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            isLoading={isSubmitting}
            rightIcon={ArrowRight}
          >
            Confirm & Generate Pass ({formatCurrency(toilet.price)})
          </Button>
        </form>
      ) : (
        /* STEP 2: Digital Entry Pass and Token */
        <div className="space-y-6 text-center animate-slide-up">
          {/* Simulated QR Pass Card */}
          <div className="bg-gradient-to-b from-teal-50 to-white rounded-3xl border-2 border-dashed border-teal-300 p-6 shadow-sm relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              CONFIRMED PASS
            </div>

            {/* Monospace Token Code */}
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">
              Your Entry Passcode
            </p>
            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-inner mb-4">
              <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                {confirmedBooking?.token || 'SG-ACCESS'}
              </span>
              <button
                onClick={handleCopyToken}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Copy Token"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Simulated QR Code Graphic */}
            <div className="w-36 h-36 bg-white border border-slate-200 rounded-2xl p-2.5 mx-auto mb-4 shadow-sm flex items-center justify-center">
              <QrCode className="w-full h-full text-slate-900" />
            </div>

            {/* Booking Details Details */}
            <div className="space-y-1 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
              <p className="font-bold text-slate-900">{toilet.name}</p>
              <p className="text-[11px] text-slate-500">{toilet.address}</p>
              <p className="text-[11px] font-semibold text-teal-700">
                Date: {formatDate(scheduledDate)} | Time: {timeSlot.startTime} - {timeSlot.endTime}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button variant="primary" size="md" fullWidth onClick={handleClose}>
              Done & View in My Bookings
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
