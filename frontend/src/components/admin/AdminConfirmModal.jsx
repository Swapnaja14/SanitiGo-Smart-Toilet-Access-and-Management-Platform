import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

export default function AdminConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm Action',
  confirmVariant = 'danger',
  loading = false,
  targetDetails = null,
}) {
  const isDanger = confirmVariant === 'danger';
  const isSuccess = confirmVariant === 'success';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDanger
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : isSuccess
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-brand-50 text-brand-600 border border-brand-200'
            }`}
          >
            {isDanger ? (
              <ShieldAlert className="w-5 h-5" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
          </div>
        </div>

        {targetDetails && (
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1.5">
            <p className="font-semibold text-slate-800">Target Resource Details:</p>
            {Object.entries(targetDetails).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-slate-600">
                <span className="capitalize">{key}:</span>
                <span className="font-medium text-slate-900">{String(val)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
