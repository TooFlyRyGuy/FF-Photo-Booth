import { Tenant, Event, Prompt, SubscriptionTier, GeneratedImage } from '../types';

// --- MOCK DATA ---

let MOCK_PROMPTS: Prompt[] = [
  {
    id: 'p1',
    name: 'Cyberpunk City',
    description: 'Neon lights and futuristic armor',
    category: 'Sci-Fi',
    previewImage: 'https://picsum.photos/id/10/300/300',
    promptText: 'A futuristic cyberpunk character with neon glowing armor, standing in a rain-slicked Tokyo street at night. Cinematic lighting.'
  },
  {
    id: 'p2',
    name: 'Renaissance Oil',
    description: 'Classic oil painting style',
    category: 'Artistic',
    previewImage: 'https://picsum.photos/id/20/300/300',
    promptText: 'An 18th-century oil painting of a noble, wearing velvet and gold, dramatic chiaroscuro lighting, museum quality.'
  },
  {
    id: 'p3',
    name: 'Retro 80s',
    description: 'Synthwave aesthetic',
    category: 'Retro',
    previewImage: 'https://picsum.photos/id/30/300/300',
    promptText: 'A retro 1980s synthwave style portrait, sunset gradient background, laser grid, cool sunglasses, digital noise.'
  },
  {
    id: 'p4',
    name: 'Pixar Style',
    description: '3D Animated Character',
    category: 'Fun',
    previewImage: 'https://picsum.photos/id/40/300/300',
    promptText: 'A cute 3D rendered character in the style of a modern animation studio, soft lighting, expressive features, vibrant colors.'
  }
];

const CURRENT_TENANT: Tenant = {
  id: 't_123',
  name: 'Acme Event Agency',
  tier: SubscriptionTier.PRO,
  whiteLabel: true,
  brandingLogo: 'https://via.placeholder.com/150x50?text=AGENCY+LOGO',
  usage: {
    imagesUsed: 1240,
    imagesLimit: 5000,
    smsUsed: 890,
    smsLimit: 5000
  }
};

let MOCK_EVENTS: Event[] = [
  {
    id: 'evt_1',
    name: 'TechCrunch Disrupt Afterparty',
    date: '2024-10-15',
    city: 'San Francisco',
    isActive: true,
    passcode: '1234',
    prompts: [MOCK_PROMPTS[0], MOCK_PROMPTS[3]],
    tenantId: 't_123'
  },
  {
    id: 'evt_2',
    name: 'Sarah & Tom Wedding',
    date: '2024-11-02',
    city: 'Austin',
    isActive: false,
    passcode: 'LOVE',
    prompts: [MOCK_PROMPTS[1], MOCK_PROMPTS[3]],
    tenantId: 't_123'
  }
];

// --- SERVICE METHODS ---

export const getTenant = async (): Promise<Tenant> => {
  return new Promise(resolve => setTimeout(() => resolve(CURRENT_TENANT), 500));
};

export const getEvents = async (): Promise<Event[]> => {
  return new Promise(resolve => setTimeout(() => resolve([...MOCK_EVENTS]), 500));
};

export const getPrompts = async (): Promise<Prompt[]> => {
  return new Promise(resolve => setTimeout(() => resolve([...MOCK_PROMPTS]), 200));
};

export const saveEvent = async (event: Event): Promise<Event> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const existingIndex = MOCK_EVENTS.findIndex(e => e.id === event.id);
      if (existingIndex >= 0) {
        MOCK_EVENTS[existingIndex] = event;
      } else {
        MOCK_EVENTS.push(event);
      }
      resolve(event);
    }, 500);
  });
};

export const savePrompt = async (prompt: Prompt): Promise<Prompt> => {
  return new Promise(resolve => {
    setTimeout(() => {
      MOCK_PROMPTS.push(prompt);
      resolve(prompt);
    }, 500);
  });
};

export const sendSms = async (phoneNumber: string, imageUrl: string): Promise<boolean> => {
  console.log(`[MOCK TWILIO] Sending SMS to ${phoneNumber} with link ${imageUrl}`);
  return new Promise(resolve => setTimeout(() => resolve(true), 1000));
};

export const uploadToDropbox = async (imageBase64: string): Promise<string> => {
  console.log(`[MOCK DROPBOX] Uploading image...`);
  return new Promise(resolve => setTimeout(() => resolve("https://dropbox.com/mock-link-123"), 1000));
};