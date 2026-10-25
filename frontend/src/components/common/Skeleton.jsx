import React from 'react';
import { cn } from '../../utils/cn';

export default function Skeleton({ className, rounded = 'rounded-lg', ...props }) {
  return (
    <div
      className={cn('animate-pulse bg-slate-200/80', rounded, className)}
      {...props}
    />
  );
}

export function ToiletCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
    </div>
  );
}
