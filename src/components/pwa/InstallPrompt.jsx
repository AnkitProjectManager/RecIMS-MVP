import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isInStandalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show prompt after 30 seconds if not dismissed in last 7 days
    const timer = setTimeout(() => {
      if (!isInStandalone && daysSinceDismissed > 7) {
        setShowPrompt(true);
      }
    }, 30000);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (daysSinceDismissed > 7) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50"
      >
        <Card className="shadow-lg border-2" style={{ borderColor: '#1F6FEB' }}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(31, 110, 235, 0.1)' }}>
                <Download className="w-5 h-5" style={{ color: '#1F6FEB' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: '#E6EAF2' }}>
                  Install RecIMS App
                </h3>
                <p className="text-sm mb-3" style={{ color: '#B9C2D0' }}>
                  {isIOS 
                    ? "Tap Share button and select 'Add to Home Screen' to install RecIMS."
                    : "Install RecIMS for faster access and offline functionality."
                  }
                </p>
                {!isIOS && deferredPrompt && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleInstall}
                      size="sm"
                      className="flex-1"
                    >
                      Install Now
                    </Button>
                    <Button
                      onClick={handleDismiss}
                      size="sm"
                      variant="outline"
                    >
                      Later
                    </Button>
                  </div>
                )}
                {isIOS && (
                  <Button
                    onClick={handleDismiss}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    Got it
                  </Button>
                )}
              </div>
              <button
                onClick={handleDismiss}
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#7F8AA3' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}