# PWA Conversion Design — Travela
**Date:** 2026-03-04
**Scope:** Installable PWA with iOS + Android install prompts
**Approach:** Claude writes all code locally, user pushes to GitHub, Lovable syncs

---

## Goals
- Users can install Travela to their home screen on Android and iOS
- App launches in standalone mode (no browser bar)
- Android: automatic install banner via browser `beforeinstallprompt`
- iOS: in-app manual guide banner (Share → Add to Home Screen)
- Matches existing Travela design system (terracotta primary, warm palette)

## Out of Scope
- Offline support / service worker caching
- Push notifications
- Background sync

---

## Architecture

### New Files
| File | Purpose |
|---|---|
| `public/travela-icon.svg` | Master SVG icon (jellyfish character, recreated by Claude) |
| `public/pwa-192x192.png` | Android home screen icon |
| `public/pwa-512x512.png` | Splash screen / high-res icon |
| `public/apple-touch-icon.png` | iOS Add to Home Screen icon (180x180) |
| `src/components/PWAInstallPrompt.tsx` | Smart install banner component |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Add `vite-plugin-pwa` as dev dependency |
| `vite.config.ts` | Add VitePWA plugin with manifest config |
| `index.html` | Add theme-color, apple-touch-icon, manifest meta tags |
| `src/App.tsx` | Mount `<PWAInstallPrompt />` at root |

---

## Component Design: PWAInstallPrompt

### Behaviour
- Mounts at app root, renders a bottom banner
- **Android/desktop**: listens for `beforeinstallprompt` event, shows one-tap "Install" button
- **iOS Safari**: detects `navigator.userAgent` for iOS + Safari (not standalone), shows manual guide
- **Already installed**: detects `window.matchMedia('(display-mode: standalone)')`, renders nothing
- **Dismissed**: stores `pwa-install-dismissed` in `localStorage`, never shows again

### Visual
```
┌─────────────────────────────────────────────┐
│  [icon]  Install Travela               [✕]  │
│  Add to your home screen for the best       │
│  experience                                 │
│                             [Install App]   │
└─────────────────────────────────────────────┘
```

iOS variant replaces button with:
```
  Tap [⬆] Share then "Add to Home Screen"
```

### Styling
- Fixed bottom bar, full width on mobile
- Uses existing shadcn/ui `Card` + `Button` components
- Terracotta primary (`#D76C42`) for the install button
- Warm cream background matching app card style

---

## Manifest Config
```json
{
  "name": "Travela",
  "short_name": "Travela",
  "description": "Connect with locals worldwide",
  "theme_color": "#D76C42",
  "background_color": "#FDFAF7",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## Icon
- Source: Jellyfish character (peach/sandy body `~#E8B87A`, amber tentacles `~#C8903A`, dark X eyes)
- Recreated as clean SVG by Claude based on provided screenshot
- Background: white `#FFFFFF`
- Exported to PNG at required sizes via Sharp/Canvas in a Node script

---

## Lovable Compatibility
- All changes are additive — no existing Lovable-managed logic is removed
- `vite.config.ts` gains one plugin entry; if Lovable edits this file later, the PWA plugin line must be re-added after pulling
- Icon files in `public/` are never touched by Lovable
- `PWAInstallPrompt.tsx` is a standalone component with no coupling to Lovable's generated code
