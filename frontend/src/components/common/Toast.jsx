import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../utils/cn';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-600 flex-shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
    error: 'border-rose-200 bg-rose-50/90 text-rose-950',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-950',
    info: 'border-sky-200 bg-sky-50/90 text-sky-950',
  };

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none sm:max-w-md"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slide-up',
            borderColors[toast.type] || borderColors.info
          )}
        >
          <div className="mt-0.5">{icons[toast.type] || icons.info}</div>
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="text-sm font-semibold tracking-tight">{toast.title}</h4>
            )}
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
