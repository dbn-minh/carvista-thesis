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
    <div className="fixed bottom-0 left-0 w-full bg-white shadow-lg z-50 p-4 border-t border-gray-200">
      <div className="container-cars flex flex-col md:flex-row md:items-center justify-between gap-4">
        <p className="text-sm text-cars-primary">
          This website uses cookies and similar technologies to enable our website functionalities. We also share information about your use of our site with our social media, advertising and analytics partners. For more details see "Cookie preferences".
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreferences}
            className="text-cars-primary border-cars-primary hover:bg-cars-primary hover:text-white"
          >
            Cookie preferences
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="bg-cars-primary text-white hover:bg-cars-accent"
          >
            Accept all cookies
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
