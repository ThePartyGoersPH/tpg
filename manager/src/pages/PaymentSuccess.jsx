import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { paymentApi } from '../api/paymentApi';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);

  const reference = searchParams.get('ref');

  useEffect(() => {
    if (reference) {
      checkPaymentStatus();
    } else {
      setLoading(false);
    }
  }, [reference]);

  const checkPaymentStatus = async () => {
    try {
      // First, trigger manual payment verification from PayMongo
      try {
        const { data: verifyData } = await paymentApi.verifyPayment(reference);
        console.log('Payment verification result:', verifyData);
        if (verifyData.success) {
          toast.success(verifyData.message || 'Payment confirmed!');
        }
      } catch (verifyErr) {
        console.log('Verification check:', verifyErr.response?.data?.message);
      }

      // Then get payment status
      try {
        const { data } = await paymentApi.getSubscriptionPaymentStatus(reference);
        setPaymentData(data.data);
      } catch {
        // If not subscription, try regular payment
        const { data } = await paymentApi.getPaymentByReference(reference);
        setPaymentData(data.data);
      }
    } catch (err) {
      console.error('Payment check error:', err);
      toast.error('Failed to verify payment status');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (paymentData?.payment_type === 'subscription' || paymentData?.subscription_id) {
      navigate('/subscription');
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been received and is being processed.
        </p>

        {paymentData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reference:</span>
              <span className="font-medium text-gray-900">{paymentData.reference_id || reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount:</span>
              <span className="font-medium text-gray-900">₱{Number(paymentData.amount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                {paymentData.status || 'Processing'}
              </span>
            </div>
            {paymentData.subscription_status === 'pending' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Your subscription will be activated once payment is confirmed
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <p className="text-xs text-gray-500">
            You will receive a confirmation email shortly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
