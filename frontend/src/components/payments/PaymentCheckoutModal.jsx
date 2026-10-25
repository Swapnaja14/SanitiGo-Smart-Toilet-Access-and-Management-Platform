import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
  Receipt,
  Building2,
  Clock,
  Wallet,
  Smartphone,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import paymentsApi from '../../api/payments.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

const PAYMENT_METHODS = [
  {
    id: 'UPI',
    name: 'UPI (GPay / PhonePe / Paytm)',
    desc: 'Instant zero-fee transfer via any UPI app',
    icon: Smartphone,
    badge: 'Popular',
  },
  {
    id: 'CARD',
    name: 'Credit / Debit Card',
    desc: 'Visa, MasterCard, RuPay, Maestro',
    icon: CreditCard,
  },
  {
    id: 'NET_BANKING',
    name: 'Net Banking',
    desc: 'All major Indian banks supported',
    icon: Building2,
  },
  {
    id: 'WALLET',
    name: 'Digital Wallets',
    desc: 'Paytm, Amazon Pay, PhonePe Wallet',
    icon: Wallet,
  },
  {
    id: 'CASH',
    name: 'Pay at Counter / Kiosk',
    desc: 'Pay cash directly at facility turnstile',
    icon: Clock,
  },
];

export default function PaymentCheckoutModal({
  isOpen,
  onClose,
  booking,
  onPaymentSuccess,
  onPaymentFailure,
}) {
  const { success, error: showErrorToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState(
    booking?.payment?.paymentMethod || 'UPI'
  );
  const [mockOutcome, setMockOutcome] = useState('SUCCESS'); // For dev mock control
  const [status, setStatus] = useState('READY'); // 'READY' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  const [serverResult, setServerResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!booking) return null;

  const isMockAllowed =
    import.meta.env.VITE_ENABLE_MOCK_PAYMENT === 'true' ||
    import.meta.env.MODE === 'development';

  const basePrice = Number(booking.amount || booking.toilet?.price || 20);
  const convenienceFee = 5.0;
  const totalAmount = basePrice + convenienceFee;

  const handleInitiateAndPay = async () => {
    setStatus('PROCESSING');
    setErrorMessage(null);

    try {
      // Step 1: Initiate payment record on server
      await paymentsApi.initiatePayment(booking.id, paymentMethod);

      // Step 2: Gateway Execution
      if (isMockAllowed) {
        // Dev / Test Mock Gateway Simulation
        const response = await paymentsApi.simulateMockPayment(
          booking.id,
          mockOutcome
        );

        // Strict server-side verification: check payment status from response data
        const verifiedPayment = response?.data?.payment || response?.payment;
        const verifiedBooking = response?.data?.booking || response?.booking;

        if (verifiedPayment && verifiedPayment.paymentStatus === 'SUCCESS') {
          setStatus('SUCCESS');
          setServerResult({
            payment: verifiedPayment,
            booking: verifiedBooking || booking,
          });
          success('Payment confirmed! Digital access pass is now active.');
          onPaymentSuccess?.(verifiedBooking || booking, verifiedPayment);
        } else {
          // Server returned FAILED or unverified
          setStatus('FAILED');
          const failReason =
            response?.message || 'Payment simulation declined by bank.';
          setErrorMessage(failReason);
          showErrorToast(failReason);
          onPaymentFailure?.(new Error(failReason));
        }
      } else {
        // Real Gateway Path (e.g. Razorpay Standard Checkout)
        const orderData = await paymentsApi.createRazorpayOrder(booking.id);
        const order = orderData?.data || orderData;

        if (!window.Razorpay) {
          throw new Error(
            'Payment gateway script not loaded. Please try again or switch to mock mode in dev.'
          );
        }

        const options = {
          key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'SanitiGo Smart Restrooms',
          description: `Pass for ${booking.toilet?.name || 'Smart Restroom'}`,
          order_id: order.orderId,
          handler: async (response) => {
            try {
              setStatus('PROCESSING');
              // Step 3: Server-side cryptographic HMAC verification
              const verifyRes = await paymentsApi.verifyRazorpayPayment(
                booking.id,
                {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }
              );

              const verifiedData = verifyRes?.data || verifyRes;
              setStatus('SUCCESS');
              setServerResult(verifiedData);
              success('Payment verified! Digital access pass activated.');
              onPaymentSuccess?.(verifiedData.booking, verifiedData.payment);
            } catch (vErr) {
              setStatus('FAILED');
              const msg = extractErrorMessage(vErr);
              setErrorMessage(msg);
              showErrorToast(msg);
              onPaymentFailure?.(vErr);
            }
          },
          theme: { color: '#0d9488' },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (failRes) => {
          setStatus('FAILED');
          const msg =
            failRes.error?.description || 'Payment was declined by your bank.';
          setErrorMessage(msg);
          showErrorToast(msg);
        });
        rzp.open();
      }
    } catch (err) {
      setStatus('FAILED');
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      showErrorToast(msg);
      onPaymentFailure?.(err);
    }
  };

  const handleReset = () => {
    setStatus('READY');
    setErrorMessage(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={status === 'PROCESSING' ? () => {} : onClose}
      title={
        status === 'SUCCESS'
          ? 'Payment Successful'
          : status === 'FAILED'
          ? 'Payment Failed'
          : 'Complete Restroom Pass Payment'
      }
      subtitle={`Booking Reference: #${booking.id?.slice(0, 8)}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        {/* State: SUCCESS (Verified Server-Side Result) */}
        {status === 'SUCCESS' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100 shadow-sm animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Payment Confirmed
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Your payment has been atomically verified by the server.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono font-semibold text-slate-800">
                  {serverResult?.payment?.transactionId || 'MOCK_TXN_VERIFIED'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-bold text-teal-700">
                  {formatCurrency(serverResult?.payment?.amount || totalAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Payment Status</span>
                <Badge variant="success" size="sm">
                  {serverResult?.payment?.paymentStatus || 'SUCCESS'}
                </Badge>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Verification Time</span>
                <span className="text-slate-700 font-medium">
                  {formatDateTime(
                    serverResult?.payment?.paidAt || new Date().toISOString()
                  )}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                variant="primary"
                fullWidth
                onClick={onClose}
                leftIcon={CheckCircle2}
              >
                Done / View Pass
              </Button>
            </div>
          </div>
        )}

        {/* State: FAILED */}
        {status === 'FAILED' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600 border border-rose-100 shadow-sm">
              <XCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Payment Declined or Interrupted
              </h3>
              <p className="text-xs text-rose-600 font-medium mt-1">
                {errorMessage ||
                  'Your transaction could not be verified by the payment gateway.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                No funds were deducted. You can retry with the same or an
                alternative payment method.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" fullWidth onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleReset}
                leftIcon={RotateCcw}
              >
                Retry Payment
              </Button>
            </div>
          </div>
        )}

        {/* State: PROCESSING */}
        {status === 'PROCESSING' && (
          <div className="text-center py-10 space-y-4">
            <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Processing Secure Transaction...
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Contacting payment switch and verifying digital pass
                allocation.
              </p>
            </div>
          </div>
        )}

        {/* State: READY (Checkout & Method Selection) */}
        {status === 'READY' && (
          <>
            {/* Price Breakdown Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Facility Access Base Fare</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(basePrice)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Sanitization & Platform Fee</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(convenienceFee)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                <span>Net Total Payable</span>
                <span className="text-teal-700 text-base">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* Development Mock Notice & Switcher */}
            {isMockAllowed && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Sandbox Environment: Mock Payment Simulator</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Real gateway credentials are not required in this test
                  environment. Select the simulated outcome:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMockOutcome('SUCCESS')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                      mockOutcome === 'SUCCESS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Simulate Success
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockOutcome('FAILED')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                      mockOutcome === 'FAILED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Simulate Decline
                  </button>
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Select Payment Method
              </label>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {method.name}
                            </span>
                            {method.badge && (
                              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-semibold">
                                {method.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {method.desc}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <Button variant="outline" fullWidth onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleInitiateAndPay}
                leftIcon={Lock}
                className="shadow-glow"
              >
                Pay {formatCurrency(totalAmount)}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
