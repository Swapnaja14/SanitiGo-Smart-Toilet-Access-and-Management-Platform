import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Phone, Sparkles, ArrowRight, Building2, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useForm } from '../../hooks/useForm';
import { extractErrorMessage } from '../../utils/errors';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { cn } from '../../utils/cn';

export default function RegisterPage() {
  const { register } = useAuth();
  const { success, error: showErrorToast } = useToast();
  const navigate = useNavigate();

  const validate = (values) => {
    const errors = {};
    if (!values.fullName?.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!values.email?.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!values.password) {
      errors.password = 'Password is required';
    } else if (values.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (values.phoneNumber && !/^\+?[0-9]{10,14}$/.test(values.phoneNumber.trim())) {
      errors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }

    return errors;
  };

  const form = useForm({
    initialValues: {
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      role: 'USER', // 'USER' (Customer) or 'OWNER'
    },
    validate,
    onSubmit: async (values, { setErrors }) => {
      try {
        const payload = {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
        };
        if (values.phoneNumber?.trim()) {
          payload.phoneNumber = values.phoneNumber.trim();
        }

        const newUser = await register(payload);
        success(`Welcome to SanitiGo, ${newUser.fullName || 'User'}!`);

        if (newUser.role === 'OWNER') {
          navigate('/owner/dashboard');
        } else {
          navigate('/customer/bookings');
        }
      } catch (err) {
        const message = extractErrorMessage(err);
        showErrorToast(message);
        setErrors({ general: message });
      }
    },
  });

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-teal-50/40 to-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 p-0.5 mx-auto mb-3 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create SanitiGo Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose your account type and start in seconds
          </p>
        </div>

        {form.errors.general && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {form.errors.general}
          </div>
        )}

        <form onSubmit={form.handleSubmit} className="space-y-4">
          {/* Account Role Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 tracking-wide block mb-1.5">
              I want to use SanitiGo as a:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => form.setFieldValue('role', 'USER')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all flex flex-col gap-1',
                  form.values.role === 'USER'
                    ? 'border-teal-500 bg-teal-50/70 text-teal-950 ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Users className="w-4 h-4 text-teal-600" />
                  Customer
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">Find & book clean restrooms</span>
              </button>

              <button
                type="button"
                onClick={() => form.setFieldValue('role', 'OWNER')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all flex flex-col gap-1',
                  form.values.role === 'OWNER'
                    ? 'border-teal-500 bg-teal-50/70 text-teal-950 ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  Toilet Owner
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">List & manage facilities</span>
              </button>
            </div>
          </div>

          <Input
            label="Full Name"
            name="fullName"
            type="text"
            required
            placeholder="John Doe"
            leftIcon={User}
            value={form.values.fullName}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.fullName && form.errors.fullName}
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            required
            placeholder="you@domain.com"
            leftIcon={Mail}
            value={form.values.email}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.email && form.errors.email}
          />

          <Input
            label="Phone Number"
            name="phoneNumber"
            type="tel"
            placeholder="+91 9876543210"
            leftIcon={Phone}
            value={form.values.phoneNumber}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.phoneNumber && form.errors.phoneNumber}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            required
            placeholder="At least 6 characters"
            leftIcon={Lock}
            value={form.values.password}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.password && form.errors.password}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="md"
            isLoading={form.isSubmitting}
            rightIcon={ArrowRight}
            className="mt-2"
          >
            Create Account
          </Button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
