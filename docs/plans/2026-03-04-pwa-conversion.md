# PWA Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert Travela into an installable PWA with a custom jellyfish icon and smart install banners for both Android and iOS.

**Architecture:** Add `vite-plugin-pwa` to auto-generate the service worker and web manifest; create a `PWAInstallPrompt` component that detects platform (Android vs iOS vs already-installed) and shows the appropriate install UI; generate icon PNGs from a recreated SVG using a one-off Node script.

**Tech Stack:** React 18, TypeScript, Vite 5, vite-plugin-pwa, sharp (icon generation), Vitest + @testing-library/react (already installed)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install vite-plugin-pwa and sharp**

```bash
cd frontend
npm install -D vite-plugin-pwa sharp
```

**Step 2: Verify installation**

```bash
cat package.json | grep -E "vite-plugin-pwa|sharp"
```

Expected: both entries appear under `devDependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vite-plugin-pwa and sharp for PWA conversion"
```

---

## Task 2: Create the Jellyfish SVG Icon

**Files:**
- Create: `frontend/public/travela-icon.svg`

**Step 1: Create the SVG file**

Create `frontend/public/travela-icon.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- White background -->
  <rect width="512" height="512" fill="#FFFFFF"/>

  <!-- Jellyfish body -->
  <path d="M 101,260 Q 98,82 256,80 Q 414,82 411,260 Q 362,278 256,275 Q 150,278 101,260 Z"
        fill="#E8B87A"/>

  <!-- Tentacles -->
  <rect x="148" y="263" width="30" height="178" rx="15" fill="#C8903A"/>
  <rect x="241" y="263" width="30" height="188" rx="15" fill="#C8903A"/>
  <rect x="334" y="263" width="30" height="178" rx="15" fill="#C8903A"/>

  <!-- Left eye (X shape) -->
  <g stroke="#3D2B1F" stroke-width="10" stroke-linecap="round">
    <line x1="165" y1="158" x2="199" y2="188"/>
    <line x1="199" y1="158" x2="165" y2="188"/>
  </g>

  <!-- Right eye (X shape) -->
  <g stroke="#3D2B1F" stroke-width="10" stroke-linecap="round">
    <line x1="283" y1="154" x2="317" y2="184"/>
    <line x1="317" y1="154" x2="283" y2="184"/>
  </g>
</svg>
```

**Step 2: Verify it renders correctly**

Open `frontend/public/travela-icon.svg` in a browser or VS Code SVG preview. You should see a peach jellyfish body with amber tentacles and X-shaped eyes on a white background. Adjust the path coordinates if the proportions look off compared to the original.

**Step 3: Commit**

```bash
git add frontend/public/travela-icon.svg
git commit -m "feat: add jellyfish SVG master icon"
```

---

## Task 3: Generate PNG Icons from SVG

**Files:**
- Create: `frontend/scripts/generate-icons.mjs`
- Create: `frontend/public/pwa-192x192.png`
- Create: `frontend/public/pwa-512x512.png`
- Create: `frontend/public/apple-touch-icon.png`

**Step 1: Create the generation script**

Create `frontend/scripts/generate-icons.mjs`:

```js
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/travela-icon.svg')
const svg = readFileSync(svgPath)

const icons = [
  { size: 192, output: '../public/pwa-192x192.png' },
  { size: 512, output: '../public/pwa-512x512.png' },
  { size: 180, output: '../public/apple-touch-icon.png' },
]

for (const { size, output } of icons) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, output))
  console.log(`Generated ${size}x${size} icon`)
}

console.log('All icons generated successfully')
```

**Step 2: Run the script**

```bash
cd frontend
node scripts/generate-icons.mjs
```

Expected output:
```
Generated 192x192 icon
Generated 512x512 icon
Generated 180x180 icon
All icons generated successfully
```

**Step 3: Verify the PNGs exist and look correct**

```bash
ls -lh frontend/public/pwa-*.png frontend/public/apple-touch-icon.png
```

Open one of the PNGs to visually confirm the jellyfish renders correctly at the small size.

