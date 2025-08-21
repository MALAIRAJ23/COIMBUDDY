import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  runTransaction,
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, RATING_TRIGGERS } from '../firebase/collections';
import { Star, ThumbsUp, ThumbsDown, MessageCircle, Send, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const RatingSystem = ({ 
  tripId, 
  pilotId, 
  buddyId, 
  pilotName, 
  buddyName,
  currentUserId,
  onRatingComplete 
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingTrigger, setRatingTrigger] = useState(null);
  const [tripDetails, setTripDetails] = useState(null);

  // Listen for rating triggers
  useEffect(() => {
    if (!tripId) return;

    const ratingTriggerQuery = query(
      collection(db, COLLECTIONS.TRIP_EVENTS),
      where('tripId', '==', tripId),
      where('type', 'in', [RATING_TRIGGERS.TRIP_COMPLETED, RATING_TRIGGERS.PAYMENT_COMPLETED])
    );

    const unsubscribe = onSnapshot(ratingTriggerQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const trigger = change.doc.data();
          setRatingTrigger(trigger);
          
          // Auto-show rating modal for completed trips
          if (trigger.type === RATING_TRIGGERS.TRIP_COMPLETED) {
            setShowRatingModal(true);
            toast.success('Trip completed! Please rate your experience.');
          }
        }
      });
    });

    return unsubscribe;
  }, [tripId]);

  // Get trip details
  useEffect(() => {
    if (!tripId) return;

    const tripQuery = query(
      collection(db, COLLECTIONS.TRIPS),
      where('__name__', '==', tripId)
    );

    const unsubscribe = onSnapshot(tripQuery, (snapshot) => {
      if (!snapshot.empty) {
        const trip = snapshot.docs[0].data();
        setTripDetails(trip);
      }
    });

    return unsubscribe;
  }, [tripId]);

  // Submit rating with transaction
  const submitRating = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Add rating document
        const ratingData = {
          tripId,
          pilotId,
          buddyId,
          raterId: currentUserId,
          raterName: currentUserId === pilotId ? pilotName : buddyName,
          ratedUserId: currentUserId === pilotId ? buddyId : pilotId,
          ratedUserName: currentUserId === pilotId ? buddyName : pilotName,
          rating,
          comment: comment.trim() || null,
          createdAt: serverTimestamp(),
          trigger: ratingTrigger?.type || 'manual'
        };

        const ratingRef = doc(collection(db, COLLECTIONS.RATINGS));
        transaction.set(ratingRef, ratingData);

        // Update user's average rating
        const userProfileRef = doc(db, COLLECTIONS.USER_PROFILES, ratingData.ratedUserId);
        const userProfileDoc = await transaction.get(userProfileRef);
        
        if (userProfileDoc.exists()) {
          const userData = userProfileDoc.data();
          const currentRatings = userData.totalRatings || 0;
          const currentAverage = userData.averageRating || 0;
          
          const newTotalRatings = currentRatings + 1;
          const newAverageRating = ((currentAverage * currentRatings) + rating) / newTotalRatings;
          
          transaction.update(userProfileRef, {
            totalRatings: newTotalRatings,
            averageRating: parseFloat(newAverageRating.toFixed(1)),
            lastRatedAt: serverTimestamp()
          });
        }

        // Mark rating trigger as processed
        if (ratingTrigger) {
          const triggerRef = doc(db, COLLECTIONS.TRIP_EVENTS, ratingTrigger.id);
          transaction.update(triggerRef, {
            processed: true,
            processedAt: serverTimestamp(),
            ratingId: ratingRef.id
          });
        }

        // Update trip with rating status
        const tripRef = doc(db, COLLECTIONS.TRIPS, tripId);
        transaction.update(tripRef, {
          [`ratedBy.${currentUserId}`]: true,
          [`ratingStatus.${currentUserId}`]: 'completed',
          lastRatedAt: serverTimestamp()
        });
      });

      toast.success('Rating submitted successfully!');
      setShowRatingModal(false);
      setRating(0);
      setComment('');
      
      if (onRatingComplete) {
        onRatingComplete();
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle star click
  const handleStarClick = (starRating) => {
    setRating(starRating);
  };

  // Render stars
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          onClick={() => handleStarClick(i)}
          className={`text-3xl transition-colors ${
            i <= rating ? 'text-yellow-400' : 'text-gray-300'
          } hover:text-yellow-400`}
        >
          ★
        </button>
      );
    }
    return stars;
  };

  // Get rating description
  const getRatingDescription = () => {
    if (rating === 0) return 'Select a rating';
    if (rating === 1) return 'Poor';
    if (rating === 2) return 'Fair';
    if (rating === 3) return 'Good';
    if (rating === 4) return 'Very Good';
    if (rating === 5) return 'Excellent';
  };

  return (
    <>
      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Rate Your Experience
              </h3>
              <p className="text-gray-600">
                How was your ride with{' '}
                <span className="font-semibold">
                  {currentUserId === pilotId ? buddyName : pilotName}
                </span>?
              </p>
            </div>

            {/* Trip Details */}
            {tripDetails && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-500">📍</span>
                    <span>{tripDetails.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">🎯</span>
                    <span>{tripDetails.destination}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rating Stars */}
            <div className="text-center mb-6">
              <div className="flex justify-center gap-2 mb-3">
                {renderStars()}
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {getRatingDescription()}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Comments (Optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows="3"
                maxLength="500"
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {comment.length}/500
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingModal(false)}
                className="flex-1 py-3 px-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={rating === 0 || isSubmitting}
                className="flex-1 py-3 px-4 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Rating'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Summary (if already rated) */}
      {tripDetails?.ratedBy?.[currentUserId] && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <div className="font-semibold text-green-800">Rating Submitted</div>
              <div className="text-sm text-green-600">
                Thank you for rating your experience!
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Rating Trigger Component (for trip completion)
export const RatingTrigger = ({ tripId, triggerType, userId }) => {
  const createRatingTrigger = async () => {
    try {
      const triggerData = {
        tripId,
        type: triggerType,
        userId,
        createdAt: serverTimestamp(),
        processed: false
      };

      await addDoc(collection(db, COLLECTIONS.TRIP_EVENTS), triggerData);
      console.log('Rating trigger created:', triggerType);
    } catch (error) {
      console.error('Error creating rating trigger:', error);
    }
  };

  return null; // This component doesn't render anything
};

// Rating Display Component
export const RatingDisplay = ({ userId, showDetails = false }) => {
  const [userRating, setUserRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const ratingQuery = query(
      collection(db, COLLECTIONS.USER_PROFILES),
      where('__name__', '==', userId)
    );

    const unsubscribe = onSnapshot(ratingQuery, (snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setUserRating({
          averageRating: userData.averageRating || 0,
          totalRatings: userData.totalRatings || 0
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div>;
  }

  if (!userRating) {
    return <span className="text-gray-500 text-sm">No ratings yet</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${
              star <= userRating.averageRating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-sm text-gray-600">
        {userRating.averageRating.toFixed(1)} ({userRating.totalRatings})
      </span>
    </div>
  );
};

export default RatingSystem;
