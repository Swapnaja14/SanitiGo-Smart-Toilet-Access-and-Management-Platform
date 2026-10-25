import React, { useState, useEffect } from 'react';
import { Clock, Check, Copy, AlertCircle, Sparkles } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import ownerApi from '../../api/owner.api';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DEFAULT_HOURS = DAYS_OF_WEEK.map((day) => ({
  day,
  openingTime: '06:00',
  closingTime: '22:00',
  isClosed: false,
}));

export default function OperatingHoursModal({ isOpen, onClose, toilet, onSaved }) {
  const { success, error: showErrorToast } = useToast();
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (toilet && toilet.operatingHours && toilet.operatingHours.length > 0) {
      // Map existing hours, ensuring all 7 days are present in order
      const mapped = DAYS_OF_WEEK.map((day) => {
        const found = toilet.operatingHours.find(
          (h) =>
            h.day === day ||
            h.day === DAYS_OF_WEEK.indexOf(day) ||
            h.day === (DAYS_OF_WEEK.indexOf(day) + 1) % 7
        );
        return {
          day,
          openingTime: found?.openingTime?.slice(0, 5) || '06:00',
          closingTime: found?.closingTime?.slice(0, 5) || '22:00',
          isClosed: !!found?.isClosed,
        };
      });
      setHours(mapped);
    } else {
      setHours(DEFAULT_HOURS);
    }
  }, [toilet, isOpen]);

  const handleTimeChange = (index, field, value) => {
    setHours((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleToggleClosed = (index) => {
    setHours((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isClosed: !copy[index].isClosed };
      return copy;
    });
  };

  const applyPreset = (openTime, closeTime) => {
    setHours(
      DAYS_OF_WEEK.map((day) => ({
        day,
        openingTime: openTime,
        closingTime: closeTime,
        isClosed: false,
      }))
    );
    success(`Applied ${openTime} - ${closeTime} to all days!`);
  };

  const copyMondayToAll = () => {
    const monday = hours[0];
    setHours(
      DAYS_OF_WEEK.map((day) => ({
        day,
        openingTime: monday.openingTime,
        closingTime: monday.closingTime,
        isClosed: monday.isClosed,
      }))
    );
    success('Copied Monday timetable to all 7 days!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Ensure HH:mm format
      const formatted = hours.map((h) => ({
        day: h.day,
        openingTime: h.openingTime.slice(0, 5),
        closingTime: h.closingTime.slice(0, 5),
        isClosed: Boolean(h.isClosed),
      }));

      const res = await ownerApi.updateOperatingHours(toilet.id, formatted);
      success('Operating hours updated successfully!');
      onSaved?.(res?.data || res);
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err);
      showErrorToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!toilet) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Operating Hours"
      subtitle={`Configure weekly access schedule for ${toilet.name}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Quick Presets Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <span className="text-xs font-bold text-slate-700">Quick Schedules:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => applyPreset('06:00', '23:00')}
              className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100"
            >
              06:00 - 23:00
            </button>
            <button
              type="button"
              onClick={() => applyPreset('00:00', '23:59')}
              className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100"
            >
              24/7 Always Open
            </button>
            <button
              type="button"
              onClick={copyMondayToAll}
              className="text-[11px] font-semibold bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg hover:bg-teal-100 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy Monday to All
            </button>
          </div>
        </div>

        {/* 7 Days Schedule Table */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {hours.map((item, index) => (
            <div
              key={item.day}
              className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.isClosed
                  ? 'bg-slate-50 border-slate-200/70 opacity-60'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-28 flex-shrink-0">
                <span className="text-xs font-black text-slate-800 tracking-wide">
                  {item.day}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Open:</span>
                  <input
                    type="time"
                    disabled={item.isClosed}
                    value={item.openingTime}
                    onChange={(e) => handleTimeChange(index, 'openingTime', e.target.value)}
                    className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Close:</span>
                  <input
                    type="time"
                    disabled={item.isClosed}
                    value={item.closingTime}
                    onChange={(e) => handleTimeChange(index, 'closingTime', e.target.value)}
                    className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end flex-shrink-0">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.isClosed}
                    onChange={() => handleToggleClosed(index)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-600">Closed</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Save Operating Hours
          </Button>
        </div>
      </form>
    </Modal>
  );
}
