import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ArrowDown, X, Calendar, BookImage, Settings as SettingsIcon, CreditCard, Sparkles, CircleCheck as CheckCircle2 } from 'lucide-react';

interface TutorialStep {
  targetId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right';
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
  action?: () => void;
  actionLabel?: string;
}

interface OnboardingTutorialProps {
  onComplete: () => void;
  onOpenSidebar?: () => void;
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onComplete, onOpenSidebar }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TutorialStep[] = [
    {
      targetId: 'onboarding-new-event-btn',
      title: 'Start Here! Create Your First Event',
      description: 'This is where it all begins. Click "New Event" to set up your first AI photo booth event. You\'ll configure the event name, date, location, and AI prompt styles.',
      icon: <Calendar size={24} />,
      position: 'bottom',
      arrowDirection: 'up',
    },
    {
      targetId: 'onboarding-events-nav',
      title: 'Manage Your Events',
      description: 'All your events live here. View active and past events, edit settings, launch kiosk mode, and monitor real-time activity.',
      icon: <Calendar size={24} />,
      position: 'right',
      arrowDirection: 'left',
    },
    {
      targetId: 'onboarding-prompts-nav',
      title: 'Prompt Library',
      description: 'Browse and create AI image prompts. Each prompt defines a unique photo style for your guests. Mix and match prompts across events.',
      icon: <BookImage size={24} />,
      position: 'right',
      arrowDirection: 'left',
    },
    {
      targetId: 'onboarding-settings-nav',
      title: 'Configure Your Settings',
      description: 'Set up your Gemini AI API key, SMS delivery, branding options, and other integrations to power your photo booth experience.',
      icon: <SettingsIcon size={24} />,
      position: 'right',
      arrowDirection: 'left',
    },
    {
      targetId: 'onboarding-plan-btn',
      title: 'Manage Your Plan',
      description: 'View your current subscription, upgrade for more credits and features, or purchase add-on event passes. You\'re currently on the free trial!',
      icon: <CreditCard size={24} />,
      position: 'right',
      arrowDirection: 'left',
    },
  ];

  const sidebarTargets = new Set(['onboarding-events-nav', 'onboarding-prompts-nav', 'onboarding-settings-nav', 'onboarding-plan-btn']);

  useEffect(() => {
    const step = steps[currentStep];
    if (sidebarTargets.has(step.targetId)) {
      const isMobile = window.innerWidth < 768;
      if (isMobile && onOpenSidebar) {
        onOpenSidebar();
        setTimeout(() => positionTooltip(), 350);
      }
    }
  }, [currentStep]);

  const positionTooltip = useCallback(() => {
    const step = steps[currentStep];
    const target = document.getElementById(step.targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    const rect = target.getBoundingClientRect();
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 768;
    const tooltipWidth = isMobile ? Math.min(300, viewportWidth - 32) : 340;

    setSpotlightStyle({
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
      borderRadius: '12px',
    });

    let top = 0;
    let left = 0;

    const effectivePosition = (isMobile && sidebarTargets.has(step.targetId)) ? 'bottom' : step.position;

    switch (effectivePosition) {
      case 'bottom':
        top = rect.bottom + padding + 12;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - padding - 200;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - 80;
        left = rect.right + padding + 12;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - 80;
        left = rect.left - padding - tooltipWidth - 12;
        break;
    }

    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }
    if (left < 16) left = 16;
    if (top < 16) top = 16;
    if (top + 200 > viewportHeight - 16) {
      top = viewportHeight - 220;
    }

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      zIndex: 10002,
    });

    let arrowTop = 0;
    let arrowLeft = 0;
    const effectiveArrow = (isMobile && sidebarTargets.has(step.targetId)) ? 'up' : step.arrowDirection;
    switch (effectiveArrow) {
      case 'up':
        arrowTop = rect.bottom + 2;
        arrowLeft = rect.left + rect.width / 2 - 10;
        break;
      case 'down':
        arrowTop = rect.top - 24;
        arrowLeft = rect.left + rect.width / 2 - 10;
        break;
      case 'left':
        arrowTop = rect.top + rect.height / 2 - 10;
        arrowLeft = rect.right + 2;
        break;
      case 'right':
        arrowTop = rect.top + rect.height / 2 - 10;
        arrowLeft = rect.left - 24;
        break;
    }

    setArrowStyle({
      position: 'fixed',
      top: arrowTop,
      left: arrowLeft,
      zIndex: 10003,
    });
  }, [currentStep]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    positionTooltip();
    const repositionTimer = setTimeout(() => positionTooltip(), 100);
    const handleResize = () => positionTooltip();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      clearTimeout(repositionTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [positionTooltip]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const ArrowIcon = () => {
    const arrowClass = 'text-green-500 drop-shadow-lg';
    const isMobile = window.innerWidth < 768;
    const direction = (isMobile && sidebarTargets.has(step.targetId)) ? 'up' : step.arrowDirection;
    switch (direction) {
      case 'up':
        return <ArrowDown size={20} className={`${arrowClass} rotate-180`} />;
      case 'down':
        return <ArrowDown size={20} className={arrowClass} />;
      case 'left':
        return <ArrowRight size={20} className={`${arrowClass} rotate-180`} />;
      case 'right':
        return <ArrowRight size={20} className={arrowClass} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`transition-opacity duration-300 ${isVisible && !isExiting ? 'opacity-100' : 'opacity-0'}`}
      style={{ pointerEvents: isExiting ? 'none' : 'auto' }}
    >
      {/* Click-to-dismiss overlay */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 10000 }}
        onClick={handleComplete}
      />

      {/* Spotlight cutout with surrounding overlay */}
      <div
        className="fixed"
        style={{
          ...spotlightStyle,
          zIndex: 10001,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(21, 128, 61, 0.6), 0 0 20px rgba(21, 128, 61, 0.3)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />

      {/* Animated arrow */}
      <div
        style={arrowStyle}
        className="animate-bounce"
      >
        <ArrowIcon />
      </div>

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-800 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Getting Started ({currentStep + 1}/{steps.length})
            </span>
          </div>
          <button
            onClick={handleComplete}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-green-700/10 text-green-700 rounded-lg shrink-0">
              {step.icon}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{step.title}</h3>
            </div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-6 bg-green-700'
                    : i < currentStep
                    ? 'w-1.5 bg-green-400'
                    : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleComplete}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="px-4 py-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isLast ? (
                  <>
                    <CheckCircle2 size={14} />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
