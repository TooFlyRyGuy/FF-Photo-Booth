import React, { useEffect } from 'react';

const TidioWidget: React.FC = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//code.tidio.co/uhmx8zcxmluqvpxkuxbsnsyynpl7umfd.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        #tidio-chat-iframe {
          transform: scale(0.7);
          transform-origin: bottom right;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.body.removeChild(script);
      document.head.removeChild(style);

      const tidioChat = document.getElementById('tidio-chat');
      if (tidioChat) {
        tidioChat.remove();
      }
    };
  }, []);

  return null;
};

export default TidioWidget;
