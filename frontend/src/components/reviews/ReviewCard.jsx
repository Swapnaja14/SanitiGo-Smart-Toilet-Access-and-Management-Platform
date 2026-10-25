import React from 'react';
import { Star, ShieldCheck, Edit, Trash2 } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export default function ReviewCard({ review, currentUserId, onEdit, onDelete }) {
  if (!review) return null;

  const isAuthor =
    currentUserId &&
    (review.userId === currentUserId || review.user?.id === currentUserId);

  const initial = review.user?.fullName
    ? review.user.fullName.charAt(0).toUpperCase()
    : 'U';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition-all space-y-3">
      <div className="flex items-start justify-between gap-3">
        {/* User Info & Rating */}
        <div className="flex items-center gap-3">
          {review.user?.profileImage ? (
            <img
              src={review.user.profileImage}
              alt={review.user.fullName}
              className="w-9 h-9 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm">
              {initial}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {review.user?.fullName || 'Verified Customer'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded-md">
                <ShieldCheck className="w-3 h-3 text-teal-700" />
                Verified Visit
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= review.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                {formatDateTime(review.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Author Actions */}
        {isAuthor && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(review)}
                className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-white rounded-lg transition-colors"
                title="Edit Review"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(review)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                title="Delete Review"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Review Comment */}
      {review.comment && (
        <p className="text-xs text-slate-700 leading-relaxed font-normal pl-12 sm:pl-12">
          {review.comment}
        </p>
      )}
    </div>
  );
}
