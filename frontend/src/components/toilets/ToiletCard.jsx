import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Accessibility,
  CheckCircle,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import Badge from '../common/Badge';
import Button from '../common/Button';

// Default restroom placeholder images with clean aesthetic
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80';

export default function ToiletCard({ toilet, distance }) {
  if (!toilet) return null;

  // Find primary image or first available
  const primaryImage =
    toilet.images?.find((img) => img.isPrimary)?.imageUrl ||
    toilet.images?.[0]?.imageUrl ||
    FALLBACK_IMAGE;

  // Determine open/closed status for today
  const todayDay = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const todayHours = toilet.operatingHours?.find((h) => h.day === todayDay);
  const isOpen = todayHours ? !todayHours.isClosed : true;

  return (
    <div className="group bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-xl hover:border-teal-300 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Thumbnail & Image Container */}
        <div className="relative h-48 w-full overflow-hidden bg-slate-100">
          <img
            src={primaryImage}
            alt={toilet.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = FALLBACK_IMAGE;
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/20" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
            {toilet.isVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-bold shadow-md backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md backdrop-blur-md ${
                isOpen ? 'bg-teal-600/90 text-white' : 'bg-slate-800/90 text-slate-300'
              }`}
            >
              <Clock className="w-3 h-3" />
              {isOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>

          {/* Top Right Price Tag */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl shadow-md border border-slate-100">
            <span className="text-sm font-black text-slate-900">
              {formatCurrency(toilet.price)}
            </span>
            <span className="text-[10px] text-slate-500 ml-1">/ entry</span>
          </div>

          {/* Distance Indicator */}
          {distance !== undefined && distance !== null && (
            <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-xs font-semibold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-teal-400" />
              <span>{typeof distance === 'number' ? `${distance.toFixed(1)} km away` : distance}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5">
          {/* Rating and Reviews */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{toilet.averageRating ? Number(toilet.averageRating).toFixed(1) : '5.0'}</span>
              <span className="text-slate-400 font-normal">
                ({toilet.totalReviews || 0} reviews)
              </span>
            </div>
            {toilet.city && (
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                {toilet.city}
              </span>
            )}
          </div>

          {/* Name & Address */}
          <h3 className="font-extrabold text-base text-slate-900 mb-1 line-clamp-1 group-hover:text-teal-600 transition-colors">
            {toilet.name}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
            {toilet.address}
          </p>

          {/* Amenities Pills Preview */}
          {toilet.amenities && toilet.amenities.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {toilet.amenities.slice(0, 3).map((item, idx) => {
                const name = item.amenity?.name || item.name || 'Amenity';
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                  >
                    <CheckCircle className="w-3 h-3 text-teal-600" />
                    {name}
                  </span>
                );
              })}
              {toilet.amenities.length > 3 && (
                <span className="text-[11px] text-slate-400 font-medium self-center">
                  +{toilet.amenities.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="p-5 pt-0 mt-2">
        <Link to={`/toilets/${toilet.id}`} className="block w-full">
          <Button variant="primary" size="sm" fullWidth rightIcon={ArrowRight}>
            View Details & Book
          </Button>
        </Link>
      </div>
    </div>
  );
}