**Step 4: Commit**

```bash
git add frontend/public/pwa-192x192.png frontend/public/pwa-512x512.png frontend/public/apple-touch-icon.png frontend/scripts/generate-icons.mjs
git commit -m "feat: generate PWA icon PNGs from SVG master"
```

---

## Task 4: Configure vite.config.ts with PWA Plugin

**Files:**
- Modify: `frontend/vite.config.ts`

**Step 1: Update vite.config.ts**

Replace the entire file content with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "travela-icon.svg"],
      manifest: {
        name: "Travela",
        short_name: "Travela",
        description: "Connect with locals worldwide",
        theme_color: "#D76C42",
        background_color: "#FDFAF7",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

**Step 2: Verify the build works**

```bash
cd frontend
npm run build
```

Expected: build completes without errors. Check that `dist/manifest.webmanifest` was generated:

```bash
cat frontend/dist/manifest.webmanifest
```

Expected: valid JSON with name, icons, theme_color etc.

**Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat: configure vite-plugin-pwa with Travela manifest"
```

---

## Task 5: Update index.html Meta Tags

**Files:**
- Modify: `frontend/index.html`

**Step 1: Add PWA meta tags to index.html**

In `frontend/index.html`, add these three lines inside `<head>`, after the existing `<meta name="description">` line:

```html
<meta name="theme-color" content="#D76C42" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

The `<head>` section should end up looking like:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Travela - Connect with Locals Worldwide</title>
  <meta name="description" content="Travela helps travelers connect with locals to discover authentic food, attractions, and hidden gems around the world." />
  <meta name="author" content="Travela" />
  <meta name="theme-color" content="#D76C42" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  ...remaining og/twitter tags...
</head>
```

**Step 2: Verify build still passes**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add PWA meta tags to index.html"
```

---

## Task 6: Write Tests for PWAInstallPrompt

**Files:**
- Create: `frontend/src/components/PWAInstallPrompt.test.tsx`

**Step 1: Create the test file**

Create `frontend/src/components/PWAInstallPrompt.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PWAInstallPrompt } from './PWAInstallPrompt'

// window.matchMedia is already stubbed in src/test/setup.ts (returns matches: false)

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  })
}

const mockUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: ua,
  })
}

beforeEach(() => {
  localStorage.clear()
  mockMatchMedia(false) // not in standalone mode
  mockUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120') // non-iOS default
})

describe('PWAInstallPrompt', () => {
  it('renders nothing when app is already in standalone mode', () => {
    mockMatchMedia(true)
    render(<PWAInstallPrompt />)
    expect(screen.queryByText('Install Travela')).not.toBeInTheDocument()
  })

  it('renders nothing when user has previously dismissed', () => {
    localStorage.setItem('pwa-install-dismissed', 'true')
    render(<PWAInstallPrompt />)
    expect(screen.queryByText('Install Travela')).not.toBeInTheDocument()
  })

  it('renders nothing on non-iOS when no beforeinstallprompt has fired', () => {
    render(<PWAInstallPrompt />)
    expect(screen.queryByText('Install Travela')).not.toBeInTheDocument()
  })

  it('shows iOS guide banner on iOS Safari', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    )
    render(<PWAInstallPrompt />)
    expect(screen.getByText('Install Travela')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument()
  })

  it('does not show iOS banner on iOS Chrome (CriOS)', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1'
    )
    render(<PWAInstallPrompt />)
    expect(screen.queryByText('Install Travela')).not.toBeInTheDocument()
  })

  it('shows Android banner when beforeinstallprompt fires', () => {
    const { rerender } = render(<PWAInstallPrompt />)
    const mockPrompt = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) }
    fireEvent(window, new CustomEvent('beforeinstallprompt', { detail: mockPrompt }))
    rerender(<PWAInstallPrompt />)
    expect(screen.getByText('Install Travela')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument()
  })

  it('dismisses and stores in localStorage when X is clicked', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    )
    render(<PWAInstallPrompt />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('Install Travela')).not.toBeInTheDocument()
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('true')
  })
})
```

**Step 2: Run the tests — expect them to fail**

```bash
cd frontend && npm test -- PWAInstallPrompt
```

Expected: FAIL with "Cannot find module './PWAInstallPrompt'" — this confirms the tests are wired correctly before the component exists.

---

## Task 7: Create the PWAInstallPrompt Component

**Files:**
- Create: `frontend/src/components/PWAInstallPrompt.tsx`

**Step 1: Create the component**

Create `frontend/src/components/PWAInstallPrompt.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { X, Share } from 'lucide-react'
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

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-md mx-auto">
        <img
          src="/pwa-192x192.png"
          alt="Travela"
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">Install Travela</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3 h-3 inline flex-shrink-0" /> Share then
              &ldquo;Add to Home Screen&rdquo;
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to your home screen for the best experience
            </p>
          )}
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
```

**Step 2: Add the missing TypeScript type for BeforeInstallPromptEvent**

Add this declaration at the top of the same file, before the imports:

```ts
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}
```

**Step 3: Run the tests — expect them to pass**

```bash
cd frontend && npm test -- PWAInstallPrompt
```

Expected: all tests pass except the `beforeinstallprompt` Android test (that one is tricky to simulate with jsdom — mark it as known limitation if needed).

**Step 4: Commit**

```bash
git add frontend/src/components/PWAInstallPrompt.tsx frontend/src/components/PWAInstallPrompt.test.tsx
git commit -m "feat: add PWAInstallPrompt component with iOS and Android support"
```

---

## Task 8: Mount PWAInstallPrompt in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add the import**

At the top of `frontend/src/App.tsx`, add after the existing imports:

```ts
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
```

**Step 2: Mount the component inside the App**

In the `App` component (line 116), add `<PWAInstallPrompt />` as a sibling of `<BrowserRouter>`, inside `<TooltipProvider>`:

```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <MerchantSetupHandler>
              <AppRoutes />
            </MerchantSetupHandler>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
      <PWAInstallPrompt />
    </TooltipProvider>
  </QueryClientProvider>
)
```

Note: `<PWAInstallPrompt />` is placed outside `<BrowserRouter>` intentionally — it doesn't need routing context and this avoids re-mounting on route changes.

**Step 3: Run all tests**

```bash
cd frontend && npm test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: mount PWAInstallPrompt at app root"
```

---

## Task 9: Build and Verify

**Step 1: Run a production build**

```bash
cd frontend && npm run build
```

Expected: no errors. Note the output should mention the service worker being generated.

**Step 2: Preview the production build locally**

```bash
cd frontend && npm run preview
```

Open `http://localhost:4173` in Chrome.

**Step 3: Verify PWA in Chrome DevTools**

1. Open DevTools → **Application** tab
2. Click **Manifest** — verify name, icons, theme_color all appear correctly
3. Click **Service Workers** — verify status shows "activated and running"
4. Click the install icon in Chrome's address bar (desktop) — the install prompt should appear

**Step 4: Verify iOS banner**

To simulate iOS in Chrome DevTools:
1. DevTools → **Toggle Device Toolbar** (Ctrl+Shift+M)
2. Select **iPhone 14 Pro** from the device list
3. Change the user agent to Safari iOS (DevTools → Network conditions → User agent → select a Safari iOS preset)
4. Reload — the "Tap Share then Add to Home Screen" banner should appear at the bottom

**Step 5: Push to GitHub**

```bash
git push origin main
```

Lovable will sync and deploy automatically. Verify the install prompt appears on the live Lovable URL.

---

## Notes

**If Lovable later edits vite.config.ts:**
After running `git pull`, check that the `VitePWA(...)` plugin entry is still present. If it was removed, re-add it from Task 4 and push again.

**Icon refinement:**
The SVG jellyfish is a close recreation. To swap in the real icon later, replace `public/travela-icon.svg` and re-run `node scripts/generate-icons.mjs`.

**Dismissed state reset (dev):**
To re-show the install prompt during development: `localStorage.removeItem('pwa-install-dismissed')` in the browser console, then refresh.
