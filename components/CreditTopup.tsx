import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Zap, X, AlertCircle, CheckCircle } from 'lucide-react';

interface CreditTopupProduct {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id?: string;
  stripe_product_id?: string;
  is_active: boolean;
  display_order: number;
}

interface CreditTopupProps {
  onClose: () => void;
}

const CreditTopup: React.FC<CreditTopupProps> = ({ onClose }) => {
  const [products, setProducts] = useState<CreditTopupProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_topup_products')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading credit packages:', error);
      setError('Failed to load credit packages');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: CreditTopupProduct) => {
    if (!product.stripe_price_id) {
      setError('This product is not yet configured for purchase. Please contact support.');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Please sign in to purchase credits');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: product.stripe_price_id,
          mode: 'payment',
          success_url: `${window.location.origin}?success=true&type=credit_topup`,
          cancel_url: `${window.location.origin}?canceled=true`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error purchasing credits:', error);
      setError(error.message || 'Failed to process purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Top Up Credits</h2>
            <p className="text-slate-600 mt-1">Purchase additional credits for your account</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X size={18} />
              </button>
            </div>
          )}

          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-900 mb-2">
                  All purchased credits never expire
                </p>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>1 credit = 1 AI-generated image</li>
                  <li>Credits stack with subscription and event credits</li>
                  <li>Credits persist even after subscription cancellation</li>
                  <li>Instant credit delivery after purchase</li>
                </ul>
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">No credit packages available at this time.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border-2 border-slate-300 rounded-xl p-6 hover:border-green-700 transition-colors"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{product.name}</h3>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Zap className="text-green-700" size={24} />
                      <span className="text-3xl font-bold text-slate-900">{product.credits}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">credits</p>
                    {product.stripe_price_id ? (
                      <div className="flex items-baseline justify-center gap-1">
                        <DollarSign size={20} className="text-green-700" />
                        <span className="text-3xl font-bold text-slate-900">
                          {(product.price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600">Configure in Stripe</p>
                    )}
                  </div>

                  <button
                    onClick={() => handlePurchase(product)}
                    disabled={purchasing || !product.stripe_price_id}
                    className="w-full py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                  >
                    {purchasing ? 'Processing...' : 'Purchase'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-slate-500">
            <p>Secure payments powered by Stripe</p>
            <p className="mt-1">Credits are delivered instantly to your account</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditTopup;
