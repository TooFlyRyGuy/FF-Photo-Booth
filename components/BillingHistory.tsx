import React, { useState, useEffect } from 'react';
import { Receipt, Download, DollarSign, Calendar, CreditCard, Loader, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StripeOrder {
  id: number;
  checkout_session_id: string;
  payment_intent_id: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  status: string;
  created_at: string;
}

interface CreditLedgerEntry {
  id: string;
  source: string;
  amount: number;
  balance_after: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  metadata: any;
  created_at: string;
}

interface BillingHistoryProps {
  userId: string;
}

const BillingHistory: React.FC<BillingHistoryProps> = ({ userId }) => {
  const [orders, setOrders] = useState<StripeOrder[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBillingData();
  }, [userId]);

  const loadBillingData = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (customer) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('stripe_orders')
          .select('*')
          .eq('customer_id', customer.customer_id)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        setOrders(ordersData || []);
      }

      const { data: ledgerData, error: ledgerError } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', userId)
        .in('source', ['credit_pack', 'subscription', 'event'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (ledgerError) throw ledgerError;
      setLedger(ledgerData || []);
    } catch (err: any) {
      console.error('Error loading billing data:', err);
      setError(err.message || 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amountInCents: number, currency: string) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      credit_pack: 'Credit Top-up',
      subscription: 'Subscription',
      event: 'Event Pass',
    };
    return labels[source] || source;
  };

  const downloadReceipt = async (order: StripeOrder) => {
    const ledgerEntry = ledger.find(
      (l) => l.stripe_session_id === order.checkout_session_id
    );

    const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.checkout_session_id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .company-name { font-size: 28px; font-weight: bold; color: #15803d; margin-bottom: 5px; }
    .receipt-title { font-size: 20px; color: #666; }
    .details { margin: 30px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; color: #555; }
    .detail-value { color: #333; }
    .total-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; }
    .total-row { display: flex; justify-content: space-between; font-size: 24px; font-weight: bold; color: #15803d; }
    .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; padding-top: 20px; border-top: 1px solid #eee; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-paid { background-color: #dcfce7; color: #15803d; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">Lumina Booth</div>
    <div class="receipt-title">Payment Receipt</div>
  </div>

  <div class="details">
    <div class="detail-row">
      <span class="detail-label">Receipt Number:</span>
      <span class="detail-value">${order.id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Transaction ID:</span>
      <span class="detail-value">${order.payment_intent_id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Date:</span>
      <span class="detail-value">${formatDate(order.created_at)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment Method:</span>
      <span class="detail-value">Credit Card</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Status:</span>
      <span class="detail-value">
        <span class="status-badge status-paid">${order.payment_status.toUpperCase()}</span>
      </span>
    </div>
    ${ledgerEntry ? `
    <div class="detail-row">
      <span class="detail-label">Item:</span>
      <span class="detail-value">${getSourceLabel(ledgerEntry.source)} - ${ledgerEntry.amount} credits</span>
    </div>
    ` : ''}
  </div>

  <div class="total-section">
    <div class="total-row">
      <span>Total Paid:</span>
      <span>${formatCurrency(order.amount_total, order.currency)}</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for your purchase!</p>
    <p>Questions? Contact support@luminabooth.com</p>
  </div>
</body>
</html>
    `;

    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${order.id}-${new Date(order.created_at).toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white border-2 border-slate-300 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader className="animate-spin text-green-700" size={24} />
          <span className="text-slate-600">Loading billing history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-slate-300 rounded-xl p-8">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-slate-300 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <Receipt className="text-green-700" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Billing History</h2>
          <p className="text-sm text-slate-600">View your purchases and download receipts</p>
        </div>
      </div>

      {orders.length === 0 && ledger.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-slate-200">
          <FileText className="mx-auto text-slate-400 mb-3" size={48} />
          <p className="text-slate-600 font-medium">No billing history yet</p>
          <p className="text-sm text-slate-500 mt-1">Your purchases will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const ledgerEntry = ledger.find(
              (l) => l.stripe_session_id === order.checkout_session_id
            );

            return (
              <div
                key={order.id}
                className="border-2 border-slate-200 rounded-lg p-4 hover:border-green-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <DollarSign className="text-green-700" size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {ledgerEntry
                            ? `${getSourceLabel(ledgerEntry.source)} - ${ledgerEntry.amount} credits`
                            : 'Purchase'}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar size={14} />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-14 space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <CreditCard size={14} />
                        <span className="font-mono text-xs">{order.payment_intent_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            order.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {order.payment_status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-900 mb-2">
                      {formatCurrency(order.amount_total, order.currency)}
                    </div>
                    <button
                      onClick={() => downloadReceipt(order)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      <Download size={16} />
                      Receipt
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BillingHistory;
