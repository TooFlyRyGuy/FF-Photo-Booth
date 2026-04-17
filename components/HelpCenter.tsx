import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronRight, MessageCircle, Search, Calendar, Camera, Settings, CreditCard, Smartphone, Zap, Image, Users, Circle as HelpCircle, Mail, ExternalLink, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Info } from 'lucide-react';

interface ArticleSection {
  heading: string;
  content: string | string[];
  type?: 'text' | 'steps' | 'tips' | 'warning';
}

interface Article {
  id: string;
  title: string;
  summary: string;
  icon: React.ReactNode;
  category: string;
  sections: ArticleSection[];
}

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const ARTICLES: Article[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with Fun Frame Photo',
    summary: 'Learn the basics of setting up your account and running your first photo booth event.',
    icon: <Zap size={20} />,
    category: 'Getting Started',
    sections: [
      {
        heading: 'Welcome to Fun Frame Photo',
        content:
          'Fun Frame Photo is an AI-powered photo booth platform that transforms event photography. Guests walk up to a kiosk, take a photo, choose a creative AI style, and receive a transformed image — all in seconds. You manage everything from your dashboard.',
        type: 'text',
      },
      {
        heading: 'Step 1: Complete Your Profile',
        content: [
          'Navigate to the Profile section in your sidebar',
          'Upload a profile photo and fill in your name',
          'Save your profile — this information is used across your account',
        ],
        type: 'steps',
      },
      {
        heading: 'Step 2: Configure Your Settings',
        content: [
          'Go to Settings in the sidebar',
          'Enter your Gemini API key (required for AI image generation)',
          'Optionally configure your Twilio credentials for SMS delivery',
          'Set your default timezone for accurate event scheduling',
        ],
        type: 'steps',
      },
      {
        heading: 'Step 3: Create Your First Event',
        content: [
          'Click "Events" in the sidebar, then "Create Event"',
          'Enter your event name, city, and date',
          'Choose an aspect ratio that fits your display (square is most common for booths)',
          'Set a unique passcode guests will use to launch the kiosk',
          'Add prompts from the Prompt Library to define AI styles available at the booth',
          'Save and activate your event',
        ],
        type: 'steps',
      },
      {
        heading: 'Step 4: Launch Kiosk Mode',
        content: [
          'From your Events list, click "Launch Kiosk" next to your event',
          'Alternatively, open a browser and go to your app URL with ?kiosk=YOUR_PASSCODE',
          'Hand the device to your guests or mount it at your booth',
          'Guests can now take photos and receive AI-generated images',
        ],
        type: 'steps',
      },
      {
        heading: 'Pro Tips',
        content: [
          'Test your kiosk mode on the actual device you will use at the event before the day-of',
          'Set start and end datetimes on your event to automatically control when the booth is active',
          'Use the Analytics tab to monitor usage in real time during your event',
        ],
        type: 'tips',
      },
    ],
  },
  {
    id: 'create-event',
    title: 'Creating and Managing Events',
    summary: 'Everything you need to know about setting up events, adding prompts, and customizing your booth.',
    icon: <Calendar size={20} />,
    category: 'Events',
    sections: [
      {
        heading: 'Creating an Event',
        content:
          'Events are the core of Fun Frame Photo. Each event has its own passcode, AI style prompts, branding settings, and sharing options. You can run multiple events simultaneously depending on your subscription plan.',
        type: 'text',
      },
      {
        heading: 'Event Settings Explained',
        content: [
          'Event Name — Displayed on the kiosk welcome screen',
          'City — Used for labeling and analytics',
          'Event Date — The primary date for your event',
          'Passcode — A unique code guests or staff use to launch the kiosk',
          'Aspect Ratio — Controls photo dimensions (square, portrait, landscape, etc.)',
          'Start / End Datetime — Optional; restricts when the booth is active',
          'SMS Message — Custom text sent with image links via SMS',
        ],
        type: 'steps',
      },
      {
        heading: 'Adding AI Prompts to an Event',
        content: [
          'Open the event editor and scroll to the Prompts section',
          'Click "Add from Library" to open the Prompt Library',
          'Browse or search for styles that match your event theme',
          'Click prompts to select them; they appear at the bottom of your selection',
          'Reorder prompts by dragging the grip handle on the left',
          'Guests will see these prompts as style options in kiosk mode',
        ],
        type: 'steps',
      },
      {
        heading: 'Branding Your Event',
        content: [
          'Upload a Background Image to show behind the kiosk UI',
          'Upload your Logo to display in the corner of generated images',
          'Upload an Overlay Image to layer graphics on top of photos (frames, stickers, etc.)',
          'Set Primary, Secondary, and Accent colors to match your brand palette',
          'Toggle "Hide Logo" or "Hide Event Name" for a cleaner kiosk look',
        ],
        type: 'steps',
      },
      {
        heading: 'Activating and Deactivating Events',
        content: [
          'Use the toggle switch on your Events list to activate or deactivate an event',
          'Only active events can be accessed in kiosk mode',
          'Deactivated events still retain all their data and photos',
          'You can reactivate an event at any time',
        ],
        type: 'steps',
      },
      {
        heading: 'Important: Event Limits',
        content:
          'The number of concurrent active events is determined by your subscription plan. If you hit your limit, deactivate an existing event before activating a new one, or upgrade your plan.',
        type: 'warning',
      },
    ],
  },
  {
    id: 'kiosk-mode',
    title: 'Running Kiosk Mode',
    summary: 'How to launch and run the photo booth kiosk for your guests.',
    icon: <Camera size={20} />,
    category: 'Events',
    sections: [
      {
        heading: 'What is Kiosk Mode?',
        content:
          'Kiosk mode is the full-screen, guest-facing photo booth experience. Guests tap the screen, choose an AI style, take a photo via the device camera, and receive their transformed image in seconds. The interface is designed for touchscreens but works on any modern device.',
        type: 'text',
      },
      {
        heading: 'Launching Kiosk Mode',
        content: [
          'Option A: From your Events list, click the "Launch Kiosk" button',
          'Option B: Open a browser and navigate to your app URL followed by ?kiosk=YOUR_PASSCODE (e.g., https://yourapp.com?kiosk=WEDDING24)',
          'Option C: From the landing page, enter your event code in the "Launch Kiosk Mode" box',
        ],
        type: 'steps',
      },
      {
        heading: 'Camera Setup Tips',
        content: [
          'Grant camera permissions when prompted by the browser',
          'Use "Switch Camera" within the kiosk to toggle between front and rear cameras',
          'For the best quality, use a device with a high-resolution camera',
          'Position the camera at eye level for the most flattering portraits',
          'Ensure good, consistent lighting — avoid direct backlighting',
        ],
        type: 'tips',
      },
      {
        heading: 'Guest Flow',
        content: [
          'Guest taps the attract screen to begin',
          'Guest selects an AI style from the prompt tiles',
          'A 3-second countdown begins, then the photo is captured',
          'The photo is processed by the AI (typically 5–15 seconds)',
          'Guest sees the result and can enter their phone number to receive it via SMS',
          'Guest can also scan a QR code or download directly from the screen',
        ],
        type: 'steps',
      },
      {
        heading: 'Time Restrictions',
        content:
          'If you set a Start or End Datetime on your event, the kiosk will display a friendly message outside those hours. This is useful for events where the booth should only be active during specific times.',
        type: 'text',
      },
      {
        heading: 'Exiting Kiosk Mode',
        content:
          'Long-press or hold the exit button in the corner of the kiosk screen. For browser-based kiosks, use the browser\'s back/close controls.',
        type: 'text',
      },
    ],
  },
  {
    id: 'prompt-library',
    title: 'Using the Prompt Library',
    summary: 'Create and manage AI style prompts that power your photo transformations.',
    icon: <Image size={20} />,
    category: 'AI & Prompts',
    sections: [
      {
        heading: 'What are Prompts?',
        content:
          'Prompts are the AI instructions that define how a guest\'s photo will be transformed. Each prompt has a name, description, preview image, and a text description that is sent to the AI model. For example, a "Watercolor Painting" prompt tells the AI to render the photo in a watercolor art style.',
        type: 'text',
      },
      {
        heading: 'Browsing the Library',
        content: [
          'Open the Prompt Library from the sidebar or from within an event editor',
          'Use the search bar to filter prompts by name or tag',
          'Filter by category using the category tabs',
          'Click a prompt card to preview its details and sample output',
        ],
        type: 'steps',
      },
      {
        heading: 'Creating a Custom Prompt',
        content: [
          'Click "Create Prompt" in the Prompt Library',
          'Enter a descriptive name (e.g., "Vintage Polaroid")',
          'Write a prompt text that describes the visual style to the AI',
          'Upload a preview image that shows guests what to expect',
          'Optionally upload a reference image to guide the AI style',
          'Add tags to help with organization and searching',
          'Set to Public to share with all users, or keep it Private',
          'Save the prompt',
        ],
        type: 'steps',
      },
      {
        heading: 'Writing Effective Prompt Text',
        content: [
          'Be specific and descriptive — "oil painting in the style of Monet with soft blues and greens" works better than "painting"',
          'Include mood, lighting, and artistic style in your description',
          'Mention if faces should be preserved or stylized',
          'Test your prompt before using it at a live event',
          'Shorter prompts sometimes produce more consistent results',
        ],
        type: 'tips',
      },
      {
        heading: 'Assigning Prompts to Events',
        content:
          'After saving prompts to your library, you can assign them to specific events. Open your event editor, go to the Prompts section, and click "Add from Library." You can reorder the prompts using drag and drop.',
        type: 'text',
      },
    ],
  },
  {
    id: 'sms-sharing',
    title: 'SMS Delivery & Sharing',
    summary: 'How guests receive their photos via text message and other sharing methods.',
    icon: <Smartphone size={20} />,
    category: 'Delivery',
    sections: [
      {
        heading: 'How SMS Delivery Works',
        content:
          'After a guest\'s photo is generated, they can enter their phone number directly on the kiosk screen. Fun Frame Photo uses Twilio to send an SMS containing a link to their image. The image link is valid and accessible from any device.',
        type: 'text',
      },
      {
        heading: 'Setting Up Twilio',
        content: [
          'Create a free or paid Twilio account at twilio.com',
          'From your Twilio console, get your Account SID and Auth Token',
          'Purchase a Twilio phone number capable of sending SMS',
          'Enter all three values in Settings > SMS / Twilio section',
          'Save your settings and test with a real phone number',
        ],
        type: 'steps',
      },
      {
        heading: 'Customizing the SMS Message',
        content:
          'In your event editor, find the "SMS Message" field. You can write a custom message that accompanies the image link. For example: "Thanks for joining us at the Smith Wedding! Here\'s your AI photo: {link}". The image link is appended automatically.',
        type: 'text',
      },
      {
        heading: 'Other Sharing Methods',
        content: [
          'QR Code — Displayed on the result screen; guests scan with their phone camera',
          'Download — Guests can tap download to save directly to the device in use',
          'SmugMug Integration — Automatically upload images to your SmugMug gallery',
          'Dropbox Integration — Sync images directly to a Dropbox folder',
        ],
        type: 'steps',
      },
      {
        heading: 'SMS Credit Usage',
        content:
          'Each SMS sent consumes one SMS credit from your account. Monitor your remaining credits in the Credits display in the sidebar. Credits reset monthly based on your subscription plan.',
        type: 'warning',
      },
    ],
  },
  {
    id: 'billing-subscription',
    title: 'Billing & Subscriptions',
    summary: 'Understanding your plan, credits, and how to manage your subscription.',
    icon: <CreditCard size={20} />,
    category: 'Account',
    sections: [
      {
        heading: 'Subscription Plans',
        content:
          'Fun Frame Photo offers several subscription tiers, each with different allowances for image generations, SMS messages, and concurrent active events. Visit the Pricing page or contact support to compare plans.',
        type: 'text',
      },
      {
        heading: 'Understanding Credits',
        content: [
          'Image Credits — Each AI photo generation uses one image credit',
          'SMS Credits — Each text message sent uses one SMS credit',
          'Credits reset on your monthly billing cycle date',
          'Unused credits do not roll over to the next month',
          'Your current credit balance is shown in the sidebar at all times',
        ],
        type: 'steps',
      },
      {
        heading: 'Purchasing Add-On Credits',
        content: [
          'Go to the Subscription section from your dashboard',
          'Click "Top Up Credits" to purchase additional image or SMS credits',
          'Add-on credits are added immediately after purchase',
          'Add-on credits do not expire at the end of the billing cycle',
        ],
        type: 'steps',
      },
      {
        heading: 'Managing Your Subscription',
        content: [
          'Open the Subscription Manager from the Plan section or the billing prompt',
          'Upgrade your plan to increase monthly allowances',
          'Downgrade takes effect at the end of your current billing period',
          'Cancel anytime — you retain access until the billing period ends',
        ],
        type: 'steps',
      },
      {
        heading: 'Billing Questions',
        content:
          'For any billing concerns, disputes, or questions about charges, contact our support team at support@funframephoto.com. Include your account email and a description of the issue.',
        type: 'text',
      },
    ],
  },
  {
    id: 'api-keys',
    title: 'API Keys & Integrations',
    summary: 'Configure the API keys needed for AI generation, SMS, and photo gallery integrations.',
    icon: <Settings size={20} />,
    category: 'Settings',
    sections: [
      {
        heading: 'Required: Google Gemini API Key',
        content:
          'Fun Frame Photo uses Google Gemini for AI image generation. You must provide your own Gemini API key in Settings to enable photo transformations.',
        type: 'warning',
      },
      {
        heading: 'Getting a Gemini API Key',
        content: [
          'Visit aistudio.google.com',
          'Sign in with your Google account',
          'Click "Get API Key" and create a new project or select an existing one',
          'Copy the generated API key',
          'Paste it in Fun Frame Photo under Settings > AI / Gemini',
        ],
        type: 'steps',
      },
      {
        heading: 'Optional: Twilio (SMS)',
        content: [
          'Sign up at twilio.com',
          'Get your Account SID, Auth Token, and a Twilio phone number',
          'Enter these in Settings > SMS / Twilio',
          'Without Twilio, SMS delivery will not be available, but QR and download sharing still work',
        ],
        type: 'steps',
      },
      {
        heading: 'Optional: Dropbox Integration',
        content: [
          'Go to Settings > Integrations > Dropbox',
          'Click "Connect Dropbox" and authorize your Dropbox account',
          'Once connected, generated images will automatically upload to your Dropbox',
          'You can disconnect at any time',
        ],
        type: 'steps',
      },
      {
        heading: 'Optional: SmugMug Integration',
        content: [
          'Go to Settings > Integrations > SmugMug',
          'Click "Connect SmugMug" and authorize your account',
          'In each event editor, you can assign a SmugMug gallery for automatic uploads',
          'You can create new galleries directly from the event editor',
        ],
        type: 'steps',
      },
      {
        heading: 'Keeping Your Keys Secure',
        content:
          'Never share your API keys publicly. Your keys are stored securely in our system and are only used for your account. If you believe a key has been compromised, regenerate it from the respective provider dashboard and update it in your settings.',
        type: 'tips',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    summary: 'Track event performance, image counts, SMS deliveries, and guest engagement.',
    icon: <Users size={20} />,
    category: 'Events',
    sections: [
      {
        heading: 'Dashboard Overview',
        content:
          'Your main dashboard shows real-time statistics for the current billing period: total images generated, SMS messages sent, total events, and currently active events. A bar chart shows daily activity over the past 14 days.',
        type: 'text',
      },
      {
        heading: 'Event Analytics',
        content: [
          'From your Events list, click the bar chart icon next to any event',
          'The Analytics view shows total generations for that event',
          'See a breakdown of which AI prompts were most popular',
          'Track daily usage trends throughout the event',
          'Export or review data to report back to clients',
        ],
        type: 'steps',
      },
      {
        heading: 'Understanding the Charts',
        content: [
          'Daily bar chart shows number of AI generations per day',
          'Click on any bar to see a breakdown by event for that day',
          'Prompt popularity shows which styles guests chose most often',
          'Use this data to refine your prompt selection for future events',
        ],
        type: 'tips',
      },
    ],
  },
];

const FAQS: FaqItem[] = [
  {
    category: 'General',
    question: 'What is Fun Frame Photo?',
    answer:
      'Fun Frame Photo is an AI-powered photo booth platform. It allows event organizers to set up a kiosk where guests take photos that are instantly transformed using AI into creative artwork, paintings, fantasy scenes, and more. Images can be shared via SMS, QR code, or direct download.',
  },
  {
    category: 'General',
    question: 'Do guests need to download an app?',
    answer:
      'No. The kiosk runs entirely in a web browser on any modern device. Guests interact with the touchscreen kiosk directly. When receiving their photo, they can view it on their own phone via a link sent by SMS or by scanning a QR code — no app required.',
  },
  {
    category: 'General',
    question: 'What devices can I use as a kiosk?',
    answer:
      'Any device with a modern web browser and a camera works — iPad, Android tablet, laptop, or desktop with a webcam. Tablets with touchscreens provide the best guest experience. We recommend using Chrome or Safari for best camera compatibility.',
  },
  {
    category: 'Events',
    question: 'How many events can I run at the same time?',
    answer:
      'The number of concurrent active events depends on your subscription plan. Starter plans typically allow 1 active event at a time. Higher-tier plans allow more. You can check your limit in your subscription details. Deactivating one event frees up a slot for another.',
  },
  {
    category: 'Events',
    question: 'Can I reuse an event for multiple dates?',
    answer:
      'Yes. You can duplicate an existing event and adjust the date, passcode, and settings as needed. Alternatively, you can edit the event\'s start/end datetimes to run it on different days without creating a new one.',
  },
  {
    category: 'Events',
    question: 'What happens if a guest tries to use the booth outside event hours?',
    answer:
      'If you set start and end datetimes on your event, the kiosk will display a friendly message indicating the booth is not yet open or has ended. The guest cannot proceed past the attract screen outside those hours.',
  },
  {
    category: 'Events',
    question: 'Can multiple kiosk devices run the same event?',
    answer:
      'Yes. Any number of devices can run the same event simultaneously using the same passcode. Credits are shared across all devices running the same event.',
  },
  {
    category: 'AI & Photos',
    question: 'How long does AI image generation take?',
    answer:
      'Typically between 5 and 20 seconds depending on the complexity of the AI prompt, current load on Google\'s servers, and your internet connection speed. The kiosk shows a progress animation while the image is being generated.',
  },
  {
    category: 'AI & Photos',
    question: 'Why did my AI image generation fail?',
    answer:
      'Common causes include an invalid or expired Gemini API key, exceeded API quotas on your Google account, poor internet connectivity at the venue, or an image that could not be processed (e.g., very dark or blurry photos). Check your Gemini API key in Settings and verify your Google account has sufficient API quota.',
  },
  {
    category: 'AI & Photos',
    question: 'Can I control what styles are available at my event?',
    answer:
      'Yes. Each event has its own set of AI prompts selected from your Prompt Library. You can add, remove, and reorder prompts for each event. Guests at the kiosk will only see the prompts you have assigned to that specific event.',
  },
  {
    category: 'AI & Photos',
    question: 'How do I get better AI generation results?',
    answer:
      'Good lighting makes the biggest difference. Ensure the photo area is well lit with soft, even light. Write detailed, specific prompt descriptions. Avoid prompts that are too vague. You can also upload a reference image with your prompt to guide the style more precisely.',
  },
  {
    category: 'SMS & Sharing',
    question: 'Do I need Twilio to send SMS?',
    answer:
      'Yes. SMS delivery requires a Twilio account with an active phone number. You will need to enter your Twilio Account SID, Auth Token, and phone number in Settings. Without Twilio, guests can still receive their photos via QR code and direct download.',
  },
  {
    category: 'SMS & Sharing',
    question: 'How long are image links valid?',
    answer:
      'Image links generated by the system are stored in Supabase cloud storage. Links remain accessible as long as your account is active. They are not set to expire automatically.',
  },
  {
    category: 'SMS & Sharing',
    question: 'Can I brand the SMS message guests receive?',
    answer:
      'Yes. In your event editor, there is an "SMS Message" field where you can write a custom text message. The image link is automatically appended. Use this to include your event name, a thank-you message, or a call to action.',
  },
  {
    category: 'Billing',
    question: 'What happens when I run out of image credits?',
    answer:
      'When image credits reach zero, the kiosk will display a "No Credits" screen and guests will not be able to generate new photos. You can purchase additional credits instantly from the Subscription section of your dashboard without interrupting your billing cycle.',
  },
  {
    category: 'Billing',
    question: 'Do unused credits roll over to the next month?',
    answer:
      'Monthly credits included with your subscription do not roll over at the end of the billing period. However, add-on credits purchased separately do not expire and carry over indefinitely.',
  },
  {
    category: 'Billing',
    question: 'Can I upgrade or downgrade my plan at any time?',
    answer:
      'Yes. You can upgrade immediately and gain access to the higher plan benefits right away. Downgrades take effect at the end of your current billing period so you keep access to your current plan until then.',
  },
  {
    category: 'Technical',
    question: 'The camera is not working in kiosk mode. What do I do?',
    answer:
      'Ensure you have granted camera permissions in the browser. On iOS (Safari), go to Settings > Safari > Camera and allow access. On Android (Chrome), tap the camera icon in the address bar and allow access. Make sure no other app is currently using the camera. Try refreshing the page.',
  },
  {
    category: 'Technical',
    question: 'Kiosk mode is showing a blank screen. What should I do?',
    answer:
      'First verify the event passcode is correct. Check that the event is set to Active. Ensure you have a stable internet connection. Clear your browser cache and try again. If the problem persists, check the browser console for errors and contact support.',
  },
  {
    category: 'Technical',
    question: 'Can the kiosk run without internet?',
    answer:
      'No. Fun Frame Photo requires an active internet connection for AI image generation, credit verification, and image delivery. Ensure the venue has a reliable WiFi or cellular connection before your event.',
  },
];

const CATEGORIES = ['All', 'General', 'Events', 'AI & Photos', 'SMS & Sharing', 'Billing', 'Technical'];
const ARTICLE_CATEGORIES = ['All', 'Getting Started', 'Events', 'AI & Prompts', 'Delivery', 'Account', 'Settings'];

const SectionContent: React.FC<{ section: ArticleSection }> = ({ section }) => {
  const bgColors: Record<string, string> = {
    steps: 'bg-blue-50 border-blue-200',
    tips: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
    text: '',
  };

  const icons: Record<string, React.ReactNode> = {
    tips: <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />,
    warning: <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />,
    steps: <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />,
  };

  const type = section.type || 'text';

  if (type === 'text' || !type) {
    return (
      <p className="text-slate-600 leading-relaxed">{section.content as string}</p>
    );
  }

  if (Array.isArray(section.content)) {
    return (
      <div className={`rounded-lg border p-4 ${bgColors[type]}`}>
        {type === 'steps' ? (
          <ol className="space-y-2">
            {(section.content as string[]).map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2">
            {(section.content as string[]).map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                {icons[type]}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${bgColors[type]} flex gap-3`}>
      {icons[type]}
      <p className="text-sm text-slate-700">{section.content as string}</p>
    </div>
  );
};

const ArticleView: React.FC<{ article: Article; onBack: () => void }> = ({ article, onBack }) => (
  <div className="max-w-3xl mx-auto">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors"
    >
      <ChevronRight size={16} className="rotate-180" />
      Back to Help Center
    </button>

    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide bg-green-50 px-2 py-1 rounded">
        {article.category}
      </span>
    </div>

    <h1 className="text-2xl font-bold text-slate-900 mb-3">{article.title}</h1>
    <p className="text-slate-500 mb-8 text-base leading-relaxed">{article.summary}</p>

    <div className="space-y-8">
      {article.sections.map((section, i) => (
        <div key={i}>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">{section.heading}</h2>
          <SectionContent section={section} />
        </div>
      ))}
    </div>

    <div className="mt-10 p-5 bg-slate-50 border border-slate-200 rounded-xl">
      <p className="text-sm text-slate-600 font-medium mb-1">Still need help?</p>
      <p className="text-sm text-slate-500 mb-3">
        Our support team is here for you. Reach out and we will get back to you quickly.
      </p>
      <a
        href="mailto:support@funframephoto.com"
        className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
      >
        <Mail size={14} />
        support@funframephoto.com
      </a>
    </div>
  </div>
);

const HelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'home' | 'article' | 'faq'>('home');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [articleCategory, setArticleCategory] = useState('All');
  const [faqCategory, setFaqCategory] = useState('All');

  useEffect(() => {
    if (activeView !== 'home') return;

    const existingScript = document.querySelector('script[id="tidio-help-script"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = '//code.tidio.co/uhmx8zcxmluqvpxkuxbsnsyynpl7umfd.js';
      script.async = true;
      script.id = 'tidio-help-script';
      document.body.appendChild(script);
    }

    if ((window as any).tidioChatApi) {
      (window as any).tidioChatApi.show();
    }

    return () => {
      if ((window as any).tidioChatApi) {
        (window as any).tidioChatApi.hide();
      }
    };
  }, [activeView]);

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const filteredArticles = ARTICLES.filter(a => {
    const matchesCategory = articleCategory === 'All' || a.category === articleCategory;
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredFaqs = FAQS.filter(f => {
    const matchesCategory = faqCategory === 'All' || f.category === faqCategory;
    const matchesSearch =
      !searchQuery ||
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const openArticle = (article: Article) => {
    setSelectedArticle(article);
    setActiveView('article');
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    setActiveView('home');
    setSelectedArticle(null);
  };

  if (activeView === 'article' && selectedArticle) {
    return (
      <div className="p-6 md:p-8">
        <ArticleView article={selectedArticle} onBack={goHome} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Help Center</h1>
        <p className="text-slate-500">Guides, setup instructions, and answers to common questions.</p>
      </div>

      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search help articles and FAQ..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
        />
      </div>

      {/* Quick Contact Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-green-50 border border-green-200 rounded-xl mb-8">
        <div>
          <p className="font-semibold text-green-900 text-sm">Need direct support?</p>
          <p className="text-green-700 text-sm mt-0.5">
            Email us at{' '}
            <a href="mailto:support@funframephoto.com" className="font-medium underline underline-offset-2">
              support@funframephoto.com
            </a>{' '}
            or use the chat widget below.
          </p>
        </div>
        <a
          href="mailto:support@funframephoto.com"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Mail size={14} />
          Email Support
        </a>
      </div>

      {/* Knowledge Base Articles */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-green-700" />
          <h2 className="text-lg font-semibold text-slate-800">Knowledge Base</h2>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {ARTICLE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setArticleCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                articleCategory === cat
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredArticles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p>No articles found for your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map(article => (
              <button
                key={article.id}
                onClick={() => openArticle(article)}
                className="text-left p-5 bg-white border border-slate-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 bg-green-50 text-green-700 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    {article.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{article.title}</h3>
                      <ChevronRight size={15} className="flex-shrink-0 text-slate-400 group-hover:text-green-700 transition-colors" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{article.summary}</p>
                    <span className="inline-block mt-2 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      {article.category}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={18} className="text-green-700" />
          <h2 className="text-lg font-semibold text-slate-800">Frequently Asked Questions</h2>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFaqCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                faqCategory === cat
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <HelpCircle size={32} className="mx-auto mb-3 opacity-50" />
            <p>No FAQs found for your search.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <span className="text-xs font-medium text-green-700 block mb-1">{faq.category}</span>
                    <span className="text-sm font-medium text-slate-800">{faq.question}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 mt-0.5 text-slate-400 transition-transform ${
                      expandedFaqs.has(index) ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFaqs.has(index) && (
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed pt-3">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Chat Section */}
      <div className="p-6 bg-slate-900 rounded-2xl text-white">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <MessageCircle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Live Chat Support</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Use the chat widget in the bottom-right corner of this page to start a live conversation with our support team. You can also reach us by email at{' '}
              <a href="mailto:support@funframephoto.com" className="text-green-400 hover:text-green-300 transition-colors">
                support@funframephoto.com
              </a>
              .
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if ((window as any).tidioChatApi) {
                    (window as any).tidioChatApi.open();
                  }
                }}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <MessageCircle size={14} />
                Open Live Chat
              </button>
              <a
                href="mailto:support@funframephoto.com"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Mail size={14} />
                Email Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
