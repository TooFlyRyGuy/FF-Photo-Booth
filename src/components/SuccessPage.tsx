import React, { useEffect } from 'react';
import { CircleCheck as CheckCircle, ArrowRight, Camera } from 'lucide-react';

interface SuccessPageProps {
  onContinue: () => void;
}

const SuccessPage: React.FC<SuccessPageProps> = ({ onContinue }) => {
  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      onContinue();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600">
              Thank you for subscribing to Fun Frame AI. Your account has been upgraded and you can now access all premium features.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-green-900">Ready to create amazing photos!</p>
                  <p className="text-sm text-green-700">Your subscription is now active</p>
                </div>
              </div>
            </div>

            <button
              onClick={onContinue}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              Continue to Dashboard
              <ArrowRight size={16} />
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Redirecting automatically in 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;