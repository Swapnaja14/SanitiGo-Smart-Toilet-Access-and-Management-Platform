import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Heart, MapPin, CheckCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-teal-300 p-0.5 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Saniti<span className="text-teal-400">Go</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering urban hygiene with instant booking, verified sanitary standards, and secure digital token access for smart public and commercial restrooms.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </div>
          </div>

          {/* Quick Links: Platform */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Explore Platform
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link to="/" className="hover:text-teal-400 transition-colors">
                  Find Nearby Restrooms
                </Link>
              </li>
              <li>
                <Link to="/customer/bookings" className="hover:text-teal-400 transition-colors">
                  Customer Booking Portal
                </Link>
              </li>
              <li>
                <Link to="/owner/dashboard" className="hover:text-teal-400 transition-colors">
                  Toilet Owner Registration
                </Link>
              </li>
              <li>
                <Link to="/admin/dashboard" className="hover:text-teal-400 transition-colors">
                  Admin Inspection Suite
                </Link>
              </li>
            </ul>
          </div>

          {/* Standards & Hygiene */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Sanitation Standards
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Digitally Verified Cleanliness</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Single-Use Entry QR Tokens</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Instant UPI & Razorpay Checkout</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Transparent Community Reviews</span>
              </li>
            </ul>
          </div>

          {/* Security & Support */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Security & Compliance
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Built on enterprise-grade transactional outbox architecture with 256-bit SSL encryption and automated reconciliation.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-teal-400" />
              <span>PCI-DSS Compliant Gateway</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© {new Date().getFullYear()} SanitiGo Smart Toilet Technologies. All rights reserved.</p>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Built with care for public health</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
          </div>
        </div>
      </div>
    </footer>
  );
}
