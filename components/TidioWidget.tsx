import React, { useEffect } from 'react';

const TidioWidget: React.FC = () => {
  useEffect(() => {
    // Hide Tidio in kiosk mode or when ?kiosk= parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    const isKioskMode = urlParams.has('kiosk');

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

    // Normal mode: ensure Tidio is loaded
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

    // Don't cleanup - let Tidio persist across route changes
  }, []);

  return null;
};

export default TidioWidget;
