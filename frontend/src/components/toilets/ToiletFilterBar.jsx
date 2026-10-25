import React, { useState } from 'react';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  RotateCcw,
  Navigation,
  Loader2,
  ShieldCheck,
  Star,
  IndianRupee,
} from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';

export default function ToiletFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  onUseLocation,
  isLocating = false,
  totalResults = 0,
}) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleInputChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value, page: 1 });
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-sm mb-8 transition-all">
      {/* Primary Search Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Keyword Search */}
        <div className="flex-1">
          <Input
            placeholder="Search by restroom name, landmark, or street..."
            leftIcon={Search}
            value={filters.query || ''}
            onChange={(e) => handleInputChange('query', e.target.value)}
            className="py-2.5 text-sm"
          />
        </div>

        {/* City Filter */}
        <div className="w-full md:w-56">
          <Input
            placeholder="City (e.g. Mumbai, Pune)..."
            leftIcon={MapPin}
            value={filters.city || ''}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className="py-2.5 text-sm"
          />
        </div>

        {/* Action Buttons: Geolocation and Filter Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={onUseLocation}
            disabled={isLocating}
            className="flex-1 md:flex-initial"
            title="Locate nearby restrooms using GPS"
          >
            {isLocating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span className="hidden sm:inline">Locating...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 text-teal-600" />
                <span className="hidden sm:inline">Nearby GPS</span>
              </>
            )}
          </Button>

          <Button
            variant={isAdvancedOpen ? 'secondary' : 'outline'}
            size="md"
            onClick={() => setIsAdvancedOpen((prev) => !prev)}
            leftIcon={SlidersHorizontal}
            className="flex-1 md:flex-initial"
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Advanced Filter Collapsible Drawer */}
      {isAdvancedOpen && (
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          {/* Max Price Slider/Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Max Price</span>
              <span className="text-teal-600 font-bold">
                {filters.maxPrice ? `₹${filters.maxPrice}` : 'Any'}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.maxPrice || 100}
              onChange={(e) =>
                handleInputChange(
                  'maxPrice',
                  Number(e.target.value) === 100 ? undefined : Number(e.target.value)
                )
              }
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>₹0</span>
              <span>₹50</span>
              <span>₹100+</span>
            </div>
          </div>

          {/* Min Rating Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Minimum Rating
            </label>
            <select
              value={filters.minRating || ''}
              onChange={(e) =>
                handleInputChange(
                  'minRating',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800"
            >
              <option value="">Any Rating</option>
              <option value="4.5">★ 4.5 & Above (Super Clean)</option>
              <option value="4.0">★ 4.0 & Above (Very Good)</option>
              <option value="3.0">★ 3.0 & Above</option>
            </select>
          </div>

          {/* Checkboxes: Verified Only & Open Now */}
          <div className="flex flex-col justify-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!filters.isVerified}
                onChange={(e) => handleInputChange('isVerified', e.target.checked ? true : undefined)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Restrooms Only
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!filters.isAvailable}
                onChange={(e) => handleInputChange('isAvailable', e.target.checked ? true : undefined)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              <span>Available & Open Now</span>
            </label>
          </div>

          {/* Reset Filters CTA */}
          <div className="flex items-end justify-start sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              leftIcon={RotateCcw}
              className="text-slate-500 hover:text-slate-800 text-xs"
            >
              Reset All Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Counter & Active Criteria */}
      <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
        <span>
          Showing <strong>{totalResults}</strong> clean restroom facility results
        </span>
        {filters.isNearbyActive && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
            <Navigation className="w-3 h-3 text-teal-600" />
            Sorted by GPS Proximity
          </span>
        )}
      </div>
    </div>
  );
}
