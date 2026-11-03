import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Search, CreditCard as Edit, Save, X, Calendar, CreditCard, Shield, UserX, UserPlus, RotateCcw } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  subscription_status: string;
  subscription_tier_id: string | null;
  subscription_tier_name: string | null;
  created_at: string;
  image_credits: number;
  event_credits: number;
  subscription_credits: number;
  purchased_credits: number;
  images_limit: number;
  images_used: number;
  sms_limit: number;
  sms_used: number;
  events_limit: number;
}

interface SubscriptionTier {
  id: string;
  name: string;
  billing_period: string;
  price_cents: number;
}

interface NewUserData {
  email: string;
  password: string;
  full_name: string;
  role: string;
  subscription_tier_id: string | null;
  image_credits: number;
  event_credits: number;
  images_limit: number;
  sms_limit: number;
  events_limit: number;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [resettingTour, setResettingTour] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserData>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    subscription_tier_id: null,
    image_credits: 0,
    event_credits: 0,
    images_limit: 10,
    sms_limit: 5,
    events_limit: 1,
  });

  useEffect(() => {
    loadUsers();
    loadSubscriptionTiers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          email,
          full_name,
          role,
          subscription_status,
          subscription_tier_id,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = data.map(u => u.id);
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('user_id, subscription_credits, purchased_credits, event_credits, images_limit, images_used, sms_limit, sms_used, events_limit')
        .in('user_id', userIds);

      const { data: tiersData } = await supabase
        .from('subscription_tiers_new')
        .select('id, name');

      const creditsMap = new Map(creditsData?.map(c => [c.user_id, c]) || []);
      const tiersMap = new Map(tiersData?.map(t => [t.id, t.name]) || []);

      const enrichedUsers = data.map(user => {
        const credits = creditsMap.get(user.id);
        const subscription_credits = credits?.subscription_credits || 0;
        const purchased_credits = credits?.purchased_credits || 0;
        const event_credits = credits?.event_credits || 0;
        return {
          ...user,
          subscription_tier_name: user.subscription_tier_id ? tiersMap.get(user.subscription_tier_id) || null : null,
          image_credits: subscription_credits + purchased_credits,
          event_credits,
          subscription_credits,
          purchased_credits,
          images_limit: credits?.images_limit || 0,
          images_used: credits?.images_used || 0,
          sms_limit: credits?.sms_limit || 0,
          sms_used: credits?.sms_used || 0,
          events_limit: credits?.events_limit || 0,
        };
      });

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers_new')
        .select('id, name, billing_period, price_cents')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setSubscriptionTiers(data || []);
    } catch (error) {
      console.error('Error loading subscription tiers:', error);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const handleEdit = (user: UserData) => {
    setEditingUser({ ...user });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingUser.full_name,
          role: editingUser.role,
          subscription_status: editingUser.subscription_status,
          subscription_tier_id: editingUser.subscription_tier_id || null,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      const originalImageCredits = editingUser.subscription_credits + editingUser.purchased_credits;
      const newImageCredits = editingUser.image_credits;
      const imageCreditDifference = newImageCredits - originalImageCredits;

      const newPurchasedCredits = Math.max(0, editingUser.purchased_credits + imageCreditDifference);

      const { error: creditsError } = await supabase
        .from('user_credits')
        .update({
          purchased_credits: newPurchasedCredits,
          event_credits: editingUser.event_credits,
          images_limit: editingUser.images_limit,
          sms_limit: editingUser.sms_limit,
          events_limit: editingUser.events_limit,
        })
        .eq('user_id', editingUser.id);

      if (creditsError) throw creditsError;

      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(`Failed to update user: ${error.message}`);
    }
  };

  const handleSendWelcomeEmail = async (user: UserData) => {
    setSendingEmail(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          email: user.email,
          full_name: user.full_name || 'User',
        },
      });

      if (error) throw error;
      alert('Welcome email sent successfully!');
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(`Failed to send email: ${error.message}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const handleResetTour = async (user: UserData) => {
    setResettingTour(user.id);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed: false, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
      alert('Guided tour reset. The user will see the tour next time they log in.');
    } catch (error: any) {
      console.error('Error resetting guided tour:', error);
      alert(`Failed to reset guided tour: ${error.message}`);
    } finally {
      setResettingTour(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      alert('Email and password are required');
      return;
    }

    if (newUser.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setCreatingUser(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.full_name,
            role: newUser.role,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const userId = authData.user.id;

      await supabase
        .from('user_profiles')
        .update({
          full_name: newUser.full_name || null,
          role: newUser.role,
          subscription_tier_id: newUser.subscription_tier_id,
          subscription_status: 'active',
        })
        .eq('id', userId);

      await supabase
        .from('user_credits')
        .update({
          purchased_credits: newUser.image_credits,
          event_credits: newUser.event_credits,
          images_limit: newUser.images_limit,
          sms_limit: newUser.sms_limit,
          events_limit: newUser.events_limit,
        })
        .eq('user_id', userId);

      alert('User created successfully!');
      setShowCreateModal(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        subscription_tier_id: null,
        image_credits: 0,
        event_credits: 0,
        images_limit: 10,
        sms_limit: 5,
        events_limit: 1,
      });
      loadUsers();
    } catch (error: any) {
      console.error('Full user creation error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack,
      });
      alert(`Failed to create user: ${error.message}`);
    } finally {
      setCreatingUser(false);
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
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600 mt-1">Manage users, subscriptions, and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
            {users.length} Total Users
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
          >
            <UserPlus size={18} />
            Create User
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by email, name, or role..."
          className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
        />
      </div>

      <div className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b-2 border-slate-300">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">User</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Role</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Subscription</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Image Credits</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Event Credits</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-900">Joined</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User size={20} className="text-green-700" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-slate-600">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {user.role === 'admin' && <Shield size={14} />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">
                        {user.subscription_tier_name || 'No Plan'}
                      </div>
                      <div className={`text-xs ${
                        user.subscription_status === 'active'
                          ? 'text-green-600'
                          : 'text-slate-500'
                      }`}>
                        {user.subscription_status}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-slate-900">
                      {user.image_credits}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-slate-900">
                      {user.event_credits}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Calendar size={14} />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendWelcomeEmail(user)}
                        disabled={sendingEmail === user.id}
                        className="p-2 text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Send welcome email"
                      >
                        {sendingEmail === user.id ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Mail size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UserX className="mx-auto mb-4 text-slate-400" size={48} />
            <p className="text-slate-600">No users found</p>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Edit User</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Email</label>
                <input
                  type="text"
                  value={editingUser.email}
                  disabled
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg bg-slate-100 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Full Name</label>
                <input
                  type="text"
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Subscription Status</label>
                  <select
                    value={editingUser.subscription_status}
                    onChange={(e) => setEditingUser({ ...editingUser, subscription_status: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Subscription Tier</label>
                <select
                  value={editingUser.subscription_tier_id || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, subscription_tier_id: e.target.value || null })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                >
                  <option value="">No Plan</option>
                  {subscriptionTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - {tier.billing_period} (${(tier.price_cents / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t-2 border-slate-300 pt-6">
                <h4 className="text-lg font-bold text-slate-900 mb-4">Credits</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Image Credits</label>
                    <input
                      type="number"
                      value={editingUser.image_credits}
                      onChange={(e) => setEditingUser({ ...editingUser, image_credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Breakdown: {editingUser.subscription_credits} subscription + {editingUser.purchased_credits} purchased
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Event Credits</label>
                    <input
                      type="number"
                      value={editingUser.event_credits}
                      onChange={(e) => setEditingUser({ ...editingUser, event_credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">For creating/managing events</p>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-slate-300 pt-6">
                <h4 className="text-lg font-bold text-slate-900 mb-4">Guided Tour</h4>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Reset new user tutorial</p>
                    <p className="text-xs text-slate-500 mt-1">
                      The user will see the guided tour again next time they log in.
                    </p>
                  </div>
                  <button
                    onClick={() => handleResetTour(editingUser)}
                    disabled={resettingTour === editingUser.id}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resettingTour === editingUser.id ? (
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    Reset Tour
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b-2 border-slate-300 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Create New User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-600 hover:text-slate-900 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Subscription Tier</label>
                  <select
                    value={newUser.subscription_tier_id || ''}
                    onChange={(e) => setNewUser({ ...newUser, subscription_tier_id: e.target.value || null })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                  >
                    <option value="">Free (Default)</option>
                    {subscriptionTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} - {tier.billing_period} (${(tier.price_cents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t-2 border-slate-300 pt-6">
                <h4 className="text-lg font-bold text-slate-900 mb-4">Initial Credits</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Image Credits</label>
                    <input
                      type="number"
                      value={newUser.image_credits}
                      onChange={(e) => setNewUser({ ...newUser, image_credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">For generating AI images</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Event Credits</label>
                    <input
                      type="number"
                      value={newUser.event_credits}
                      onChange={(e) => setNewUser({ ...newUser, event_credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-green-700"
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">For creating/managing events</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingUser ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Create User
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingUser}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
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

export default UserManagement;
