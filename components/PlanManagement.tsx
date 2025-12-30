import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, Plus, Edit, Save, X, Trash2, DollarSign, Calendar, Zap, Clock, Ticket, CheckCircle } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  billing_period: 'monthly' | 'annual';
  price_cents: number;
  credits_per_period: number;
  rollover_enabled: boolean;
  features: string[];
  is_active: boolean;
  display_order: number;
  stripe_price_id?: string;
  stripe_product_id?: string;
}

interface AddOn {
  id: string;
  name: string;
  description?: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  price_cents: number;
  delivery_method: string;
  duration_minutes?: number;
  calendly_link?: string;
  is_active: boolean;
  created_at: string;
}

interface EventPass {
  id: string;
  name: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  price_cents: number;
  credits: number;
  duration_hours: number;
  setup_included: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const PlanManagement: React.FC = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [eventPasses, setEventPasses] = useState<EventPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<Partial<SubscriptionTier> | null>(null);
  const [editingAddOn, setEditingAddOn] = useState<Partial<AddOn> | null>(null);
  const [editingEventPass, setEditingEventPass] = useState<Partial<EventPass> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingAddOn, setIsCreatingAddOn] = useState(false);
  const [isCreatingEventPass, setIsCreatingEventPass] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTiers(), loadAddOns(), loadEventPasses()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers_new')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setTiers(data || []);
    } catch (error) {
      console.error('Error loading tiers:', error);
    }
  };

  const loadAddOns = async () => {
    try {
      const { data, error } = await supabase
        .from('add_ons')
        .select('*')
        .order('created_at');

      if (error) throw error;
      setAddOns(data || []);
    } catch (error) {
      console.error('Error loading add-ons:', error);
    }
  };

  const loadEventPasses = async () => {
    try {
      const { data, error } = await supabase
        .from('event_passes')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setEventPasses(data || []);
    } catch (error) {
      console.error('Error loading event passes:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingTier({
      name: '',
      billing_period: 'monthly',
      price_cents: 0,
      credits_per_period: 0,
      rollover_enabled: false,
      features: [],
      is_active: true,
      display_order: tiers.length,
    });
    setIsCreating(true);
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingTier({ ...tier });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingTier) return;

    try {
      if (isCreating) {
        const { error } = await supabase
          .from('subscription_tiers_new')
          .insert([{
            name: editingTier.name,
            billing_period: editingTier.billing_period,
            price_cents: editingTier.price_cents,
            credits_per_period: editingTier.credits_per_period,
            rollover_enabled: editingTier.rollover_enabled || false,
            features: editingTier.features || [],
            is_active: editingTier.is_active !== false,
            display_order: editingTier.display_order || 0,
            stripe_price_id: editingTier.stripe_price_id || null,
            stripe_product_id: editingTier.stripe_product_id || null,
          }]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscription_tiers_new')
          .update({
            name: editingTier.name,
            billing_period: editingTier.billing_period,
            price_cents: editingTier.price_cents,
            credits_per_period: editingTier.credits_per_period,
            rollover_enabled: editingTier.rollover_enabled || false,
            features: editingTier.features || [],
            is_active: editingTier.is_active !== false,
            display_order: editingTier.display_order || 0,
            stripe_price_id: editingTier.stripe_price_id || null,
            stripe_product_id: editingTier.stripe_product_id || null,
          })
          .eq('id', editingTier.id);

        if (error) throw error;
      }

      setEditingTier(null);
      setIsCreating(false);
      loadTiers();
    } catch (error: any) {
      console.error('Error saving tier:', error);
      alert(`Failed to save plan: ${error.message}`);
    }
  };

  const handleDelete = async (tier: SubscriptionTier) => {
    if (!confirm(`Are you sure you want to delete the ${tier.name} plan?`)) return;

    try {
      const { error } = await supabase
        .from('subscription_tiers_new')
        .delete()
        .eq('id', tier.id);

      if (error) throw error;
      loadTiers();
    } catch (error: any) {
      console.error('Error deleting tier:', error);
      alert(`Failed to delete plan: ${error.message}`);
    }
  };

  const addFeature = () => {
    if (!editingTier) return;
    setEditingTier({
      ...editingTier,
      features: [...(editingTier.features || []), ''],
    });
  };

  const updateFeature = (index: number, value: string) => {
    if (!editingTier) return;
    const newFeatures = [...(editingTier.features || [])];
    newFeatures[index] = value;
    setEditingTier({ ...editingTier, features: newFeatures });
  };

  const removeFeature = (index: number) => {
    if (!editingTier) return;
    const newFeatures = (editingTier.features || []).filter((_, i) => i !== index);
    setEditingTier({ ...editingTier, features: newFeatures });
  };

  const handleCreateAddOn = () => {
    setEditingAddOn({
      name: '',
      description: '',
      price_cents: 0,
      delivery_method: 'zoom',
      duration_minutes: 30,
      calendly_link: '',
      is_active: true,
    });
    setIsCreatingAddOn(true);
  };

  const handleEditAddOn = (addOn: AddOn) => {
    setEditingAddOn({ ...addOn });
    setIsCreatingAddOn(false);
  };

  const handleSaveAddOn = async () => {
    if (!editingAddOn) return;

    try {
      if (isCreatingAddOn) {
        const { error } = await supabase
          .from('add_ons')
          .insert([{
            name: editingAddOn.name,
            description: editingAddOn.description || '',
            price_cents: editingAddOn.price_cents,
            delivery_method: editingAddOn.delivery_method || 'zoom',
            duration_minutes: editingAddOn.duration_minutes,
            calendly_link: editingAddOn.calendly_link || null,
            is_active: editingAddOn.is_active !== false,
            stripe_price_id: editingAddOn.stripe_price_id || null,
            stripe_product_id: editingAddOn.stripe_product_id || null,
          }]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('add_ons')
          .update({
            name: editingAddOn.name,
            description: editingAddOn.description || '',
            price_cents: editingAddOn.price_cents,
            delivery_method: editingAddOn.delivery_method || 'zoom',
            duration_minutes: editingAddOn.duration_minutes,
            calendly_link: editingAddOn.calendly_link || null,
            is_active: editingAddOn.is_active !== false,
            stripe_price_id: editingAddOn.stripe_price_id || null,
            stripe_product_id: editingAddOn.stripe_product_id || null,
          })
          .eq('id', editingAddOn.id);

        if (error) throw error;
      }

      setEditingAddOn(null);
      setIsCreatingAddOn(false);
      loadAddOns();
    } catch (error: any) {
      console.error('Error saving add-on:', error);
      alert(`Failed to save add-on: ${error.message}`);
    }
  };

  const handleDeleteAddOn = async (addOn: AddOn) => {
    if (!confirm(`Are you sure you want to delete the ${addOn.name} add-on?`)) return;

    try {
      const { error } = await supabase
        .from('add_ons')
        .delete()
        .eq('id', addOn.id);

      if (error) throw error;
      loadAddOns();
    } catch (error: any) {
      console.error('Error deleting add-on:', error);
      alert(`Failed to delete add-on: ${error.message}`);
    }
  };

  const handleCreateEventPass = () => {
    setEditingEventPass({
      name: '',
      price_cents: 0,
      credits: 0,
      duration_hours: 4,
      setup_included: false,
      is_active: true,
      display_order: eventPasses.length,
    });
    setIsCreatingEventPass(true);
  };

  const handleEditEventPass = (eventPass: EventPass) => {
    setEditingEventPass({ ...eventPass });
    setIsCreatingEventPass(false);
  };

  const handleSaveEventPass = async () => {
    if (!editingEventPass) return;

    try {
      if (isCreatingEventPass) {
        const { error } = await supabase
          .from('event_passes')
          .insert([{
            name: editingEventPass.name,
            price_cents: editingEventPass.price_cents,
            credits: editingEventPass.credits,
            duration_hours: editingEventPass.duration_hours,
            setup_included: editingEventPass.setup_included || false,
            is_active: editingEventPass.is_active !== false,
            display_order: editingEventPass.display_order || 0,
            stripe_price_id: editingEventPass.stripe_price_id || null,
            stripe_product_id: editingEventPass.stripe_product_id || null,
          }]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_passes')
          .update({
            name: editingEventPass.name,
            price_cents: editingEventPass.price_cents,
            credits: editingEventPass.credits,
            duration_hours: editingEventPass.duration_hours,
            setup_included: editingEventPass.setup_included || false,
            is_active: editingEventPass.is_active !== false,
            display_order: editingEventPass.display_order || 0,
            stripe_price_id: editingEventPass.stripe_price_id || null,
            stripe_product_id: editingEventPass.stripe_product_id || null,
          })
          .eq('id', editingEventPass.id);

        if (error) throw error;
      }

      setEditingEventPass(null);
      setIsCreatingEventPass(false);
      loadEventPasses();
    } catch (error: any) {
      console.error('Error saving event pass:', error);
      alert(`Failed to save event pass: ${error.message}`);
    }
  };

  const handleDeleteEventPass = async (eventPass: EventPass) => {
    if (!confirm(`Are you sure you want to delete the ${eventPass.name} event pass?`)) return;

    try {
      const { error } = await supabase
        .from('event_passes')
        .delete()
        .eq('id', eventPass.id);

      if (error) throw error;
      loadEventPasses();
    } catch (error: any) {
      console.error('Error deleting event pass:', error);
      alert(`Failed to delete event pass: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Subscription Plans</h2>
          <p className="text-slate-600 mt-1">Manage subscription tiers offered to users</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
        >
          <Plus size={18} />
          Create Plan
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`bg-white border-2 rounded-xl p-6 ${
              tier.is_active ? 'border-slate-300' : 'border-slate-200 opacity-60'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-600 capitalize">{tier.billing_period}</span>
                </div>
              </div>
              {!tier.is_active && (
                <span className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                  Inactive
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <DollarSign size={24} className="text-green-700" />
              <span className="text-3xl font-bold text-slate-900">
                {(tier.price_cents / 100).toFixed(2)}
              </span>
              <span className="text-slate-600">
                /{tier.billing_period === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-sm">
                <span className="font-medium text-slate-900">{tier.credits_per_period}</span>
                <span className="text-slate-600"> credits per period</span>
              </div>
              <div className="text-sm text-slate-600">
                Rollover: {tier.rollover_enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            {tier.features && tier.features.length > 0 && (
              <div className="mb-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-2">Features:</p>
                <ul className="space-y-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="text-xs text-slate-600">
                      • {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => handleEdit(tier)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(tier)}
                className="px-3 py-2 border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 mt-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Add-On Services</h2>
            <p className="text-slate-600 mt-1">Manage additional services available for purchase</p>
          </div>
          <button
            onClick={handleCreateAddOn}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
          >
            <Plus size={18} />
            Create Add-On
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {addOns.map((addOn) => (
            <div
              key={addOn.id}
              className={`bg-white border-2 rounded-xl p-6 ${
                addOn.is_active ? 'border-slate-300' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{addOn.name}</h3>
                  {addOn.description && (
                    <p className="text-sm text-slate-600 mt-1">{addOn.description}</p>
                  )}
                </div>
                {!addOn.is_active && (
                  <span className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-4">
                <DollarSign size={24} className="text-green-700" />
                <span className="text-3xl font-bold text-slate-900">
                  {(addOn.price_cents / 100).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Zap size={16} className="text-slate-500" />
                  <span className="capitalize">{addOn.delivery_method}</span>
                </div>
                {addOn.duration_minutes && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={16} className="text-slate-500" />
                    <span>{addOn.duration_minutes} minutes</span>
                  </div>
                )}
                {addOn.calendly_link && (
                  <div className="text-xs text-slate-500">
                    Scheduling available
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleEditAddOn(addOn)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteAddOn(addOn)}
                  className="px-3 py-2 border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 mt-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Event Passes</h2>
            <p className="text-slate-600 mt-1">Manage event passes for temporary access</p>
          </div>
          <button
            onClick={handleCreateEventPass}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium"
          >
            <Plus size={18} />
            Create Event Pass
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {eventPasses.map((eventPass) => (
            <div
              key={eventPass.id}
              className={`bg-white border-2 rounded-xl p-6 ${
                eventPass.is_active ? 'border-slate-300' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{eventPass.name}</h3>
                </div>
                {!eventPass.is_active && (
                  <span className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-4">
                <DollarSign size={24} className="text-green-700" />
                <span className="text-3xl font-bold text-slate-900">
                  {(eventPass.price_cents / 100).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Ticket size={16} className="text-slate-500" />
                  <span>{eventPass.credits} credits</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} className="text-slate-500" />
                  <span>{eventPass.duration_hours} hours</span>
                </div>
                {eventPass.setup_included && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle size={16} />
                    <span>Setup included</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleEditEventPass(eventPass)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteEventPass(eventPass)}
                  className="px-3 py-2 border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingTier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {isCreating ? 'Create Plan' : 'Edit Plan'}
              </h3>
              <button
                onClick={() => {
                  setEditingTier(null);
                  setIsCreating(false);
                }}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={editingTier.name || ''}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="e.g., Pro Plan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Billing Period</label>
                  <select
                    value={editingTier.billing_period || 'monthly'}
                    onChange={(e) =>
                      setEditingTier({ ...editingTier, billing_period: e.target.value as 'monthly' | 'annual' })
                    }
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Price (USD)</label>
                  <input
                    type="number"
                    value={(editingTier.price_cents || 0) / 100}
                    onChange={(e) =>
                      setEditingTier({ ...editingTier, price_cents: parseFloat(e.target.value) * 100 || 0 })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Credits per Period</label>
                  <input
                    type="number"
                    value={editingTier.credits_per_period || 0}
                    onChange={(e) =>
                      setEditingTier({ ...editingTier, credits_per_period: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Display Order</label>
                  <input
                    type="number"
                    value={editingTier.display_order || 0}
                    onChange={(e) => setEditingTier({ ...editingTier, display_order: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingTier.rollover_enabled || false}
                    onChange={(e) => setEditingTier({ ...editingTier, rollover_enabled: e.target.checked })}
                    className="w-5 h-5 text-green-700 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-slate-900">Enable Credit Rollover</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingTier.is_active !== false}
                    onChange={(e) => setEditingTier({ ...editingTier, is_active: e.target.checked })}
                    className="w-5 h-5 text-green-700 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-900">Features</label>
                  <button
                    type="button"
                    onClick={addFeature}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="space-y-2">
                  {(editingTier.features || []).map((feature, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(idx, e.target.value)}
                        className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                        placeholder="Feature description"
                      />
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {isCreating ? 'Create Plan' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditingTier(null);
                    setIsCreating(false);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAddOn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {isCreatingAddOn ? 'Create Add-On' : 'Edit Add-On'}
              </h3>
              <button
                onClick={() => {
                  setEditingAddOn(null);
                  setIsCreatingAddOn(false);
                }}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Service Name</label>
                <input
                  type="text"
                  value={editingAddOn.name || ''}
                  onChange={(e) => setEditingAddOn({ ...editingAddOn, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="e.g., 1:1 Training Session"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Description</label>
                <textarea
                  value={editingAddOn.description || ''}
                  onChange={(e) => setEditingAddOn({ ...editingAddOn, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="Describe the service"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Price (USD)</label>
                  <input
                    type="number"
                    value={(editingAddOn.price_cents || 0) / 100}
                    onChange={(e) =>
                      setEditingAddOn({ ...editingAddOn, price_cents: parseFloat(e.target.value) * 100 || 0 })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    value={editingAddOn.duration_minutes || ''}
                    onChange={(e) =>
                      setEditingAddOn({ ...editingAddOn, duration_minutes: parseInt(e.target.value) || undefined })
                    }
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Delivery Method</label>
                <select
                  value={editingAddOn.delivery_method || 'zoom'}
                  onChange={(e) =>
                    setEditingAddOn({ ...editingAddOn, delivery_method: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                >
                  <option value="zoom">Zoom</option>
                  <option value="phone">Phone</option>
                  <option value="in-person">In Person</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Calendly Link (optional)</label>
                <input
                  type="text"
                  value={editingAddOn.calendly_link || ''}
                  onChange={(e) => setEditingAddOn({ ...editingAddOn, calendly_link: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="https://calendly.com/..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingAddOn.is_active !== false}
                    onChange={(e) => setEditingAddOn({ ...editingAddOn, is_active: e.target.checked })}
                    className="w-5 h-5 text-green-700 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveAddOn}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {isCreatingAddOn ? 'Create Add-On' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditingAddOn(null);
                    setIsCreatingAddOn(false);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingEventPass && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {isCreatingEventPass ? 'Create Event Pass' : 'Edit Event Pass'}
              </h3>
              <button
                onClick={() => {
                  setEditingEventPass(null);
                  setIsCreatingEventPass(false);
                }}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Pass Name</label>
                <input
                  type="text"
                  value={editingEventPass.name || ''}
                  onChange={(e) => setEditingEventPass({ ...editingEventPass, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="e.g., 4-Hour Event Pass"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Price (USD)</label>
                  <input
                    type="number"
                    value={(editingEventPass.price_cents || 0) / 100}
                    onChange={(e) =>
                      setEditingEventPass({ ...editingEventPass, price_cents: parseFloat(e.target.value) * 100 || 0 })
                    }
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Credits</label>
                  <input
                    type="number"
                    value={editingEventPass.credits || 0}
                    onChange={(e) =>
                      setEditingEventPass({ ...editingEventPass, credits: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Duration (hours)</label>
                  <input
                    type="number"
                    value={editingEventPass.duration_hours || 0}
                    onChange={(e) =>
                      setEditingEventPass({ ...editingEventPass, duration_hours: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Display Order</label>
                  <input
                    type="number"
                    value={editingEventPass.display_order || 0}
                    onChange={(e) => setEditingEventPass({ ...editingEventPass, display_order: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingEventPass.setup_included || false}
                    onChange={(e) => setEditingEventPass({ ...editingEventPass, setup_included: e.target.checked })}
                    className="w-5 h-5 text-green-700 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-slate-900">Setup Included</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingEventPass.is_active !== false}
                    onChange={(e) => setEditingEventPass({ ...editingEventPass, is_active: e.target.checked })}
                    className="w-5 h-5 text-green-700 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEventPass}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {isCreatingEventPass ? 'Create Event Pass' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditingEventPass(null);
                    setIsCreatingEventPass(false);
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanManagement;
