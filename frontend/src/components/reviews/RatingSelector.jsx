import React, { useState } from 'react';
import { Star } from 'lucide-react';

const RATING_LABELS = {
  1: 'Poor - Did not meet hygiene standards',
  2: 'Fair - Needs better sanitization',
  3: 'Good - Standard public restroom',
  4: 'Very Good - Clean and well maintained',
  5: 'Excellent - Spotless, pristine & touchless',
};

export default function RatingSelector({ value = 5, onChange, disabled = false }) {
  const [hoverRating, setHoverRating] = useState(0);

  const activeRating = hoverRating || value;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => !disabled && setHoverRating(star)}
            onMouseLeave={() => !disabled && setHoverRating(0)}
            className={`p-1 rounded-lg transition-transform focus:outline-none ${
              disabled ? 'cursor-default' : 'hover:scale-110 active:scale-95'
            }`}
            title={`${star} Star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= activeRating
                  ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                  : 'text-slate-200 fill-slate-100 hover:text-amber-200'
              }`}
            />
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-teal-800 transition-all min-h-[1.25rem]">
        {activeRating > 0 ? RATING_LABELS[activeRating] : 'Select your hygiene rating'}
      </p>
    </div>
  );
}
