<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Fun Frame Photo AI Booth

An AI-powered photo booth application with subscriptions, event passes, and credit-based image generation.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `VITE_GEMINI_API_KEY` - Your Google Gemini API key
   - `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (after setup)

3. Run the app:
   ```bash
   npm run dev
   ```

## Stripe Payment Setup

To enable subscriptions, event passes, and credit purchases, you need to configure Stripe:

### Quick Start
Follow the **[Quick Start Checklist](./STRIPE_QUICK_START_CHECKLIST.md)** - A simple checklist to get up and running in 2-3 hours.

### Complete Guide
See the **[Complete Setup Guide](./STRIPE_SETUP_GUIDE.md)** for detailed step-by-step instructions on:
- Creating Stripe products with proper metadata
- Configuring webhooks
- Setting up API keys and secrets
- Testing and going live

### Technical Reference
For developers, see **[SMS Credits Technical Reference](./SMS_CREDITS_TECHNICAL_REFERENCE.md)** for:
- Database schema details
- SQL functions and usage
- TypeScript integration examples
- Credit consumption logic

## Features

- AI-powered image generation using Google Gemini
- User authentication with email/password
- Subscription plans (monthly and annual)
- Event passes for temporary access
- Credit top-ups for additional image and SMS credits
- SMS notifications via Twilio
- Image storage with Dropbox and SmugMug integration
- Admin dashboard for user and event management
- Kiosk mode for public events

## Database

This application uses Supabase for:
- PostgreSQL database with Row Level Security (RLS)
- Authentication and user management
- Edge Functions for serverless operations
- Storage for image assets

All database migrations are in `supabase/migrations/`.

## Credit System

### Credit Types
- **Image Credits**: 1 credit = 1 AI image generation
- **SMS Credits**: 1 credit = 1 outbound text message

### Credit Sources
1. **Subscription Credits**: Reset monthly/annually, no rollover
2. **Purchased Credits**: From credit packs, never expire
3. **Event Credits**: From event passes, expire with the event

### Consumption Order
Credits are consumed in this order:
1. Subscription credits (first)
2. Purchased credits (second)
3. Event credits (last)

## Pricing

### Monthly Subscriptions
- **Starter**: $29/mo - 60 images, 50 SMS, 3 prompts
- **Pro**: $79/mo - 200 images, 150 SMS, 6 prompts
- **Premium**: $149/mo - 450 images, 300 SMS, 9 prompts
- **Platinum**: $299/mo - 1,000 images, 750 SMS, 12 prompts

### Annual Subscriptions (save ~15%)
- **Starter**: $299/yr
- **Pro**: $799/yr
- **Premium**: $1,499/yr
- **Platinum**: $2,999/yr

### Event Passes
- **150 Generations**: $150 (24 hours)
- **Mid Tier**: $300 (48 hours)
- **Platinum**: $600 (72 hours)

### Credit Top-ups
- **Small Boost**: $49 (150 images + 100 SMS)
- **Creator Pack**: $129 (450 images + 300 SMS)
- **Pro Boost**: $279 (1,050 images + 700 SMS)
- **Power Pack**: $499 (2,100 images + 1,400 SMS)

## Support

For questions or issues:
- Check the documentation files listed above
- Review Stripe Dashboard logs for payment issues
- Check Supabase Dashboard logs for database/function issues

## License

Proprietary
