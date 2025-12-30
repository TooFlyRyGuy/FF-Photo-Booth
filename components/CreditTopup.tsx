import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Zap, X } from 'lucide-react';

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
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: CreditTopupProduct) => {
    setPurchasing(true);
    try {
      alert(
        'Stripe integration is not yet configured. To enable credit purchases:\n\n' +
        '1. Create a Stripe account at https://dashboard.stripe.com/register\n' +
        '2. Get your Stripe secret key from the Developers section\n' +
        '3. Add it to your environment configuration\n\n' +
        'Visit https://bolt.new/setup/stripe for detailed instructions.'
      );
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Failed to process purchase. Please try again.');
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
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">No credit packages available at this time.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border-2 border-slate-300 rounded-xl p-6 hover:border-green-700 transition-colors"
                >
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{product.name}</h3>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Zap className="text-green-700" size={20} />
                      <span className="text-2xl font-bold text-slate-900">{product.credits}</span>
                      <span className="text-slate-600">credits</span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1">
                      <DollarSign size={20} className="text-green-700" />
                      <span className="text-3xl font-bold text-slate-900">
                        {(product.price_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(product)}
                    disabled={purchasing}
                    className="w-full py-3 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 text-white rounded-lg font-bold transition-colors"
                  >
                    {purchasing ? 'Processing...' : 'Purchase'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditTopup;
