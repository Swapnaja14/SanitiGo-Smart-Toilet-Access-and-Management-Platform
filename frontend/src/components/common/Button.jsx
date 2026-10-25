import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  type = 'button',
  ...props
}) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed select-none active:scale-[0.98] rounded-xl';

  const variants = {
    primary:
      'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-md shadow-brand-500/20 focus:ring-brand-500 hover:shadow-glow',
    secondary:
      'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-md focus:ring-slate-900',
    accent:
      'bg-accent-600 hover:bg-accent-700 active:bg-accent-800 text-white shadow-md shadow-accent-600/20 focus:ring-accent-500 hover:shadow-glow-accent',
    outline:
      'border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 focus:ring-brand-500',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 focus:ring-brand-500',
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 focus:ring-rose-500',
    success:
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/20 focus:ring-emerald-500',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',
    sm: 'px-3.5 py-1.5 text-xs font-semibold gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        baseStyles,
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Please wait...</span>
        </>
      ) : (
        <>
          {LeftIcon && <LeftIcon className="w-4 h-4 flex-shrink-0" />}
          <span>{children}</span>
          {RightIcon && <RightIcon className="w-4 h-4 flex-shrink-0" />}
        </>
      )}
    </button>
  );
}
