import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import bookingsApi from '../../api/bookings.api';
import { formatCurrency } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function CancelBookingDialog({ isOpen, onClose, booking, onCancelled }) {
  const { success, error: showErrorToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!booking) return null;

  const handleConfirmCancel = async () => {
    setIsSubmitting(true);
    try {
      const response = await bookingsApi.cancelBooking(booking.id);
      success('Booking cancelled successfully. If applicable, refund has been processed.');
      onCancelled?.(response.data || booking);
      onClose();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Restroom Reservation"
      subtitle="Are you sure you want to cancel this booking?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Keep Booking
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmCancel}
            isLoading={isSubmitting}
          >
            Confirm Cancellation
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs text-slate-600">
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Cancellation Policy:</p>
            <p>
              Your token <strong>{booking.token}</strong> will be immediately invalidated and denied at turnstiles.
            </p>
            {booking.payment?.status === 'SUCCESS' && (
              <p className="font-semibold text-emerald-800">
                A 100% refund of {formatCurrency(booking.amount || booking.payment?.amount)} will be automatically credited back to your original payment method.
              </p>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
          <p className="font-bold text-slate-800">{booking.toilet?.name}</p>
          <p className="text-[11px] text-slate-500">
            {booking.scheduledDate} ({booking.startTime} - {booking.endTime})
          </p>
        </div>
      </div>
    </Modal>
  );
}
