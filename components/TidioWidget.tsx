import React, { useEffect } from 'react';

const TidioWidget: React.FC = () => {
  useEffect(() => {
    // Tidio script is loaded in index.html, so this component just ensures it's present
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="tidio.co"]');

    // If script doesn't exist for some reason, add it dynamically as fallback
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
