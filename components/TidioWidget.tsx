import React, { useEffect } from 'react';

const TidioWidget: React.FC = () => {
  useEffect(() => {
    // Hide Tidio in kiosk mode or when ?kiosk= parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    const isKioskMode = urlParams.has('kiosk');
    const hasCheckoutParam = urlParams.has('checkout');

    if (isKioskMode) {
      console.log('[TidioWidget] Kiosk mode detected - hiding Tidio');
      // Hide Tidio widget
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
        // Cleanup: remove hide style when component unmounts
        const hideStyle = document.getElementById('tidio-hide-style');
        if (hideStyle) {
          hideStyle.remove();
        }
      };
    }

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
  }, []);

  return null;
};

export default TidioWidget;
