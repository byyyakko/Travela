declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Plus, MoreHorizontal, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

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
  const { pathname } = useLocation()
  const PUBLIC_ROUTES = ['/', '/auth', '/merchant-auth', '/reset-password', '/email-verified', '/contact']

  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (PUBLIC_ROUTES.includes(pathname)) return
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return

    if (isIOSSafari()) {
      setIsIOS(true)
    }

    // Always show the banner for non-standalone users
    setShow(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [pathname])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
    setShowGuide(false)
  }

  const handleCloseGuide = () => setShowGuide(false)

  if (PUBLIC_ROUTES.includes(pathname)) return null
  if (!show) return null

  return (
    <>
      {/* iOS step-by-step guide overlay */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="flex-1 bg-black/60"
              onClick={handleCloseGuide}
              aria-hidden="true"
            />

            <motion.div
              className="bg-card border-t border-border rounded-t-2xl p-6 pb-10"
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <img src="/pwa-192x192.png" alt="Travela" className="w-8 h-8 rounded-lg" />
                  <p className="font-semibold text-foreground">Add to Home Screen</p>
                </div>
                <button
                  onClick={handleCloseGuide}
                  aria-label="Close guide"
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span className="text-sm text-foreground">
                    Tap{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">
                      <MoreHorizontal className="w-3 h-3" />
                    </span>{' '}
                    at the bottom right of your Safari bar
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span className="text-sm text-foreground">
                    Tap{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">
                      Share
                    </span>{' '}
                    from the menu
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span className="text-sm text-foreground">
                    Tap{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">
                      <Plus className="w-3 h-3" /> Add to Home Screen
                    </span>
                  </span>
                </li>
              </ol>

              <div className="flex justify-center mt-6">
                <div className="flex flex-col items-center gap-1 animate-bounce text-primary">
                  <span className="text-xs font-medium text-muted-foreground">Safari toolbar</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v14M6 14l6 6 6-6" />
                  </svg>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prominent top banner + bottom bar */}
      <AnimatePresence>
        {show && (
            <motion.div
              className="fixed bottom-[4.5rem] md:bottom-4 left-0 right-0 z-40 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div
                className={`bg-card border-2 border-primary/30 rounded-2xl shadow-xl p-3 flex items-center gap-3 max-w-md mx-auto ${isIOS ? 'cursor-pointer active:opacity-80' : ''}`}
                onClick={isIOS ? () => setShowGuide(true) : undefined}
                role={isIOS ? 'button' : undefined}
                aria-label={isIOS ? 'Show install guide' : undefined}
              >
                <img
                  src="/pwa-192x192.png"
                  alt="Travela"
                  className="w-10 h-10 rounded-xl flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-primary" />
                    Install Travela
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIOS
                      ? 'Tap here for easy step-by-step instructions'
                      : 'Add to home screen for the best experience'}
                  </p>
                </div>
                {!isIOS && (
                  <Button size="sm" onClick={handleInstall} className="flex-shrink-0 font-semibold shadow-md">
                    Install
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
            </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
