import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  Sparkles,
  ShieldCheck,
  QrCode,
  CreditCard,
  Building2,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toiletsApi from '../api/toilets.api';
import ToiletCard from '../components/toilets/ToiletCard';
import ToiletFilterBar from '../components/toilets/ToiletFilterBar';
import LocationPermissionBanner from '../components/toilets/LocationPermissionBanner';
import { ToiletCardSkeleton } from '../components/common/Skeleton';
import Button from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import { extractErrorMessage } from '../utils/errors';

export default function HomePage() {
  const { error: showErrorToast, info, success } = useToast();

  const [toilets, setToilets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 9, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    query: '',
    city: '',
    minRating: undefined,
    maxPrice: undefined,
    isVerified: undefined,
    isAvailable: undefined,
    page: 1,
    limit: 9,
    isNearbyActive: false,
  });

  // Geolocation State
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle' | 'locating' | 'granted' | 'denied' | 'error'
  const [userCoords, setUserCoords] = useState(null);

  // Fetch Toilets based on active filters or nearby coordinates
  const fetchToilets = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      if (filters.isNearbyActive && userCoords) {
        // Nearby API
        const response = await toiletsApi.getNearby({
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          radius: 15,
        });

        const list = response?.data?.toilets || [];
        setToilets(list);
        setPagination({
          page: 1,
          limit: list.length || 9,
          total: list.length,
          totalPages: 1,
        });
      } else {
        // Search API with filters
        const cleanParams = {
          page: filters.page || 1,
          limit: filters.limit || 9,
        };

        if (filters.query?.trim()) cleanParams.query = filters.query.trim();
        if (filters.city?.trim()) cleanParams.city = filters.city.trim();
        if (filters.minRating) cleanParams.minRating = filters.minRating;
        if (filters.maxPrice !== undefined) cleanParams.maxPrice = filters.maxPrice;
        if (filters.isVerified !== undefined) cleanParams.isVerified = filters.isVerified;
        if (filters.isAvailable !== undefined) cleanParams.isAvailable = filters.isAvailable;

        const response = await toiletsApi.search(cleanParams);
        const data = response?.data || {};

        setToilets(data.toilets || []);
        if (data.pagination) {
          setPagination({
            page: data.pagination.page || 1,
            limit: data.pagination.limit || 9,
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || 1,
          });
        }
      }
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      setApiError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [filters, userCoords]);

  useEffect(() => {
    fetchToilets();
  }, [fetchToilets]);

  // Request browser geolocation
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      showErrorToast('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserCoords(coords);
        setLocationStatus('granted');
        setFilters((prev) => ({
          ...prev,
          isNearbyActive: true,
          page: 1,
        }));
        success('Located nearby restrooms using your GPS position!');
      },
      (err) => {
        setLocationStatus(err.code === 1 ? 'denied' : 'error');
        setFilters((prev) => ({ ...prev, isNearbyActive: false }));
        info('Location access unavailable. You can search by city name.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleResetFilters = () => {
    setFilters({
      query: '',
      city: '',
      minRating: undefined,
      maxPrice: undefined,
      isVerified: undefined,
      isAvailable: undefined,
      page: 1,
      limit: 9,
      isNearbyActive: false,
    });
    setUserCoords(null);
    setLocationStatus('idle');
  };

  const handleSelectCity = (city) => {
    setFilters((prev) => ({
      ...prev,
      city,
      isNearbyActive: false,
      page: 1,
    }));
    setLocationStatus('idle');
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 bg-gradient-to-b from-teal-50/60 via-slate-50 to-white">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100/80 border border-teal-200/60 text-teal-800 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Next-Generation Smart Sanitation Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] max-w-4xl mx-auto mb-5">
            Pristine Restrooms,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-500">
              One Tap Away.
            </span>
          </h1>

          <p className="text-base text-slate-600 max-w-2xl mx-auto mb-8 font-normal">
            Find, book, and unlock access to verified, impeccably clean restrooms across commercial facilities, metro hubs, and private partners.
          </p>
        </div>
      </section>

      {/* Main Restroom Discovery Section */}
      <section className="py-10 bg-slate-50 border-t border-slate-200/80 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Location permission fallback banner */}
          <LocationPermissionBanner
            status={locationStatus}
            onDismiss={() => setLocationStatus('idle')}
            onSelectCity={handleSelectCity}
          />

          {/* Interactive Filter Bar */}
          <ToiletFilterBar
            filters={filters}
            onFilterChange={setFilters}
            onResetFilters={handleResetFilters}
            onUseLocation={handleUseLocation}
            isLocating={locationStatus === 'locating'}
            totalResults={pagination.total}
          />

          {/* Results Grid Container */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <ToiletCardSkeleton key={i} />
              ))}
            </div>
          ) : apiError ? (
            /* Error State */
            <div className="bg-white rounded-3xl border border-rose-200 p-12 text-center max-w-lg mx-auto shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Unable to Load Restrooms</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">{apiError}</p>
              <Button variant="primary" size="sm" leftIcon={RefreshCw} onClick={fetchToilets}>
                Retry Search
              </Button>
            </div>
          ) : toilets.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Matching Restrooms Found</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                We couldn't find any clean restrooms matching your current search parameters. Try expanding your search radius or clearing filter filters.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            </div>
          ) : (
            /* Active Results Grid */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {toilets.map((toilet) => (
                  <ToiletCard
                    key={toilet.id}
                    toilet={toilet}
                    distance={toilet.distance !== undefined ? toilet.distance : undefined}
                  />
                ))}
              </div>

              {/* Pagination Controls (if more than 1 page) */}
              {pagination.totalPages > 1 && !filters.isNearbyActive && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    leftIcon={ChevronLeft}
                  >
                    Previous
                  </Button>

                  <span className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: Math.min(pagination.totalPages, prev.page + 1),
                      }))
                    }
                    rightIcon={ChevronRight}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
