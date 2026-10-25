import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Edit3,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ReviewCard from './ReviewCard';
import ReviewFormModal from './ReviewFormModal';
import reviewsApi from '../../api/reviews.api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { extractErrorMessage } from '../../utils/errors';

export default function ToiletReviewsSection({ toiletId, toilet, onRatingUpdated }) {
  const { user, isAuthenticated } = useAuth();
  const { success, error: showErrorToast, info } = useToast();

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    averageRating: toilet?.averageRating || 0,
    totalReviews: toilet?.totalReviews || 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const fetchReviews = useCallback(async () => {
    if (!toiletId) return;
    setIsLoading(true);
    try {
      const res = await reviewsApi.getToiletReviews(toiletId, { limit: 50 });
      const data = res?.data || res;
      const list = data?.reviews || [];
      setReviews(Array.isArray(list) ? list : []);

      if (data?.summary) {
        setSummary(data.summary);
        onRatingUpdated?.(data.summary);
      }
    } catch (err) {
      console.warn('Reviews fetch notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toiletId, onRatingUpdated]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Check if current logged-in user already wrote a review for this toilet
  const myReview = reviews.find(
    (r) => user?.id && (r.userId === user.id || r.user?.id === user.id)
  );

  const handleOpenWriteModal = () => {
    if (!isAuthenticated) {
      info('Please sign in to share your hygiene review.');
      return;
    }
    setEditingReview(myReview || null);
    setIsModalOpen(true);
  };

  const handleEditReview = (rev) => {
    setEditingReview(rev);
    setIsModalOpen(true);
  };

  const handleDeleteReview = async (rev) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      await reviewsApi.deleteReview(rev.id);
      success('Review deleted successfully.');
      fetchReviews();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    }
  };

  const handleReviewSaved = () => {
    fetchReviews();
  };

  // Rating distribution calculation
  const totalCount = reviews.length || summary.totalReviews || 0;
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    ratingCounts[star] = (ratingCounts[star] || 0) + 1;
  });

  const avgScore = Number(summary.averageRating || toilet?.averageRating || 0).toFixed(1);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-8">
      {/* Header & Overall Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Hygiene Reviews & Ratings
            </h2>
            <Badge variant="brand" size="sm">
              Verified Feedback
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real customer ratings verified through completed turnstile sessions
          </p>
        </div>

        <Button
          variant={myReview ? 'outline' : 'primary'}
          size="md"
          leftIcon={myReview ? Edit3 : Star}
          onClick={handleOpenWriteModal}
        >
          {myReview ? 'Edit My Review' : 'Write a Review'}
        </Button>
      </div>

      {/* Aggregate Score & Distribution Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl bg-slate-50 border border-slate-200/80 items-center">
        {/* Big Score Box */}
        <div className="text-center md:text-left space-y-1">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-4xl sm:text-5xl font-black text-slate-900">
              {avgScore}
            </span>
            <span className="text-sm font-bold text-slate-400">/ 5.0</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 text-amber-400 pt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  s <= Math.round(Number(avgScore))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 fill-slate-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Based on <strong>{totalCount}</strong> verified ratings
          </p>
        </div>

        {/* 5-Star Distribution Bars */}
        <div className="md:col-span-2 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingCounts[star] || 0;
            const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-slate-600 font-semibold flex items-center gap-1">
                  {star} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400 font-medium">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Loading customer reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-600">
              No written reviews yet for this restroom facility.
            </p>
            <p>
              Visited this smart pod? Share your hygiene feedback to help other travelers!
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {reviews.map((rev) => (
              <ReviewCard
                key={rev.id}
                review={rev}
                currentUserId={user?.id}
                onEdit={handleEditReview}
                onDelete={handleDeleteReview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review Modal Form */}
      <ReviewFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingReview(null);
        }}
        toiletId={toiletId}
        toiletName={toilet?.name}
        existingReview={editingReview}
        onSubmitted={handleReviewSaved}
      />
    </div>
  );
}
