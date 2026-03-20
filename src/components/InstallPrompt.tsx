import { useEffect, useState } from 'react';
import { X, Share, Download } from 'lucide-react';

const DISMISSED_KEY = 'faith-notebook-install-dismissed';

type Platform = 'android' | 'ios' | null;

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  // Already installed as standalone PWA — don't show
  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  if ((navigator as any).standalone === true) return null;
  // iOS Safari
  if (/iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)) return 'ios';
  // Android (Chrome or any Chromium browser)
  if (/Android/.test(ua)) return 'android';
  return null;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const detected = detectPlatform();
    if (!detected) return;
    setPlatform(detected);

    if (detected === 'android') {
      // Android: only show if the browser fires beforeinstallprompt
      // (it won't fire if the app is already installed)
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        // Show banner after 20s only once we have the install prompt
        setTimeout(() => setVisible(true), 20_000);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }

    if (detected === 'ios') {
      // iOS: show after 20s (standalone check already done in detectPlatform)
      const timer = setTimeout(() => setVisible(true), 20_000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      dismiss();
    }
    setDeferredPrompt(null);
  };

  if (!visible || !platform) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-[80] animate-slideUp">
      <div className="bg-[#2c1810] text-white rounded-2xl shadow-2xl p-4 relative">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0 w-10 h-10 bg-[#c49a5c] rounded-xl flex items-center justify-center">
            <span className="text-white font-serif text-lg">F</span>
          </div>
          <div>
            <p className="font-semibold text-sm">Add to Home Screen</p>
            <p className="text-white/70 text-xs mt-0.5 leading-relaxed">
              {platform === 'ios'
                ? 'Open the app like a native app — no App Store needed.'
                : 'Install Faith Notebook for quick access anytime.'}
            </p>
          </div>
        </div>

        {platform === 'android' && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-[#c49a5c] hover:bg-[#b38a4d] text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Install App
          </button>
        )}

        {platform === 'ios' && (
          <div className="mt-3 bg-white/10 rounded-xl px-3 py-2.5 text-xs text-white/85 leading-relaxed">
            Tap{' '}
            <span className="inline-flex items-center gap-0.5 font-medium">
              <Share size={13} className="inline" /> Share
            </span>
            {' '}in Safari, then choose{' '}
            <span className="font-medium">"Add to Home Screen"</span>.
          </div>
        )}
      </div>
    </div>
  );
}
