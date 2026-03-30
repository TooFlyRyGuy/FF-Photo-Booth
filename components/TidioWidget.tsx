import React, { useEffect } from 'react';

interface TidioWidgetProps {
  disabled?: boolean;
}

const TidioWidget: React.FC<TidioWidgetProps> = ({ disabled = false }) => {
  useEffect(() => {
    // If disabled (kiosk mode), don't load Tidio at all
    if (disabled) {
      console.log('[TidioWidget] Disabled in kiosk mode - not loading Tidio');

      // Hide and remove any existing Tidio elements
      const style = document.createElement('style');
      style.id = 'tidio-hide-style';
      style.innerHTML = `
        #tidio-chat-iframe,
        #tidio-chat,
        iframe[src*="tidio"],
        div[id^="tidio"] {
          display: none !important;
          visibility: hidden !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        const hideStyle = document.getElementById('tidio-hide-style');
        if (hideStyle) {
          hideStyle.remove();
        }
      };
    }

    // Check for checkout parameter
    const urlParams = new URLSearchParams(window.location.search);
    const hasCheckoutParam = urlParams.has('checkout');

    // Normal mode: ensure Tidio is loaded and visible
    const existingScript = document.querySelector('script[src*="tidio.co"]');

    if (!existingScript) {
      console.log('[TidioWidget] Script not found, loading dynamically');
      const script = document.createElement('script');
      script.src = '//code.tidio.co/uhmx8zcxmluqvpxkuxbsnsyynpl7umfd.js';
      script.async = true;
      script.defer = true;
      script.id = 'tidio-script';
      document.body.appendChild(script);
    } else {
      console.log('[TidioWidget] Script already loaded');
    }

    // If checkout parameter exists, ensure Tidio is visible and open
    if (hasCheckoutParam) {
      console.log('[TidioWidget] Checkout parameter detected - ensuring Tidio is visible');

      // Remove any hide styles that might exist
      const hideStyle = document.getElementById('tidio-hide-style');
      if (hideStyle) {
        hideStyle.remove();
      }

      // Ensure Tidio widget is shown after a short delay to allow script to load
      const ensureTidioVisible = () => {
        const tidioButton = document.querySelector('#tidio-chat-iframe, #tidio-chat') as HTMLElement;
        if (tidioButton) {
          tidioButton.style.display = 'block';
          tidioButton.style.visibility = 'visible';
          console.log('[TidioWidget] Tidio widget visibility ensured');

          // Try to open the widget for failed/cancelled checkouts
          const checkoutStatus = urlParams.get('checkout');
          if (checkoutStatus === 'cancelled' || checkoutStatus === 'failed') {
            console.log('[TidioWidget] Opening chat widget for checkout issue');
            // Try to open Tidio widget if API is available
            setTimeout(() => {
              if ((window as any).tidioChatApi) {
                (window as any).tidioChatApi.open();
              }
            }, 1000);
          }
        } else {
          console.log('[TidioWidget] Tidio elements not found yet');
        }
      };

      // Try multiple times to ensure widget is visible
      setTimeout(ensureTidioVisible, 500);
      setTimeout(ensureTidioVisible, 1500);
      setTimeout(ensureTidioVisible, 3000);
    }

    // Don't cleanup - let Tidio persist across route changes
  }, [disabled]);

  return null;
};

export default TidioWidget;
