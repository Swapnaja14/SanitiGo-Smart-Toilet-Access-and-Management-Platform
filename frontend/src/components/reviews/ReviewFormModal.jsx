import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, AlertCircle, Sparkles } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import RatingSelector from './RatingSelector';
import reviewsApi from '../../api/reviews.api';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function ReviewFormModal({
  isOpen,
  onClose,
  toiletId,
  toiletName,
  existingReview,
  bookingId,
  onSubmitted,
}) {
  const { success, error: showErrorToast } = useToast();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
    } else {
      setRating(5);
      setComment('');
    }
    setValidationError(null);
  }, [existingReview, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating || rating < 1 || rating > 5) {
      setValidationError('Please select a star rating between 1 and 5.');
      return;
    }

    if (comment.length > 1000) {
      setValidationError('Comment cannot exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const payload = {
        rating: Number(rating),
        comment: comment.trim() || undefined,
        bookingId: bookingId || undefined,
      };

      const res = await reviewsApi.submitReview(toiletId, payload);
      const data = res?.data?.review || res?.data || res;

      success(
        existingReview
          ? 'Your review has been updated successfully!'
          : 'Thank you for your feedback! Review published.'
      );
      onSubmitted?.(data);
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setValidationError(msg);
      showErrorToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingReview ? 'Update Your Review' : 'Rate Your Restroom Visit'}
      subtitle={toiletName ? `Feedback for ${toiletName}` : 'Share your hygiene experience'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rating Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Cleanliness & Hygiene Rating
          </label>
          <RatingSelector value={rating} onChange={(val) => setRating(val)} />
        </div>

        {/* Comment Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your Comments (Optional)
            </label>
            <span
              className={`text-[10px] font-semibold ${
                comment.length > 900 ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              {comment.length} / 1000
            </span>
          </div>
          <textarea
            rows={4}
            maxLength={1000}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setValidationError(null);
            }}
            placeholder="Tell us about the water pressure, smell, touchless fixtures, cleanliness, soap availability..."
            className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            {existingReview ? 'Save Update' : 'Submit Review'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
