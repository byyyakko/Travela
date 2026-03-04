import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    expect(screen.getByText(/Tap to add to your Home Screen/i)).toBeInTheDocument()
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
