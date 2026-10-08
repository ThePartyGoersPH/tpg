import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { paymentApi } from '../api/paymentApi';

const PaymentFailed = () => {
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
      try {
        const { data } = await paymentApi.getSubscriptionPaymentStatus(reference);
        setPaymentData(data.data);
      } catch {
        const { data } = await paymentApi.getPaymentByReference(reference);
        setPaymentData(data.data);
      }
    } catch (err) {
      console.error('Payment check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (paymentData?.payment_type === 'subscription' || paymentData?.subscription_id) {
      navigate('/subscription');
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking payment status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-600 mb-6">
          Unfortunately, your payment could not be processed.
        </p>

        {paymentData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reference:</span>
              <span className="font-medium text-gray-900">{paymentData.reference_id || reference}</span>
            </div>
            {paymentData.failed_reason && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-red-600">{paymentData.failed_reason}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-left">
          <p className="font-semibold text-blue-900 mb-2">Common reasons for payment failure:</p>
          <ul className="text-blue-800 space-y-1 text-xs">
            <li>• Insufficient funds in your account</li>
            <li>• Payment was cancelled</li>
            <li>• Network connection issues</li>
            <li>• Payment timeout</li>
            <li>• Invalid card or account details</li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          <button
            onClick={handleGoBack}
            className="w-full btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            Need help? Contact support at support@barplatform.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
