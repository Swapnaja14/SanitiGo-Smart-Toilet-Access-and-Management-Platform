import React, { useState, useEffect } from 'react';
import { Sparkles, Check, AlertCircle, ShieldCheck, Accessibility, Droplet, Users } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ownerApi from '../../api/owner.api';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function AmenitiesModal({ isOpen, onClose, toilet, onSaved }) {
  const { success, error: showErrorToast } = useToast();
  const [allAmenities, setAllAmenities] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchAmenities() {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const res = await ownerApi.getAllAmenities();
        const list = res?.data || res || [];
        setAllAmenities(Array.isArray(list) ? list : []);

        // Initial selected from current toilet
        if (toilet && toilet.amenities) {
          const ids = toilet.amenities.map(
            (ta) => ta.amenityId || ta.amenity?.id || ta.id
          );
          setSelectedIds(ids.filter(Boolean));
        } else {
          setSelectedIds([]);
        }
      } catch (err) {
        showErrorToast(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }

    fetchAmenities();
  }, [toilet, isOpen, showErrorToast]);

  const toggleAmenity = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(allAmenities.map((a) => a.id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await ownerApi.updateAmenities(toilet.id, selectedIds);
      success('Amenities updated successfully!');
      onSaved?.(res?.data || res);
      onClose();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!toilet) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Facility Amenities"
      subtitle={`Select verified features and accessibility aids for ${toilet.name}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">
            Selected: <strong className="text-slate-900">{selectedIds.length}</strong> features
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-teal-700 font-semibold hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-500 font-semibold hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Loading available facility amenities...
          </div>
        ) : allAmenities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No amenities currently registered in the database.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {allAmenities.map((amenity) => {
              const isSelected = selectedIds.includes(amenity.id);
              return (
                <div
                  key={amenity.id}
                  onClick={() => toggleAmenity(amenity.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer select-none transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {amenity.name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                        {amenity.category}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Save Amenities
          </Button>
        </div>
      </form>
    </Modal>
  );
}
