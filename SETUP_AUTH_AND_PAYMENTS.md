# Authentication and Payment Setup Guide

This guide will walk you through setting up Google OAuth authentication and Stripe payments for your Lumina Booth application.

## Google OAuth Setup

To enable Google sign-in, you need to configure Google OAuth in your Supabase project:

### Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure the OAuth consent screen if you haven't already
6. For Application type, select "Web application"
7. Add authorized redirect URIs:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
   - For local development: `http://localhost:5173`

8. Click "Create" and save your Client ID and Client Secret

### Step 2: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to "Authentication" > "Providers"
4. Find "Google" in the list and enable it
5. Enter your Google Client ID and Client Secret
6. Save the configuration

### Step 3: Update Site URL (Important!)

1. In Supabase Dashboard, go to "Authentication" > "URL Configuration"
2. Set the Site URL to your production domain (e.g., `https://yourdomain.com`)
3. Add your local development URL to "Redirect URLs" (e.g., `http://localhost:5173`)

## Email/Password Authentication

Email and password authentication is **already configured** and works out of the box! No additional setup is required.

By default, email confirmation is disabled. Users can sign up and log in immediately without verifying their email.

### Optional: Enable Email Confirmation

If you want to require email verification:

1. Go to Supabase Dashboard > "Authentication" > "Email Templates"
2. Customize the confirmation email template
3. Go to "Authentication" > "Settings"
4. Enable "Enable email confirmations"

## Stripe Payment Setup

To enable subscription payments, you need to configure Stripe:

### Step 1: Create a Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Create an account or sign in
3. Complete your account setup

### Step 2: Get Your API Keys

1. Navigate to [Developers > API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your "Secret key" (starts with `sk_test_` for test mode)
3. Keep this key secure - never commit it to your repository

### Step 3: Create Stripe Products (Optional)

The application already has subscription tiers defined in the database:

- **Free**: $0/month - 10 images, 5 SMS, 1 event
- **Starter**: $29/month - 100 images, 50 SMS, 3 events
- **Professional**: $99/month - 500 images, 200 SMS, 10 events
- **Enterprise**: $299/month - Unlimited usage

To sync these with Stripe:

1. Go to Stripe Dashboard > "Products"
2. Create a product for each tier
3. Add pricing for monthly and yearly billing
4. Save the Price IDs for integration

### Step 4: Configure Stripe in Your Application

You'll need to create a Supabase Edge Function to handle Stripe payments securely:

1. The application already has the Stripe integration UI built
2. Create an Edge Function to handle:
   - Creating Stripe customers
   - Creating checkout sessions
   - Managing subscriptions
   - Handling webhooks

For detailed implementation, visit: **https://bolt.new/setup/stripe**

### Step 5: Set Up Stripe Webhooks

1. In Stripe Dashboard, go to "Developers" > "Webhooks"
2. Click "Add endpoint"
3. Set the endpoint URL to your Edge Function URL
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

## Testing

### Test Google OAuth

1. Start your development server: `npm run dev`
2. Navigate to the login page
3. Click "Continue with Google"
4. You should be redirected to Google's consent screen
5. After authorizing, you should be redirected back and logged in

### Test Email/Password

1. Go to the signup page
2. Enter your name, email, and password (minimum 6 characters)
3. Click "Create Account"
4. You should be automatically logged in and see your dashboard

### Test Stripe (When Configured)

1. Use Stripe test card numbers: `4242 4242 4242 4242`
2. Use any future expiration date
3. Use any 3-digit CVC
4. Use any ZIP code

## Security Best Practices

1. **Never commit secrets** - Keep your API keys in environment variables
2. **Use RLS policies** - Database security is already configured with Row Level Security
3. **Validate on the backend** - Always verify payments server-side
4. **Use HTTPS in production** - Ensure your site uses SSL certificates
5. **Regular security audits** - Review your authentication and payment flows regularly

## Troubleshooting

### Google OAuth Issues

- **Redirect URI mismatch**: Ensure your redirect URIs in Google Console match exactly
- **Invalid client**: Double-check your Client ID and Secret in Supabase
- **Popup blocked**: Some browsers block OAuth popups - use redirect flow instead

### Stripe Issues

- **Webhook not receiving events**: Verify your endpoint URL and webhook secret
- **Test mode vs Live mode**: Ensure you're using the correct API keys for your environment
- **Payment fails**: Check Stripe Dashboard logs for detailed error messages

### Email/Password Issues

- **User already exists**: This means an account with that email already exists
- **Password too weak**: Password must be at least 6 characters
- **Network error**: Check your Supabase URL and anon key in `.env`

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Stripe Documentation](https://stripe.com/docs)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Review Supabase Dashboard > "Authentication" > "Users" to see if accounts are being created
3. Check Stripe Dashboard > "Logs" for payment-related issues
4. Contact support at info@funframephoto.com
