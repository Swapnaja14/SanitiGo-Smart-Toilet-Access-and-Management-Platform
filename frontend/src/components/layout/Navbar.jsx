import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  Menu,
  X,
  User,
  LogOut,
  ShieldCheck,
  Building2,
  Calendar,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Button from '../common/Button';
import Badge from '../common/Badge';

export default function Navbar() {
  const { user, isAuthenticated, isCustomer, isOwner, isAdmin, logout } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    success('You have been signed out.');
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-teal-400 p-0.5 shadow-md shadow-brand-500/25 flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none group-hover:text-brand-600 transition-colors">
              Saniti<span className="text-brand-500">Go</span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
              Smart Toilet Access
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isActive('/') ? 'text-brand-600 bg-brand-50/80 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            Find Toilets
          </Link>

          {isAuthenticated && (
            <>
              {isCustomer && (
                <Link
                  to="/customer/bookings"
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    isActive('/customer/bookings')
                      ? 'text-brand-600 bg-brand-50/80 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  My Bookings
                </Link>
              )}

              {isOwner && (
                <Link
                  to="/owner/dashboard"
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    location.pathname.startsWith('/owner')
                      ? 'text-brand-600 bg-brand-50/80 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Owner Portal
                </Link>
              )}

              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    location.pathname.startsWith('/admin')
                      ? 'text-brand-600 bg-brand-50/80 font-semibold'
                      : 'hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Console
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Right Section: Auth State / Profile */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center uppercase">
                  {user?.fullName ? user.fullName.substring(0, 2) : 'SG'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 max-w-[120px] truncate">
                    {user?.fullName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {user?.role || 'CUSTOMER'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-slide-up"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <div className="mt-1">
                      <Badge size="sm" withDot status={user?.role}>
                        {user?.role}
                      </Badge>
                    </div>
                  </div>

                  {isCustomer && (
                    <Link
                      to="/customer/bookings"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-slate-400" />
                      My Bookings & Sessions
                    </Link>
                  )}

                  {isOwner && (
                    <Link
                      to="/owner/dashboard"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-slate-400" />
                      Manage Toilets & Access
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      Admin Control Center
                    </Link>
                  )}

                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile & Security
                  </Link>

                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-6 animate-slide-up">
          <div className="flex flex-col gap-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Find Toilets
            </Link>

            {isAuthenticated ? (
              <>
                {isCustomer && (
                  <Link
                    to="/customer/bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4 text-brand-600" />
                    My Bookings
                  </Link>
                )}

                {isOwner && (
                  <Link
                    to="/owner/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Building2 className="w-4 h-4 text-brand-600" />
                    Owner Portal
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-brand-600" />
                    Admin Console
                  </Link>
                )}

                <div className="border-t border-slate-100 my-2 pt-2">
                  <div className="px-3 py-1 mb-2">
                    <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-500">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg mb-1"
                  >
                    <User className="w-4 h-4 text-brand-600" />
                    Profile & Security
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" fullWidth size="md">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" fullWidth size="md">
                    Create Account
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
