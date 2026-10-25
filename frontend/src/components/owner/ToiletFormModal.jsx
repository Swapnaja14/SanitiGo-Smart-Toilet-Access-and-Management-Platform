import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Compass,
  Navigation,
  IndianRupee,
  Users,
  AlertCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import ownerApi from '../../api/owner.api';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function ToiletFormModal({ isOpen, onClose, toilet, onSaved }) {
  const { success, error: showErrorToast, info } = useToast();
  const isEditing = !!toilet;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    latitude: '',
    longitude: '',
    price: 20,
    capacity: 1,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (toilet) {
      setFormData({
        name: toilet.name || '',
        description: toilet.description || '',
        address: toilet.address || '',
        city: toilet.city || '',
        state: toilet.state || '',
        country: toilet.country || 'India',
        postalCode: toilet.postalCode || '',
        latitude: toilet.latitude !== undefined ? String(toilet.latitude) : '',
        longitude: toilet.longitude !== undefined ? String(toilet.longitude) : '',
        price: toilet.price !== undefined ? Number(toilet.price) : 20,
        capacity: toilet.capacity !== undefined ? Number(toilet.capacity) : 1,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        address: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        latitude: '18.9220',
        longitude: '72.8347',
        price: 20,
        capacity: 2,
      });
    }
    setErrors({});
  }, [toilet, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showErrorToast('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    info('Retrieving GPS coordinates from device...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        success('GPS coordinates retrieved successfully!');
      },
      (err) => {
        setIsLocating(false);
        showErrorToast(`Unable to retrieve location: ${err.message}`);
      },
      { timeout: 10000 }
    );
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Toilet name must be at least 2 characters';
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errs.address = 'Address must be at least 5 characters';
    }
    if (!formData.city.trim()) errs.city = 'City is required';
    if (!formData.state.trim()) errs.state = 'State is required';
    if (!formData.country.trim()) errs.country = 'Country is required';
    if (!formData.postalCode.trim() || formData.postalCode.trim().length < 3) {
      errs.postalCode = 'Postal code is required (min 3 chars)';
    }

    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errs.latitude = 'Latitude must be between -90 and 90';
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errs.longitude = 'Longitude must be between -180 and 180';
    }

    const price = Number(formData.price);
    if (isNaN(price) || price < 0) {
      errs.price = 'Price cannot be negative';
    }

    const cap = Number(formData.capacity);
    if (isNaN(cap) || cap < 1) {
      errs.capacity = 'Capacity must be at least 1 person';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim(),
        postalCode: formData.postalCode.trim(),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        price: Number(formData.price),
        capacity: Number(formData.capacity),
      };

      let result;
      if (isEditing) {
        result = await ownerApi.updateToilet(toilet.id, payload);
        success('Toilet facility updated successfully!');
      } else {
        result = await ownerApi.createToilet(payload);
        success('New toilet facility registered successfully!');
      }

      onSaved?.(result?.data || result);
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err);
      showErrorToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Toilet Facility' : 'Register New Toilet Facility'}
      subtitle={isEditing ? `Updating ${toilet.name}` : 'Add clean verified smart restroom pod to SanitiGo network'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Facility Name"
              name="name"
              placeholder="e.g. Bandra Smart Pod & Sanitation Hub"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              leftIcon={Building2}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              value={formData.description}
              onChange={handleChange}
              placeholder="Features, hygiene protocols, landmarks, or special access instructions..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Street Address"
              name="address"
              placeholder="e.g. Near Platform 1, Bandra West Station"
              value={formData.address}
              onChange={handleChange}
              error={errors.address}
              leftIcon={MapPin}
              required
            />
          </div>

          <div>
            <Input
              label="City"
              name="city"
              placeholder="e.g. Mumbai"
              value={formData.city}
              onChange={handleChange}
              error={errors.city}
              required
            />
          </div>

          <div>
            <Input
              label="State"
              name="state"
              placeholder="e.g. Maharashtra"
              value={formData.state}
              onChange={handleChange}
              error={errors.state}
              required
            />
          </div>

          <div>
            <Input
              label="Postal / PIN Code"
              name="postalCode"
              placeholder="e.g. 400050"
              value={formData.postalCode}
              onChange={handleChange}
              error={errors.postalCode}
              required
            />
          </div>

          <div>
            <Input
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              error={errors.country}
              required
            />
          </div>
        </div>

        {/* GPS Coordinates & Current Location Helper */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-800">GPS Coordinates (Map Accuracy)</span>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              name="latitude"
              placeholder="18.9220"
              value={formData.latitude}
              onChange={handleChange}
              error={errors.latitude}
              required
            />
            <Input
              label="Longitude"
              name="longitude"
              placeholder="72.8347"
              value={formData.longitude}
              onChange={handleChange}
              error={errors.longitude}
              required
            />
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Single Entry Fare (₹ INR)"
            type="number"
            name="price"
            min={0}
            step={1}
            value={formData.price}
            onChange={handleChange}
            error={errors.price}
            leftIcon={IndianRupee}
            required
          />

          <Input
            label="Simultaneous Capacity"
            type="number"
            name="capacity"
            min={1}
            step={1}
            value={formData.capacity}
            onChange={handleChange}
            error={errors.capacity}
            leftIcon={Users}
            required
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Register Facility'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
