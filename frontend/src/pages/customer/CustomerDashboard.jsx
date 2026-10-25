import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Calendar,
  QrCode,
  Search,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import bookingsApi from '../../api/bookings.api';
import { extractErrorMessage } from '../../utils/errors';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Skeleton from '../../components/common/Skeleton';
import BookingCard from '../../components/bookings/BookingCard';
import BookingPassModal from '../../components/bookings/BookingPassModal';
import CancelBookingDialog from '../../components/bookings/CancelBookingDialog';
import BookingModal from '../../components/bookings/BookingModal';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { success, error: showErrorToast } = useToast();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

  // Modals state
  const [passModalBooking, setPassModalBooking] = useState(null);
  const [cancelDialogBooking, setCancelDialogBooking] = useState(null);
  const [bookingModalToilet, setBookingModalToilet] = useState(
    location.state?.selectedToilet || null
  );

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await bookingsApi.getMyBookings({ limit: 50 });
      const data = response?.data || response;
      const list = data?.bookings || [];
      setBookings(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setApiError(msg);
      showErrorToast(msg);
    } finally {
      setIsLoading(false);
    }
  }, [showErrorToast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Filter bookings by active tab
  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') {
      return (
        b.status === 'CONFIRMED' ||
        b.status === 'PENDING' ||
        b.status === 'IN_PROGRESS'
      );
    }
    if (activeTab === 'COMPLETED') {
      return b.status === 'COMPLETED';
    }
    if (activeTab === 'CANCELLED') {
      return b.status === 'CANCELLED' || b.status === 'EXPIRED';
    }
    return true;
  });

  // Calculate status counts
  const counts = {
    total: bookings.length,
    active: bookings.filter(
      (b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS'
    ).length,
    completed: bookings.filter((b) => b.status === 'COMPLETED').length,
    cancelled: bookings.filter(
      (b) => b.status === 'CANCELLED' || b.status === 'EXPIRED'
    ).length,
  };

  const handleBookingCreated = (newBooking) => {
    setBookingModalToilet(null);
    fetchBookings();
  };

  const handleBookingCancelled = (cancelledBooking) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === cancelledBooking.id ? { ...b, status: 'CANCELLED' } : b))
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
            Customer Booking Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome back, {user?.fullName || 'Traveler'}!
          </h1>
          <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-xl">
            Manage your digital restroom passes, monitor turnstile verification codes, and track session records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={fetchBookings}
            leftIcon={RefreshCw}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            Refresh
          </Button>

          <Link to="/">
            <Button
              variant="secondary"
              size="md"
              rightIcon={Search}
              className="bg-white text-teal-900 hover:bg-teal-50 border-0 shadow-lg"
            >
              Book Restroom
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">All Bookings</p>
            <p className="text-lg font-black text-slate-900">{counts.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Active Passes</p>
            <p className="text-lg font-black text-emerald-600">{counts.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Completed</p>
            <p className="text-lg font-black text-slate-900">{counts.completed}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Cancelled/Expired</p>
            <p className="text-lg font-black text-slate-900">{counts.cancelled}</p>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl text-xs font-bold text-slate-600">
          {[
            { id: 'ALL', label: 'All', count: counts.total },
            { id: 'ACTIVE', label: 'Active Passes', count: counts.active },
            { id: 'COMPLETED', label: 'Completed', count: counts.completed },
            { id: 'CANCELLED', label: 'Cancelled / Expired', count: counts.cancelled },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List Section */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : apiError ? (
        <div className="bg-white rounded-3xl border border-rose-200 p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Unable to Load Bookings</h3>
          <p className="text-xs text-slate-500 mb-6">{apiError}</p>
          <Button variant="primary" size="sm" onClick={fetchBookings}>
            Retry
          </Button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Reservations Found</h3>
          <p className="text-xs text-slate-500 mb-6">
            {activeTab === 'ALL'
              ? "You haven't made any restroom reservations yet."
              : `No bookings currently match the "${activeTab}" filter.`}
          </p>
          <Link to="/">
            <Button variant="primary" size="sm" rightIcon={Search}>
              Find Nearby Restrooms
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onViewPass={(booking) => setPassModalBooking(booking)}
              onCancelBooking={(booking) => setCancelDialogBooking(booking)}
            />
          ))}
        </div>
      )}

      {/* QR Pass Inspection Modal */}
      <BookingPassModal
        isOpen={!!passModalBooking}
        onClose={() => setPassModalBooking(null)}
        booking={passModalBooking}
      />

      {/* Cancel Booking Confirmation Dialog */}
      <CancelBookingDialog
        isOpen={!!cancelDialogBooking}
        onClose={() => setCancelDialogBooking(null)}
        booking={cancelDialogBooking}
        onCancelled={handleBookingCancelled}
      />

      {/* Booking Modal (If user was forwarded from a restroom detail page) */}
      {bookingModalToilet && (
        <BookingModal
          isOpen={!!bookingModalToilet}
          onClose={() => setBookingModalToilet(null)}
          toilet={bookingModalToilet}
          onBookingSuccess={handleBookingCreated}
        />
      )}
    </div>
  );
}
