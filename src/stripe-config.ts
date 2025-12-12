export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'payment' | 'subscription';
  interval?: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_TaZh4eoqgzHHOd',
    priceId: 'price_1SdOY7JxjOA1z6KPbaey0o44',
    name: 'Starter Monthly',
    description: 'AI Booth Monthly Starter Plan',
    price: 29.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    features: [
      '100 AI-generated photos per month',
      '50 SMS deliveries',
      '3 active events',
      'Basic customization',
      'Email support'
    ]
  },
  {
    id: 'prod_Taa0CJBvuqlJXF',
    priceId: 'price_1SdOqoJxjOA1z6KPeFQ0OWfc',
    name: 'Starter Yearly',
    description: 'AI Booth Starter Plan Yearly',
    price: 290.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'year',
    features: [
      '100 AI-generated photos per month',
      '50 SMS deliveries',
      '3 active events',
      'Basic customization',
      'Email support',
      '2 months free'
    ]
  },
  {
    id: 'prod_TaZijFI49KeaOH',
    priceId: 'price_1SdOZ6JxjOA1z6KPlTwz5wIl',
    name: 'Professional Monthly',
    description: 'AI Booth Professional Monthly',
    price: 99.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    features: [
      '500 AI-generated photos per month',
      '200 SMS deliveries',
      '10 active events',
      'Advanced customization',
      'Priority support',
      'Analytics dashboard'
    ],
    popular: true
  },
  {
    id: 'prod_TaafuSd2cpWmvp',
    priceId: 'price_1SdPTwJxjOA1z6KPnS8EeFEc',
    name: 'Professional Yearly',
    description: 'AI Booth Professional Yearly',
    price: 990.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'year',
    features: [
      '500 AI-generated photos per month',
      '200 SMS deliveries',
      '10 active events',
      'Advanced customization',
      'Priority support',
      'Analytics dashboard',
      '2 months free'
    ],
    popular: true
  },
  {
    id: 'prod_TaZz49ckL8llov',
    priceId: 'price_1SdOp6JxjOA1z6KPPEmPqt20',
    name: 'Enterprise Monthly',
    description: 'AI Booth Enterprise Plan',
    price: 99.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    features: [
      'Unlimited AI-generated photos',
      'Unlimited SMS deliveries',
      'Unlimited active events',
      'White-label branding',
      'Dedicated support',
      'Custom integrations',
      'API access'
    ]
  },
  {
    id: 'prod_TaaglBcyz2dTUu',
    priceId: 'price_1SdPVEJxjOA1z6KPk2NvOPJT',
    name: 'Enterprise Yearly',
    description: 'AI Booth Enterprise Yearly',
    price: 4990.00,
    currency: 'usd',
    mode: 'subscription',
    interval: 'year',
    features: [
      'Unlimited AI-generated photos',
      'Unlimited SMS deliveries',
      'Unlimited active events',
      'White-label branding',
      'Dedicated support',
      'Custom integrations',
      'API access',
      '2 months free'
    ]
  }
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return stripeProducts.find(product => product.priceId === priceId);
}

export function formatPrice(price: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(price);
}