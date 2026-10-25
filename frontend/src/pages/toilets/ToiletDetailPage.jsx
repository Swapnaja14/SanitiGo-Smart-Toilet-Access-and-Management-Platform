import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Star,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Calendar,
  CreditCard,
  QrCode,
  ArrowLeft,
  Share2,
  Heart,
  Navigation,
  Accessibility,
  Droplet,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import toiletsApi from '../../api/toilets.api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import BookingModal from '../../components/bookings/BookingModal';
import ToiletReviewsSection from '../../components/reviews/ToiletReviewsSection';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ToiletDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { success, info, error: showErrorToast } = useToast();

  const [toilet, setToilet] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchToiletData() {
      setIsLoading(true);
      setError(null);
      try {
        const [toiletRes, reviewsRes] = await Promise.all([
          toiletsApi.getById(id),
          toiletsApi.getReviews(id).catch(() => ({ data: { reviews: [] } })),
        ]);

        if (isMounted) {
          setToilet(toiletRes.data);
          const reviewList = reviewsRes?.data?.reviews || reviewsRes?.data || [];
          setReviews(Array.isArray(reviewList) ? reviewList : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(extractErrorMessage(err));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (id) {
      fetchToiletData();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return <LoadingSpinner fullPage message="Loading restroom facility details..." />;
  }

  if (error || !toilet) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Restroom Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">{error || 'This restroom facility does not exist or was unlisted.'}</p>
        <Link to="/">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to Restroom Search
          </Button>
        </Link>
      </div>
    );
  }

  const images = toilet.images && toilet.images.length > 0 ? toilet.images : [{ imageUrl: FALLBACK_IMAGE }];
  const activeImage = images[activeImageIndex]?.imageUrl || FALLBACK_IMAGE;

  const todayDayIndex = new Date().getDay();
  const todayHours = toilet.operatingHours?.find((h) => h.day === todayDayIndex);
  const isOpenNow = todayHours ? !todayHours.isClosed : true;

  const handleBookNow = () => {
    if (!isAuthenticated) {
      info('Please sign in or create an account to book your restroom pass.');
      navigate('/login', { state: { from: { pathname: `/toilets/${id}` } } });
      return;
    }
    setIsBookingModalOpen(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: toilet.name,
        text: `Clean verified restroom: ${toilet.name} on SanitiGo`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      success('Restroom link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {/* Top Breadcrumb & Share */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Results</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={Share2} onClick={handleShare}>
            Share
          </Button>
        </div>
      </div>

      {/* Main Grid: Gallery & Info vs Sticky Booking Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Media Gallery & Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Photo Gallery */}
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
            {/* Primary Hero Image */}
            <div className="relative h-72 sm:h-96 w-full bg-slate-900 overflow-hidden">
              <img
                src={activeImage}
                alt={toilet.name}
                className="w-full h-full object-cover transition-all duration-300"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = FALLBACK_IMAGE;
                }}
              />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                {toilet.isVerified && (
                  <Badge variant="success" size="md" withDot>
                    Verified Cleanliness
                  </Badge>
                )}
                <Badge variant={isOpenNow ? 'brand' : 'warning'} size="md">
                  {isOpenNow ? 'Open Now' : 'Closed'}
                </Badge>
              </div>
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="p-3 bg-slate-50 flex items-center gap-2.5 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      activeImageIndex === idx
                        ? 'border-teal-500 ring-2 ring-teal-500/20'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.imageUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title & Overview Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
                  {toilet.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  {toilet.address}, {toilet.city}, {toilet.state} {toilet.postalCode}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-amber-900 font-bold text-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{toilet.averageRating ? Number(toilet.averageRating).toFixed(1) : '5.0'}</span>
                  <span className="text-xs font-normal text-amber-700">
                    ({toilet.totalReviews || 0} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {toilet.description && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  About this Restroom Facility
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {toilet.description}
                </p>
              </div>
            )}

            {/* Facility Highlights Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50">
                <p className="text-slate-400 font-medium text-[11px]">Sanitary Verification</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {toilet.isVerified ? 'Audit Passed' : 'Pending Verification'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50">
                <p className="text-slate-400 font-medium text-[11px]">Access Mode</p>
                <p className="font-bold text-slate-900 mt-0.5">Digital QR Turnstile</p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50">
                <p className="text-slate-400 font-medium text-[11px]">Entry Price</p>
                <p className="font-bold text-teal-600 mt-0.5">
                  {formatCurrency(toilet.price)} / visit
                </p>
              </div>
            </div>
          </div>

          {/* Amenities Section */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
              Hygiene & Comfort Amenities
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Standardized sanitary facilities available on-site
            </p>

            {toilet.amenities && toilet.amenities.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {toilet.amenities.map((item, idx) => {
                  const name = item.amenity?.name || item.name || 'Sanitation Amenity';
                  const category = item.amenity?.category || 'Standard';
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100"
                    >
                      <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {category}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Standard sanitization equipment and water supply provided.
              </p>
            )}
          </div>

          {/* Operating Hours Timetable */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 tracking-tight mb-1">
              Operating Schedule
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Current gate access and maintenance schedule
            </p>

            <div className="divide-y divide-slate-100 text-xs">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const hours = toilet.operatingHours?.find((h) => h.day === dayIndex);
                const isToday = dayIndex === todayDayIndex;

                return (
                  <div
                    key={dayIndex}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-between ${
                      isToday ? 'bg-teal-50/80 font-bold text-teal-950' : 'text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {dayName}
                      {isToday && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-600 text-white font-bold">
                          Today
                        </span>
                      )}
                    </span>
                    <span>
                      {hours?.isClosed
                        ? 'Closed'
                        : hours?.openingTime && hours?.closingTime
                        ? `${hours.openingTime} - ${hours.closingTime}`
                        : '24 Hours'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews & Ratings Section */}
          <ToiletReviewsSection
            toiletId={id}
            toilet={toilet}
            onRatingUpdated={(newSummary) => {
              setToilet((prev) => ({
                ...prev,
                averageRating: newSummary.averageRating,
                totalReviews: newSummary.totalReviews,
              }));
            }}
          />
        </div>

        {/* Right Column: Sticky Booking Action Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500 font-medium">Single-Entry Access Pass</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                  {formatCurrency(toilet.price)}
                </p>
              </div>
              <Badge variant={isOpenNow ? 'brand' : 'warning'} size="sm">
                {isOpenNow ? 'Available' : 'Closed'}
              </Badge>
            </div>

            {/* Inclusions list */}
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Instant SG- Digital Entry Token</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Guaranteed sanitization protocol</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Valid for up to 2 hours after booking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Seamless UPI / Card checkout</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleBookNow}
              disabled={!isOpenNow}
              className="py-3 shadow-glow"
            >
              {isOpenNow ? 'Book Restroom Pass' : 'Currently Closed'}
            </Button>

            <p className="text-[11px] text-center text-slate-400">
              100% money-back guarantee if the facility is unavailable or does not meet cleanliness standards.
            </p>
          </div>
        </div>
      </div>

      {/* Booking Checkout & Token Pass Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        toilet={toilet}
        onBookingSuccess={() => {
          // Booking confirmed, modal displays token pass
        }}
      />
    </div>
  );
}
