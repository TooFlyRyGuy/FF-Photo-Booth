import React, { useEffect } from 'react';

const TidioWidget: React.FC = () => {
  useEffect(() => {
    // Check if script already exists to prevent duplicates
    const existingScript = document.querySelector('script[src*="tidio.co"]');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = '//code.tidio.co/uhmx8zcxmluqvpxkuxbsnsyynpl7umfd.js';
    script.async = true;
    script.defer = true;
    script.id = 'tidio-script';
    document.body.appendChild(script);

    // Check if style already exists
    const existingStyle = document.querySelector('style[data-tidio-responsive]');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.setAttribute('data-tidio-responsive', 'true');
      style.textContent = `
        @media (max-width: 768px) {
          #tidio-chat-iframe {
            transform: scale(0.7);
            transform-origin: bottom right;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Don't cleanup - let Tidio persist across route changes
  }, []);

  return null;
};

export default TidioWidget;
