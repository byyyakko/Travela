declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISSED_KEY = 'pwa-install-dismissed'

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isNativeBrowser = !/crios|fxios|opios|mercury/i.test(ua)
  return isIOS && isNativeBrowser
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return

    if (isIOSSafari()) {
      setIsIOS(true)
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  const handleIOSInstall = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: 'Travela',
        text: 'Connect with locals worldwide',
        url: window.location.href,
      })
    } catch {
      // User cancelled share sheet — no action needed
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe">
      <div
        className={`bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-md mx-auto ${isIOS ? 'cursor-pointer active:opacity-80' : ''}`}
        onClick={isIOS ? handleIOSInstall : undefined}
        role={isIOS ? 'button' : undefined}
        aria-label={isIOS ? 'Add Travela to Home Screen' : undefined}
      >
        <img
          src="/pwa-192x192.png"
          alt="Travela"
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">Install Travela</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIOS ? 'Tap to add to your Home Screen' : 'Add to your home screen for the best experience'}
          </p>
        </div>
        {!isIOS && (
          <Button
            size="sm"
            onClick={handleInstall}
            className="flex-shrink-0"
          >
            Install App
          </Button>
        )}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
