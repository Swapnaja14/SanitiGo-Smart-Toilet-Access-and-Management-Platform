import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function LoadingSpinner({
  size = 'md',
  fullPage = false,
  message = 'Loading...',
  className,
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2
        className={cn('text-brand-500 animate-spin', sizeClasses[size] || sizeClasses.md)}
      />
      {message && <p className="text-xs font-medium text-slate-500 tracking-wide">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl border border-slate-200/80 shadow-xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700">{message}</p>
        </div>
      </div>
    );
  }

  return spinner;
}
