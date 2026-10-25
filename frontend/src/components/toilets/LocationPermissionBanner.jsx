import React from 'react';
import { AlertCircle, MapPin, X } from 'lucide-react';

export default function LocationPermissionBanner({ status, onDismiss, onSelectCity }) {
  if (!status || status === 'granted' || status === 'idle') return null;

  return (
    <div className="w-full mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50/90 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold">
            {status === 'denied'
              ? 'GPS Location Access Denied'
              : 'Unable to Retrieve Current Location'}
          </h4>
          <p className="text-xs text-amber-800/90 mt-0.5">
            Allow location permissions in your browser to auto-calculate walking distance, or select a major city below.
          </p>
          <div className="flex items-center gap-2 mt-2">
            {['Mumbai', 'Pune', 'Delhi', 'Bengaluru'].map((city) => (
              <button
                key={city}
                onClick={() => onSelectCity(city)}
                className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-amber-700 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-100/60"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
