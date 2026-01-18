import React, { useEffect, useState } from 'react';
import { ShoppingCart, Check, Sparkles, Users, ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddOn {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  delivery_method: string;
  duration_minutes: number | null;
}

export function AddOnShowcase() {
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddOns();
  }, []);

  const loadAddOns = async () => {
    try {
      const { data, error } = await supabase
        .from('add_ons')
        .select('*')
        .eq('is_active', true)
        .order('price_cents', { ascending: true });

      if (error) throw error;
      setAddOns(data || []);
    } catch (err) {
      console.error('Error loading add-ons:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getAddOnIcon = (name: string) => {
    if (name.includes('Gallery')) return ImageIcon;
    if (name.includes('Setup')) return Users;
    if (name.includes('Prompt')) return Sparkles;
    return ShoppingCart;
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-6">
        <p className="text-sm text-slate-500">Loading add-ons...</p>
      </div>
    );
  }

  if (addOns.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="text-green-700" size={20} />
        <h3 className="text-lg font-bold text-black">Enhance Your Event</h3>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Optional add-ons to make your event even better
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {addOns.map((addOn) => {
          const Icon = getAddOnIcon(addOn.name);
          return (
            <div
              key={addOn.id}
              className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-green-500 hover:shadow-lg transition-all relative"
            >
              <div className="absolute top-2 right-2 bg-orange-600 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
                CONTACT US
              </div>

              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Icon className="text-green-700" size={20} />
                </div>
                <div className="flex-1 pr-20">
                  <h4 className="font-semibold text-black text-sm">{addOn.name}</h4>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {formatPrice(addOn.price_cents)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4 line-clamp-2">
                {addOn.description}
              </p>

              <div className="space-y-2 mb-4">
                {addOn.delivery_method && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Check size={14} className="text-green-600" />
                    <span>
                      {addOn.delivery_method === 'zoom'
                        ? `${addOn.duration_minutes}-minute video session`
                        : 'Delivered via email'}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled
                className="w-full py-2 px-4 bg-slate-300 text-slate-500 rounded-lg text-sm font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                title="Please contact us to purchase this add-on"
              >
                <ShoppingCart size={14} />
                Contact Us
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">
        Add-ons can be purchased separately and applied to any event
      </p>
    </div>
  );
}
