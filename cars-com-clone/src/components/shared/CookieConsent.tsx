"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasAccepted = localStorage.getItem('cookiesAccepted');

    if (!hasAccepted) {
      // Show banner after a short delay
      const timer = setTimeout(() => {
        setVisible(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookiesAccepted', 'true');
    setVisible(false);
  };

  const handlePreferences = () => {
    // In a real implementation, this would open a modal with cookie preferences
    console.log('Cookie preferences clicked');
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/98 p-3 shadow-lg backdrop-blur dark:border-cars-gray-light/30 dark:bg-slate-950/96 sm:p-4">
      <div className="container-cars flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-cars-primary dark:text-white/88">
          This website uses cookies and similar technologies to enable our website functionalities. We also share information about your use of our site with our social media, advertising and analytics partners. For more details see "Cookie preferences".
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreferences}
            className="w-full border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white md:w-auto"
          >
            Cookie preferences
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="w-full bg-cars-primary text-white hover:bg-cars-accent md:w-auto"
          >
            Accept all cookies
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
