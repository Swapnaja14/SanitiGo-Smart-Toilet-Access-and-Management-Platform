import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Building2,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  ExternalLink,
  User,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { adminApi } from '../../api';
import { useToast } from '../../hooks/useToast';
import Badge from '../common/Badge';
import Button from '../common/Button';
import AdminConfirmModal from './AdminConfirmModal';

export default function ToiletVerificationQueue({ onStatsUpdated }) {
  const { success, error: toastError } = useToast();

  const [toilets, setToilets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('false'); // Default to unverified queue!
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');

  // Verification modal state
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    toilet: null,
    targetVerified: true,
    loading: false,
  });

  const fetchToilets = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminApi.getToilets({
          page,
          limit: 10,
          search,
          isVerified:
            verificationFilter === 'false'
              ? 'false'
              : verificationFilter === 'true'
              ? 'true'
              : undefined,
          isAvailable:
            availabilityFilter === 'true'
              ? 'true'
              : availabilityFilter === 'false'
              ? 'false'
              : undefined,
        });

        setToilets(data.toilets || []);
        setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
      } catch (err) {
        console.error('Failed to fetch toilets for review', err);
        setError(err.response?.data?.message || 'Could not load facilities list.');
      } finally {
        setLoading(false);
      }
    },
    [search, verificationFilter, availabilityFilter]
  );

  useEffect(() => {
    fetchToilets(1);
  }, [fetchToilets]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const openVerifyModal = (toilet, targetVerified) => {
    setConfirmModalState({
      isOpen: true,
      toilet,
      targetVerified,
      loading: false,
    });
  };

  const handleConfirmVerification = async () => {
    const { toilet, targetVerified } = confirmModalState;
    if (!toilet) return;

    try {
      setConfirmModalState((prev) => ({ ...prev, loading: true }));
      const updatedToilet = await adminApi.setToiletVerification(toilet.id, targetVerified);

      setToilets((prev) =>
        prev.map((t) => (t.id === toilet.id ? { ...t, isVerified: updatedToilet.isVerified } : t))
      );

      success(
        `Facility "${toilet.name}" is now ${
          targetVerified ? 'verified and published for customers' : 'unverified and hidden from public search'
        }.`
      );

      setConfirmModalState({ isOpen: false, toilet: null, targetVerified: false, loading: false });
      onStatsUpdated?.();
      // If currently in unverified queue and verified, refresh list
      if (verificationFilter === 'false' && targetVerified) {
        fetchToilets(pagination.page);
      }
    } catch (err) {
      console.error('Failed to verify facility', err);
      toastError(err.response?.data?.message || 'Failed to update toilet verification status.');
      setConfirmModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search facility by name, city or street address..."
            className="w-full pl-10 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
            <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs px-2.5">
              Search
            </Button>
          </div>
        </form>

        {/* Verification Status Selector */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
          >
            <option value="false">Queue: Pending Review Only</option>
            <option value="true">Verified Only</option>
            <option value="ALL">All Facilities</option>
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
          >
            <option value="ALL">All Availability</option>
            <option value="true">Available Now</option>
            <option value="false">Unavailable</option>
          </select>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchToilets(pagination.page)}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Facilities Cards / Queue */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-40" />
                    <div className="h-3 bg-slate-200 rounded w-60" />
                  </div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-28" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 space-y-3">
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchToilets(1)}>
              Retry
            </Button>
          </div>
        ) : toilets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {verificationFilter === 'false'
                ? 'Verification queue is clear'
                : 'No facilities match criteria'}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              {verificationFilter === 'false'
                ? 'All newly registered facility listings have been verified and published.'
                : 'Try adjusting your search terms or availability filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {toilets.map((toilet) => (
              <div
                key={toilet.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                {/* Facility Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                      {toilet.name}
                    </h4>

                    {toilet.isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        Pending Verification
                      </span>
                    )}

                    <Badge size="sm" withDot status={toilet.isAvailable ? 'AVAILABLE' : 'OFFLINE'}>
                      {toilet.isAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>

                  {/* Location & Price */}
                  <div className="flex items-center gap-4 text-slate-500 text-xs flex-wrap">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {toilet.address}, {toilet.city}
                    </span>
                    <span className="font-semibold text-slate-800">
                      ₹{Number(toilet.price).toFixed(2)} / visit
                    </span>
                    {toilet.averageRating > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {Number(toilet.averageRating).toFixed(1)} ({toilet.totalReviews} reviews)
                      </span>
                    )}
                  </div>

                  {/* Owner details */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <User className="w-3 h-3" />
                    <span>Listed by:</span>
                    <span className="font-medium text-slate-700">
                      {toilet.owner?.fullName || 'Owner'}
                    </span>
                    <span>({toilet.owner?.email || 'N/A'})</span>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                  <Link
                    to={`/toilets/${toilet.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                    title="Preview Public Listing"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  {!toilet.isVerified ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openVerifyModal(toilet, true)}
                      icon={ShieldCheck}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 text-xs py-1.5"
                    >
                      Approve & Verify
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openVerifyModal(toilet, false)}
                      icon={ShieldAlert}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-xs py-1.5"
                    >
                      Revoke Verification
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              facilities
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchToilets(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={() => fetchToilets(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Verification Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() =>
          setConfirmModalState({ isOpen: false, toilet: null, targetVerified: false, loading: false })
        }
        onConfirm={handleConfirmVerification}
        loading={confirmModalState.loading}
        title={
          confirmModalState.targetVerified
            ? 'Approve & Verify Facility?'
            : 'Revoke Facility Verification?'
        }
        description={
          confirmModalState.targetVerified
            ? 'Approving this facility certifies hygiene standards and makes it immediately visible in nearby customer search and booking results.'
            : 'Revoking verification removes this toilet from customer search results until re-reviewed by the administration team.'
        }
        confirmText={
          confirmModalState.targetVerified ? 'Confirm & Approve' : 'Revoke Verification'
        }
        confirmVariant={confirmModalState.targetVerified ? 'success' : 'danger'}
        targetDetails={
          confirmModalState.toilet
            ? {
                facility: confirmModalState.toilet.name,
                location: `${confirmModalState.toilet.address}, ${confirmModalState.toilet.city}`,
                owner: confirmModalState.toilet.owner?.fullName || 'N/A',
              }
            : null
        }
      />
    </div>
  );
}
