import React from 'react';
import { cn } from '../../utils/cn';

export default function Badge({
  children,
  variant,
  status,
  size = 'md',
  withDot = false,
  className,
}) {
  // Normalize status string if provided
  const normalizedStatus = (status || children || '').toString().toUpperCase();

  const getVariantStyles = () => {
    if (variant) {
      switch (variant) {
        case 'success':
          return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'warning':
          return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'danger':
          return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'info':
          return 'bg-sky-50 text-sky-700 border-sky-200';
        case 'brand':
          return 'bg-teal-50 text-teal-700 border-teal-200';
        default:
          return 'bg-slate-100 text-slate-700 border-slate-200';
      }
    }

    switch (normalizedStatus) {
      case 'CONFIRMED':
      case 'COMPLETED':
      case 'SUCCESS':
      case 'VERIFIED':
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';

      case 'PENDING':
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200';

      case 'CANCELLED':
      case 'FAILED':
      case 'UNVERIFIED':
      case 'EXPIRED':
        return 'bg-rose-50 text-rose-700 border-rose-200';

      case 'REFUNDED':
        return 'bg-purple-50 text-purple-700 border-purple-200';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getDotColor = () => {
    switch (normalizedStatus) {
      case 'CONFIRMED':
      case 'COMPLETED':
      case 'SUCCESS':
      case 'VERIFIED':
      case 'ACTIVE':
        return 'bg-emerald-500';
      case 'PENDING':
      case 'IN_PROGRESS':
        return 'bg-amber-500';
      case 'CANCELLED':
      case 'FAILED':
      case 'UNVERIFIED':
      case 'EXPIRED':
        return 'bg-rose-500';
      case 'REFUNDED':
        return 'bg-purple-500';
      default:
        return 'bg-slate-500';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold gap-1 rounded-md',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-lg',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border uppercase tracking-wider',
        getVariantStyles(),
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {withDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full animate-pulse', getDotColor())}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
