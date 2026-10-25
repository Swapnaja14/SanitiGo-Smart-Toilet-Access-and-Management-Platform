import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    type = 'text',
    required = false,
    className,
    containerClassName,
    id,
    disabled,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={cn('w-full flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-slate-700 tracking-wide flex items-center gap-1"
        >
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {LeftIcon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl transition-all duration-200 placeholder:text-slate-400 text-slate-900',
            'focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            LeftIcon && 'pl-10',
            (RightIcon || isPassword) && 'pr-10',
            error && 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/15 bg-rose-50/20 text-rose-950',
            className
          )}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded focus:outline-none transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : (
          RightIcon && (
            <div className="absolute right-3.5 text-slate-400 pointer-events-none flex items-center">
              <RightIcon className="w-4 h-4" />
            </div>
          )
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
