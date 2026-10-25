import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Users,
  ShieldCheck,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  Building2,
  Ticket,
} from 'lucide-react';
import { adminApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Badge from '../common/Badge';
import Button from '../common/Button';
import AdminConfirmModal from './AdminConfirmModal';

export default function UserDirectory({ onStatsUpdated }) {
  const { user: currentAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deactivation confirmation modal state
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    user: null,
    targetActive: false,
    loading: false,
  });

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminApi.getUsers({
          page,
          limit: 10,
          search,
          role: roleFilter,
          isActive: statusFilter === 'ACTIVE' ? 'true' : statusFilter === 'DEACTIVATED' ? 'false' : undefined,
        });

        setUsers(data.users || []);
        setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
      } catch (err) {
        console.error('Failed to fetch user directory', err);
        setError(err.response?.data?.message || 'Could not load users directory.');
      } finally {
        setLoading(false);
      }
    },
    [search, roleFilter, statusFilter]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const openStatusConfirmModal = (targetUser) => {
    const nextStatus = !targetUser.isActive;
    setConfirmModalState({
      isOpen: true,
      user: targetUser,
      targetActive: nextStatus,
      loading: false,
    });
  };

  const handleConfirmStatusToggle = async () => {
    const { user, targetActive } = confirmModalState;
    if (!user) return;

    try {
      setConfirmModalState((prev) => ({ ...prev, loading: true }));
      const updatedUser = await adminApi.setUserStatus(user.id, targetActive);

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: updatedUser.isActive } : u))
      );

      success(
        `User ${user.fullName} (${user.email}) has been ${
          targetActive ? 'reactivated' : 'deactivated'
        }.`
      );

      setConfirmModalState({ isOpen: false, user: null, targetActive: false, loading: false });
      onStatsUpdated?.();
    } catch (err) {
      console.error('Failed to toggle user status', err);
      toastError(err.response?.data?.message || 'Failed to update user status.');
      setConfirmModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by full name or email address..."
            className="w-full pl-10 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
            <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs px-2.5">
              Search
            </Button>
          </div>
        </form>

        {/* Filter Selectors */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="USER">Customers (USER)</option>
            <option value="OWNER">Facility Owners (OWNER)</option>
            <option value="ADMIN">Administrators (ADMIN)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DEACTIVATED">Deactivated Only</option>
          </select>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchUsers(pagination.page)}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Directory Table / Cards */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-200 rounded w-48" />
                  </div>
                </div>
                <div className="h-6 bg-slate-200 rounded w-20" />
                <div className="h-8 bg-slate-200 rounded w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 space-y-3">
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchUsers(1)}>
              Retry
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No users found</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Try adjusting your search keyword, role, or active status filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">User Details</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Activity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((item) => {
                  const isSelf = item.id === currentAdmin?.id;
                  const initials = item.fullName
                    ? item.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'SG';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* User Info */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                              item.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700'
                                : item.role === 'OWNER'
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-brand-100 text-brand-700'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{item.fullName}</span>
                              {isSelf && (
                                <span className="text-[10px] font-semibold bg-brand-100 text-brand-700 px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-slate-400 text-[11px] mt-0.5">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[180px]">{item.email}</span>
                            </div>
                            {item.phoneNumber && (
                              <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{item.phoneNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4">
                        <Badge
                          size="sm"
                          status={item.role}
                        >
                          {item.role}
                        </Badge>
                      </td>

                      {/* Activity Metrics */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-slate-600 text-[11px]">
                          {item.role === 'OWNER' ? (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-teal-600" />
                              {item._count?.toilets ?? 0} Facilities Listed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Ticket className="w-3 h-3 text-brand-600" />
                              {item._count?.bookings ?? 0} Bookings Made
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <Badge
                          size="sm"
                          withDot
                          status={item.isActive ? 'ACTIVE' : 'EXPIRED'}
                        >
                          {item.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>

                      {/* Registered Date */}
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-slate-400 italic">Self Account</span>
                        ) : item.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusConfirmModal(item)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-xs py-1"
                            icon={UserX}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusConfirmModal(item)}
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-xs py-1"
                            icon={UserCheck}
                          >
                            Reactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
              accounts
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() =>
          setConfirmModalState({ isOpen: false, user: null, targetActive: false, loading: false })
        }
        onConfirm={handleConfirmStatusToggle}
        loading={confirmModalState.loading}
        title={
          confirmModalState.targetActive
            ? 'Reactivate User Account?'
            : 'Deactivate User Account?'
        }
        description={
          confirmModalState.targetActive
            ? 'This will restore platform login privileges and allow the user to make bookings or manage facility listings.'
            : 'Deactivating this user will revoke their session token and immediately prevent them from signing in or operating on the platform.'
        }
        confirmText={confirmModalState.targetActive ? 'Confirm Activation' : 'Deactivate Account'}
        confirmVariant={confirmModalState.targetActive ? 'success' : 'danger'}
        targetDetails={
          confirmModalState.user
            ? {
                name: confirmModalState.user.fullName,
                email: confirmModalState.user.email,
                role: confirmModalState.user.role,
              }
            : null
        }
      />
    </div>
  );
}
