import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  Save,
  CheckCircle,
  Building2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useForm } from '../../hooks/useForm';
import { extractErrorMessage } from '../../utils/errors';
import { formatDate, formatDateTime } from '../../utils/formatters';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';

export default function ProfilePage() {
  const { user, updateProfile, role } = useAuth();
  const { success, error: showErrorToast } = useToast();

  const validate = (values) => {
    const errors = {};
    if (!values.fullName?.trim()) {
      errors.fullName = 'Full name is required';
    } else if (values.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (values.phoneNumber && !/^[6-9]\d{9}$/.test(values.phoneNumber.trim())) {
      errors.phoneNumber = 'Must be a valid 10-digit Indian mobile number';
    }

    return errors;
  };

  const form = useForm({
    initialValues: {
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
    },
    validate,
    onSubmit: async (values, { setErrors }) => {
      try {
        const updated = await updateProfile({
          fullName: values.fullName.trim(),
          phoneNumber: values.phoneNumber?.trim() || undefined,
        });
        success('Profile updated successfully!');
      } catch (err) {
        const message = extractErrorMessage(err);
        showErrorToast(message);
        setErrors({ general: message });
      }
    },
  });

  // Re-sync form values if user changes
  useEffect(() => {
    if (user) {
      form.setFieldValue('fullName', user.fullName || '');
      form.setFieldValue('phoneNumber', user.phoneNumber || '');
    }
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
      {/* Header Banner */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-navy-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-1 flex items-center justify-center text-white shadow-lg shadow-teal-500/25">
            <span className="text-2xl font-black uppercase">
              {user?.fullName ? user.fullName.substring(0, 2) : 'SG'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black tracking-tight">{user?.fullName || 'User Profile'}</h1>
              <Badge status={user?.isActive ? 'ACTIVE' : 'DEACTIVATED'} withDot size="sm">
                {user?.isActive ? 'ACTIVE' : 'DEACTIVATED'}
              </Badge>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-teal-400" />
              {user?.email}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">
            Access Role
          </span>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold">
            {role === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-teal-400" />}
            {role === 'OWNER' && <Building2 className="w-4 h-4 text-teal-400" />}
            {role === 'USER' && <Users className="w-4 h-4 text-teal-400" />}
            <span>{role === 'USER' ? 'CUSTOMER' : role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Edit Profile Form */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Edit Profile</h2>
              <p className="text-xs text-slate-500">Update your personal account details</p>
            </div>
            <Sparkles className="w-5 h-5 text-teal-500" />
          </div>

          {form.errors.general && (
            <div className="p-3 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {form.errors.general}
            </div>
          )}

          <form onSubmit={form.handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="fullName"
              required
              placeholder="Your name"
              leftIcon={User}
              value={form.values.fullName}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.fullName && form.errors.fullName}
            />

            <Input
              label="Email Address (Linked to Account)"
              name="email"
              type="email"
              disabled
              leftIcon={Mail}
              value={user?.email || ''}
              helperText="Email cannot be changed directly for security and cryptographic verification."
            />

            <Input
              label="Phone Number"
              name="phoneNumber"
              type="tel"
              placeholder="9876543210 (10 digits)"
              leftIcon={Phone}
              value={form.values.phoneNumber}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.phoneNumber && form.errors.phoneNumber}
              helperText="Used for booking access SMS and emergency customer notifications."
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                leftIcon={Save}
                isLoading={form.isSubmitting}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Account & Security Metadata */}
        <div className="space-y-6">
          {/* Account Details Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Account Overview
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Member Since
                </span>
                <span className="font-semibold text-slate-900">
                  {formatDate(user?.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Last Activity
                </span>
                <span className="font-semibold text-slate-900">
                  {formatDateTime(user?.lastLogin || user?.updatedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Verification
                </span>
                <Badge status={user?.isVerified ? 'VERIFIED' : 'PENDING'} size="sm">
                  {user?.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Role Capabilities Card */}
          <div className="bg-gradient-to-br from-teal-50/70 to-slate-50 rounded-3xl border border-teal-200 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-teal-900 uppercase tracking-wider mb-2">
              Role Privileges: {role === 'USER' ? 'CUSTOMER' : role}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {role === 'ADMIN' &&
                'Superuser permissions: Full operational audit, restroom verification, user account state controls, and outbox DLQ monitoring.'}
              {role === 'OWNER' &&
                'Restroom manager: Publish and edit facility listings, verify digital QR tokens at turnstiles, and track customer usage sessions.'}
              {role === 'USER' &&
                'SanitiGo customer: Search verified restrooms, execute contactless bookings, generate entry tokens, and submit hygiene ratings.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
