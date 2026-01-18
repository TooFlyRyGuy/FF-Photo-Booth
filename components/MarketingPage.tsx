import React from 'react';
import { Camera, Smartphone, Sparkles, Download, Share2, Zap, Users, Building2, PartyPopper, Calendar, Gift } from 'lucide-react';

const MarketingPage: React.FC = () => {
  const signupUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="mb-8">
            <img
              src="/smaller700x200_logo.png"
              alt="Fun Frame Photo"
              className="h-16 md:h-20 mx-auto mb-8"
            />
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Virtual AI Photo Booth
          </h1>

          <p className="text-xl md:text-2xl mb-4 text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Let guests <strong className="text-white">take a photo with their phone or any device</strong> and instantly get a stunning AI-generated image
          </p>

          <p className="text-lg md:text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            No hardware. No app downloads. No hassle. Just pure magic.
          </p>

          <a
            href={signupUrl}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold text-lg md:text-xl px-10 py-5 rounded-lg shadow-2xl transition-all transform hover:scale-105 hover:shadow-red-600/50"
          >
            Start Free Trial — Get Instant Access
          </a>

          <p className="mt-6 text-sm text-slate-400">
            No credit card required • Setup in 5 minutes
          </p>
        </div>
      </header>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="/fav_icon.png"
                alt="AI Photo Booth Experience"
                className="w-full rounded-2xl shadow-2xl border-4 border-slate-200"
              />
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-900">
                Why This Is Amazing
              </h2>

              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Works on Any Device</h3>
                    <p className="text-slate-600">No hardware needed — phones, tablets, laptops & more</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">AI-Powered Magic</h3>
                    <p className="text-slate-600">Transforms photos into themed, professional-quality images instantly</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Instant Results</h3>
                    <p className="text-slate-600">No app download or installation — guests get started immediately</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Easy Sharing</h3>
                    <p className="text-slate-600">Download, SMS, or scan QR code — multiple delivery options</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Camera className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Perfect for Events</h3>
                    <p className="text-slate-600">Weddings, corporate events, parties, and brand activations</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900">
            How It Works
          </h2>
          <p className="text-center text-slate-600 text-lg mb-16 max-w-2xl mx-auto">
            Three simple steps to create unforgettable photo experiences
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200 text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">1. Take a Photo</h3>
              <p className="text-slate-600 leading-relaxed">
                Guests capture a photo using their phone, tablet, or laptop — no app required. Just open the link and start.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200 text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">2. AI Enhances It</h3>
              <p className="text-slate-600 leading-relaxed">
                Our AI system transforms the photo into a themed image instantly with professional style and quality.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200 text-center">
              <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">3. Download & Share</h3>
              <p className="text-slate-600 leading-relaxed">
                Instant download, SMS delivery, or QR code sharing — guests get their photos in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-slate-900">
            Perfect For Every Occasion
          </h2>
          <p className="text-center text-slate-600 text-lg mb-16 max-w-2xl mx-auto">
            From intimate gatherings to large corporate events
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-8 rounded-2xl border-2 border-pink-200">
              <PartyPopper className="w-12 h-12 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Weddings & Parties</h3>
              <p className="text-slate-600">Create magical memories with themed AI photo experiences for your special day</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-2xl border-2 border-blue-200">
              <Building2 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Corporate Events</h3>
              <p className="text-slate-600">Engage attendees at conferences, trade shows, and company celebrations</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-2xl border-2 border-orange-200">
              <Zap className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Brand Activations</h3>
              <p className="text-slate-600">Create viral moments with branded AI photo experiences for marketing campaigns</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border-2 border-green-200">
              <Smartphone className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Virtual Events</h3>
              <p className="text-slate-600">Perfect for hybrid and remote events where guests join from anywhere</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-8 rounded-2xl border-2 border-red-200">
              <Gift className="w-12 h-12 text-red-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Holiday Events</h3>
              <p className="text-slate-600">Festive photo experiences for Christmas parties, Halloween, and seasonal celebrations</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-8 rounded-2xl border-2 border-purple-200">
              <Users className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900">Fundraisers & Galas</h3>
              <p className="text-slate-600">Add excitement to charity events and formal gatherings with interactive photo fun</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Create Magic?
          </h2>

          <p className="text-xl md:text-2xl mb-10 text-slate-300 leading-relaxed">
            Launch your Virtual AI Photo Booth in minutes — no equipment or staff required
          </p>

          <a
            href={signupUrl}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold text-lg md:text-xl px-10 py-5 rounded-lg shadow-2xl transition-all transform hover:scale-105 hover:shadow-red-600/50 mb-6"
          >
            Start Free Trial — Get Instant Access
          </a>

          <p className="text-slate-400 text-sm">
            No credit card required • Setup in 5 minutes • Cancel anytime
          </p>

          <div className="mt-16 pt-16 border-t border-slate-700 grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-red-500 mb-2">5 min</div>
              <div className="text-slate-400">Setup Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-500 mb-2">∞</div>
              <div className="text-slate-400">Custom Themes</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-500 mb-2">24/7</div>
              <div className="text-slate-400">Always Available</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900">
            Frequently Asked Questions
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">Do I need to buy equipment?</h3>
              <p className="text-slate-600">No! This is a virtual photo booth that works on any device with a camera and internet connection.</p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">Do guests need to download an app?</h3>
              <p className="text-slate-600">Nope. Guests simply visit your unique event link in their web browser — no downloads required.</p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">How fast are the AI-generated photos?</h3>
              <p className="text-slate-600">Photos are generated in 10-15 seconds using advanced AI technology.</p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">Can I customize the themes?</h3>
              <p className="text-slate-600">Yes! Create unlimited custom AI prompts and themes to match your event perfectly.</p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">How do guests receive their photos?</h3>
              <p className="text-slate-600">Multiple options: instant download, SMS delivery, QR code, or integration with Dropbox and SmugMug galleries.</p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-slate-900">Is there a limit on guests?</h3>
              <p className="text-slate-600">Different plans available based on your needs — from small parties to large corporate events.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <img
            src="/smaller700x200_logo.png"
            alt="Fun Frame Photo"
            className="h-12 mx-auto mb-6 opacity-80"
          />

          <p className="text-sm mb-4">
            Virtual AI Photo Booth — Create Unforgettable Photo Experiences
          </p>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Fun Frame Photo. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MarketingPage;
