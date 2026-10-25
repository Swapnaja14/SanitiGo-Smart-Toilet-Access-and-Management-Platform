import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  QrCode,
  CheckCircle2,
  TrendingUp,
  Plus,
  RefreshCw,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  Edit,
  Trash2,
  Image,
  Calendar,
  CreditCard,
  Users,
  Search,
  Filter,
  AlertTriangle,
  Play,
  Square,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import ownerApi from '../../api/owner.api';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Skeleton from '../../components/common/Skeleton';
import ToiletFormModal from '../../components/owner/ToiletFormModal';
import OperatingHoursModal from '../../components/owner/OperatingHoursModal';
import AmenitiesModal from '../../components/owner/AmenitiesModal';
import ImageUploadModal from '../../components/owner/ImageUploadModal';
import TokenVerificationModal from '../../components/owner/TokenVerificationModal';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { success, error: showErrorToast, info } = useToast();

  const [toilets, setToilets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('FACILITIES'); // 'FACILITIES' | 'SCANNER' | 'BOOKINGS'

  // Modal states
  const [isToiletModalOpen, setIsToiletModalOpen] = useState(false);
  const [editingToilet, setEditingToilet] = useState(null);
  const [hoursToilet, setHoursToilet] = useState(null);
  const [amenitiesToilet, setAmenitiesToilet] = useState(null);
  const [uploadToilet, setUploadToilet] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const loadOwnerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [toiletsRes, bookingsRes] = await Promise.all([
        ownerApi.getOwnerToilets().catch(() => ({ data: [] })),
        ownerApi.getOwnerBookings().catch(() => ({ data: [] })),
      ]);

      const tList = toiletsRes?.data || toiletsRes || [];
      const bList = bookingsRes?.data || bookingsRes || [];

      setToilets(Array.isArray(tList) ? tList : []);
      setBookings(Array.isArray(bList) ? bList : []);
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [showErrorToast]);

  useEffect(() => {
    loadOwnerData();
  }, [loadOwnerData]);

  const handleDeleteToilet = async (toilet) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${toilet.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await ownerApi.deleteToilet(toilet.id);
      success(`Toilet facility "${toilet.name}" deleted.`);
      loadOwnerData();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    }
  };

  // Metrics computation
  const totalFacilities = toilets.length;
  const totalBookings = bookings.length;
  const verifiedRevenue = bookings.reduce((sum, b) => {
    if (b.payment?.paymentStatus === 'SUCCESS') {
      return sum + Number(b.amount || 0);
    }
    return sum;
  }, 0);
  const activeBookings = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS'
  ).length;

  const filteredToilets = toilets.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <Building2 className="w-3.5 h-3.5 text-teal-200" />
            Verified Facility Owner Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Facility Center: {user?.fullName || 'Owner'}
          </h1>
          <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-xl">
            Register smart restroom pods, manage operating timetables, verify customer SG tokens, and inspect live usage turnstiles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="md"
            onClick={loadOwnerData}
            leftIcon={RefreshCw}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="md"
            leftIcon={QrCode}
            onClick={() => setIsScannerOpen(true)}
            className="bg-white text-teal-950 hover:bg-teal-50 border-0 shadow-lg font-bold"
          >
            Gate Validator
          </Button>

          <Button
            variant="primary"
            size="md"
            leftIcon={Plus}
            onClick={() => {
              setEditingToilet(null);
              setIsToiletModalOpen(true);
            }}
            className="bg-teal-500 hover:bg-teal-400 text-white shadow-glow font-bold border-0"
          >
            Add Facility
          </Button>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Owned Restrooms</p>
            <p className="text-lg font-black text-slate-900">{totalFacilities}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Bookings</p>
            <p className="text-lg font-black text-slate-900">{totalBookings}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Gross Revenue</p>
            <p className="text-lg font-black text-teal-700">
              {formatCurrency(verifiedRevenue)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Active Passes</p>
            <p className="text-lg font-black text-amber-600">{activeBookings}</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('FACILITIES')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'FACILITIES'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            My Facilities ({totalFacilities})
          </button>
          <button
            onClick={() => setActiveTab('BOOKINGS')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'BOOKINGS'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            Customer Bookings ({totalBookings})
          </button>
          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'SCANNER'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-teal-600" />
            Turnstile Validator
          </button>
        </div>

        {activeTab === 'FACILITIES' && (
          <div className="w-full sm:w-64 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter facilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* TAB 1: Facilities Management */}
      {activeTab === 'FACILITIES' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
                  <Skeleton className="h-40 rounded-2xl w-full" />
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          ) : filteredToilets.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {searchQuery ? 'No Matching Facilities' : 'No Facilities Registered Yet'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery
                    ? 'Try searching with a different name or city keyword.'
                    : 'Start earning by registering your smart restroom pod on SanitiGo.'}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={Plus}
                  onClick={() => {
                    setEditingToilet(null);
                    setIsToiletModalOpen(true);
                  }}
                >
                  Register First Facility
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredToilets.map((toilet) => {
                const coverImage =
                  toilet.images && toilet.images.length > 0
                    ? toilet.images[0].imageUrl
                    : 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80';

                return (
                  <div
                    key={toilet.id}
                    className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Photo Thumbnail Banner */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={coverImage}
                          alt={toilet.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md ${
                              toilet.isAvailable
                                ? 'bg-emerald-600/90 text-white'
                                : 'bg-slate-700/90 text-white'
                            }`}
                          >
                            {toilet.isAvailable ? 'Operational' : 'Closed'}
                          </span>
                          {toilet.isVerified && (
                            <span className="text-[11px] font-bold bg-teal-600/90 text-white px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-xs font-black">
                          {formatCurrency(toilet.price)}
                        </div>

                        {/* Image count badge */}
                        <button
                          type="button"
                          onClick={() => setUploadToilet(toilet)}
                          className="absolute bottom-2.5 right-2.5 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1 transition-colors shadow-sm"
                        >
                          <Image className="w-3 h-3 text-teal-600" />
                          <span>{toilet.images?.length || 0} Photos</span>
                        </button>
                      </div>

                      {/* Body Content */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 truncate">
                            {toilet.name}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                            <span>
                              {toilet.address}, {toilet.city}
                            </span>
                          </p>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-400 block">Capacity:</span>
                            <span className="font-bold text-slate-700">
                              {toilet.capacity || 1} Person(s)
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Amenities:</span>
                            <span className="font-bold text-teal-700">
                              {toilet.amenities?.length || 0} Registered
                            </span>
                          </div>
                        </div>

                        {/* Amenities preview tags */}
                        {toilet.amenities && toilet.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {toilet.amenities.slice(0, 3).map((ta) => (
                              <span
                                key={ta.amenityId || ta.amenity?.id}
                                className="text-[10px] font-semibold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-100"
                              >
                                {ta.amenity?.name}
                              </span>
                            ))}
                            {toilet.amenities.length > 3 && (
                              <span className="text-[10px] font-semibold text-slate-400 px-1 py-0.5">
                                +{toilet.amenities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Facility Actions Bar */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Edit}
                          onClick={() => {
                            setEditingToilet(toilet);
                            setIsToiletModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Clock}
                          onClick={() => setHoursToilet(toilet)}
                        >
                          Hours
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Sparkles}
                          onClick={() => setAmenitiesToilet(toilet)}
                        >
                          Amenities
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        leftIcon={Trash2}
                        onClick={() => handleDeleteToilet(toilet)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: Turnstile Gate Validator */}
      {activeTab === 'SCANNER' && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Turnstile Gate Validator & Live Sessions
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Scan customer tokens at turnstile checkpoints to verify access windows and initiate active usage sessions.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={QrCode}
            onClick={() => setIsScannerOpen(true)}
            className="shadow-glow py-3.5 font-bold"
          >
            Launch Token Scanner & Session Manager
          </Button>
        </div>
      )}

      {/* TAB 3: Customer Bookings Feed */}
      {activeTab === 'BOOKINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              All Customer Reservations for Your Facilities
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              Total: {bookings.length}
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No customer bookings recorded yet for your facilities.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Scheduled Slot</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        #{b.id?.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {b.toilet?.name || 'Restroom Facility'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {b.user?.fullName || 'Traveler'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(b.scheduledDate)} ({b.startTime?.slice(0, 5)} -{' '}
                        {b.endTime?.slice(0, 5)})
                      </td>
                      <td className="py-3.5 px-4 font-bold text-teal-700">
                        {formatCurrency(b.amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={b.status} size="sm" withDot>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tracking-wider">
                        {b.token}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create / Edit Toilet Facility */}
      <ToiletFormModal
        isOpen={isToiletModalOpen}
        onClose={() => setIsToiletModalOpen(false)}
        toilet={editingToilet}
        onSaved={loadOwnerData}
      />

      {/* MODAL 2: Operating Hours */}
      <OperatingHoursModal
        isOpen={!!hoursToilet}
        onClose={() => setHoursToilet(null)}
        toilet={hoursToilet}
        onSaved={loadOwnerData}
      />

      {/* MODAL 3: Amenities Manager */}
      <AmenitiesModal
        isOpen={!!amenitiesToilet}
        onClose={() => setAmenitiesToilet(null)}
        toilet={amenitiesToilet}
        onSaved={loadOwnerData}
      />

      {/* MODAL 4: Image Uploader */}
      <ImageUploadModal
        isOpen={!!uploadToilet}
        onClose={() => setUploadToilet(null)}
        toilet={uploadToilet}
        onSaved={loadOwnerData}
      />

      {/* MODAL 5: Turnstile Gate & Token Validator */}
      <TokenVerificationModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSessionUpdated={loadOwnerData}
      />
    </div>
  );
}
