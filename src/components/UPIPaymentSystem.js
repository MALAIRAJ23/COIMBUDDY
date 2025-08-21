import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, PAYMENT_STATUS } from '../firebase/collections';
import { CreditCard, Smartphone, QrCode, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const UPIPaymentSystem = ({ 
  tripId, 
  pilotId, 
  buddyId, 
  amount, 
  pilotUPI, 
  onPaymentComplete,
  onPaymentStatusChange 
}) => {
  const [paymentStatus, setPaymentStatus] = useState(PAYMENT_STATUS.PENDING);
  const [paymentId, setPaymentId] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);

  // UPI deep link generators
  const generateUPIDeepLink = (upiId, amount, description) => {
    const encodedDescription = encodeURIComponent(description);
    return `upi://pay?pa=${upiId}&am=${amount}&tn=${encodedDescription}&cu=INR`;
  };

  const generatePhonePeLink = (upiId, amount, description) => {
    const encodedDescription = encodeURIComponent(description);
    return `phonepe://pay?pa=${upiId}&am=${amount}&tn=${encodedDescription}&cu=INR`;
  };

  const generatePaytmLink = (upiId, amount, description) => {
    const encodedDescription = encodeURIComponent(description);
    return `paytmmp://pay?pa=${upiId}&am=${amount}&tn=${encodedDescription}&cu=INR`;
  };

  const generateGooglePayLink = (upiId, amount, description) => {
    const encodedDescription = encodeURIComponent(description);
    return `googlepay://pay?pa=${upiId}&am=${amount}&tn=${encodedDescription}&cu=INR`;
  };

  // Initialize payment
  useEffect(() => {
    if (tripId && amount && pilotUPI) {
      initializePayment();
    }
  }, [tripId, amount, pilotUPI]);

  // Listen to payment status changes
  useEffect(() => {
    if (!paymentId) return;

    const paymentQuery = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where('paymentId', '==', paymentId)
    );

    const unsubscribe = onSnapshot(paymentQuery, (snapshot) => {
      if (!snapshot.empty) {
        const payment = snapshot.docs[0].data();
        setPaymentStatus(payment.status);
        setPaymentDetails(payment);
        
        if (payment.status === PAYMENT_STATUS.COMPLETED) {
          onPaymentComplete(payment);
          toast.success('Payment completed successfully!');
        } else if (payment.status === PAYMENT_STATUS.FAILED) {
          toast.error('Payment failed. Please try again.');
        }
        
        onPaymentStatusChange(payment.status);
      }
    });

    return unsubscribe;
  }, [paymentId, onPaymentComplete, onPaymentStatusChange]);

  // Initialize payment in Firestore
  const initializePayment = async () => {
    try {
      const paymentData = {
        tripId,
        pilotId,
        buddyId,
        amount: parseFloat(amount),
        pilotUPI,
        status: PAYMENT_STATUS.PENDING,
        paymentMethod: 'upi',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        description: `Car Pooling Payment - Trip ${tripId}`
      };

      const paymentRef = await addDoc(collection(db, COLLECTIONS.PAYMENTS), paymentData);
      setPaymentId(paymentRef.id);
      
      // Update trip with payment initiated
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
        paymentInitiated: true,
        paymentId: paymentRef.id,
        paymentStatus: PAYMENT_STATUS.PENDING
      });

      toast.success('Payment initialized. Please complete the payment.');
    } catch (error) {
      console.error('Error initializing payment:', error);
      toast.error('Failed to initialize payment');
    }
  };

  // Handle payment initiation
  const handlePaymentInitiation = async () => {
    if (!upiId.trim()) {
      toast.error('Please enter UPI ID');
      return;
    }

    setIsProcessing(true);
    try {
      const description = `Car Pooling - Trip ${tripId}`;
      const deepLink = generateUPIDeepLink(upiId, amount, description);
      
      // Update payment with UPI ID
      await updateDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
        buddyUPI: upiId,
        status: PAYMENT_STATUS.INITIATED,
        deepLink,
        updatedAt: serverTimestamp()
      });

      // Open UPI app
      window.open(deepLink, '_blank');
      
      // Start payment monitoring
      startPaymentMonitoring();
      
      toast.success('Opening UPI app...');
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Start payment monitoring
  const startPaymentMonitoring = () => {
    // Simulate payment monitoring (in real app, this would be webhook-based)
    setTimeout(async () => {
      try {
        // Check if payment was completed (this would be webhook verification)
        const paymentCompleted = await checkPaymentStatus();
        
        if (paymentCompleted) {
          await updateDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
            status: PAYMENT_STATUS.COMPLETED,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Update trip status
          await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
            paymentStatus: PAYMENT_STATUS.COMPLETED,
            paymentCompletedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error('Error monitoring payment:', error);
      }
    }, 5000); // Check after 5 seconds
  };

  // Check payment status (simulated)
  const checkPaymentStatus = async () => {
    // In a real implementation, this would verify with UPI gateway
    // For demo purposes, we'll simulate a successful payment
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.3); // 70% success rate for demo
      }, 2000);
    });
  };

  // Handle manual payment confirmation
  const handleManualConfirmation = async () => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
        status: PAYMENT_STATUS.COMPLETED,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        manuallyConfirmed: true
      });

      // Update trip status
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
        paymentStatus: PAYMENT_STATUS.COMPLETED,
        paymentCompletedAt: serverTimestamp()
      });

      toast.success('Payment confirmed manually');
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate QR code for payment
  const generateQRCode = () => {
    const description = `Car Pooling - Trip ${tripId}`;
    const upiString = `${pilotUPI}@${amount}@${description}`;
    return `upi://pay?pa=${pilotUPI}&am=${amount}&tn=${encodeURIComponent(description)}&cu=INR`;
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case PAYMENT_STATUS.COMPLETED:
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case PAYMENT_STATUS.FAILED:
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case PAYMENT_STATUS.INITIATED:
        return <Clock className="w-6 h-6 text-yellow-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-500" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (paymentStatus) {
      case PAYMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-800';
      case PAYMENT_STATUS.FAILED:
        return 'bg-red-100 text-red-800';
      case PAYMENT_STATUS.INITIATED:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Header */}
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-800">UPI Payment</h3>
            <p className="text-sm text-gray-600">Complete your ride payment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {paymentStatus}
          </span>
        </div>
      </div>

      {/* Payment Amount */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-800">₹{amount}</div>
          <div className="text-sm text-green-600">Payment Amount</div>
        </div>
      </div>

      {/* Payment Methods */}
      {paymentStatus === PAYMENT_STATUS.PENDING && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilot's UPI ID
            </label>
            <input
              type="text"
              value={pilotUPI}
              readOnly
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your UPI ID (Optional)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Options */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePaymentInitiation}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Smartphone className="w-4 h-4" />
              Pay via UPI
            </button>
            
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="flex items-center justify-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <QrCode className="w-4 h-4" />
              Show QR Code
            </button>
          </div>

          {/* QR Code */}
          {showQRCode && (
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">Scan QR Code to Pay</div>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 break-all">
                    {generateQRCode()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Status */}
      {paymentStatus === PAYMENT_STATUS.INITIATED && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-center">
            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <h4 className="font-semibold text-yellow-800 mb-2">Payment in Progress</h4>
            <p className="text-sm text-yellow-700 mb-4">
              Please complete the payment in your UPI app. We'll automatically detect the payment.
            </p>
            <button
              onClick={handleManualConfirmation}
              disabled={isProcessing}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
            >
              {isProcessing ? 'Confirming...' : 'I have paid manually'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Completed */}
      {paymentStatus === PAYMENT_STATUS.COMPLETED && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800 mb-2">Payment Completed</h4>
            <p className="text-sm text-green-700">
              Your payment of ₹{amount} has been successfully processed.
            </p>
            {paymentDetails?.completedAt && (
              <p className="text-xs text-green-600 mt-2">
                Completed at: {paymentDetails.completedAt.toDate().toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Payment Failed */}
      {paymentStatus === PAYMENT_STATUS.FAILED && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h4 className="font-semibold text-red-800 mb-2">Payment Failed</h4>
            <p className="text-sm text-red-700 mb-4">
              The payment could not be processed. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Payment Details */}
      {paymentDetails && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Payment Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Payment ID:</span>
              <span className="font-mono text-gray-800">{paymentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Trip ID:</span>
              <span className="font-mono text-gray-800">{tripId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Method:</span>
              <span className="text-gray-800">{paymentDetails.paymentMethod?.toUpperCase()}</span>
            </div>
            {paymentDetails.createdAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-800">
                  {paymentDetails.createdAt.toDate().toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UPIPaymentSystem;
