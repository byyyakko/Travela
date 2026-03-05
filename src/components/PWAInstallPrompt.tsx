declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}

import { useState, useEffect } from 'react'
import { X, Plus, MoreHorizontal, Download, Smartphone } from 'lucide-react'
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
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
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

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
    setShowGuide(false)
  }

  const handleCloseGuide = () => setShowGuide(false)

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
          <>
            {/* Eye-catching top banner */}
            <motion.div
              className="fixed top-0 left-0 right-0 z-[60]"
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              transition={{ type: 'spring', damping: 20, delay: 0.3 }}
            >
              <div
                className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-center gap-3 cursor-pointer"
                onClick={isIOS ? () => setShowGuide(true) : handleInstall}
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                >
                  <Download className="w-5 h-5" />
                </motion.div>
                <p className="text-sm font-semibold">
                  📲 Get the Travela App — Install it free for the best experience!
                </p>
                <button
                  onClick={handleDismiss}
                  aria-label="Dismiss"
                  className="ml-2 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            {/* Bottom floating card */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-safe"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', damping: 20, delay: 0.5 }}
            >
              <div
                className={`bg-card border-2 border-primary/30 rounded-2xl shadow-xl p-4 flex items-center gap-4 max-w-md mx-auto ${isIOS ? 'cursor-pointer active:opacity-80' : ''}`}
                onClick={isIOS ? () => setShowGuide(true) : undefined}
                role={isIOS ? 'button' : undefined}
                aria-label={isIOS ? 'Show install guide' : undefined}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Travela"
                    className="w-12 h-12 rounded-xl"
                  />
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-primary" />
                    Install Travela
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIOS
                      ? 'Tap here for easy step-by-step instructions'
                      : 'Add to home screen — works offline, loads instantly!'}
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
          </>
        )}
      </AnimatePresence>
    </>
  )
}
