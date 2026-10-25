import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Sparkles, ArrowRight, ShieldCheck, UserCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useForm } from '../../hooks/useForm';
import { extractErrorMessage } from '../../utils/errors';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function LoginPage() {
  const { login } = useAuth();
  const { success, error: showErrorToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const validate = (values) => {
    const errors = {};
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
    return errors;
  };

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    onSubmit: async (values, { setErrors }) => {
      try {
        const user = await login({
          email: values.email.trim(),
          password: values.password,
        });

        success(`Welcome back, ${user.fullName || 'User'}!`);

        // Intelligently route by role if redirecting from default root
        if (from === '/') {
          if (user.role === 'ADMIN') navigate('/admin/dashboard');
          else if (user.role === 'OWNER') navigate('/owner/dashboard');
          else navigate('/customer/bookings');
        } else {
          navigate(from, { replace: true });
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In to SanitiGo</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access your bookings, restrooms, and administrative tools
          </p>
        </div>

        {form.errors.general && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {form.errors.general}
          </div>
        )}

        <form onSubmit={form.handleSubmit} className="space-y-4">
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
            label="Password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
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
            Sign In
          </Button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-600">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-teal-600 hover:text-teal-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
