/**
 * SettingsPanel Component
 *
 * Right-side slide-out drawer for app settings.
 * Scrollable to handle any viewport size and future settings additions.
 * Matches the forge-metal PoE aesthetic used across the app.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Type, Sun, Shield, ShoppingBag, X, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettingsStore, type FontScale, type BrightnessLevel } from '../../store/settingsSlice';

const FONT_SCALES: { value: FontScale; label: string; description: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Smaller text, more content visible' },
  { value: 'normal', label: 'Normal', description: 'Default reading size' },
  { value: 'large', label: 'Large', description: 'Larger text for readability' },
];

function SessionIdHelp() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative ml-auto">
      <button
        onClick={(e) => { e.stopPropagation(); setShow(prev => !prev); }}
        className="text-slate-500 hover:text-amber-400 transition-colors"
        aria-label="How to find your Session ID"
      >
        <Info className="w-3 h-3" />
      </button>
      {show && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1 z-[60] w-56 rounded-lg p-3',
            'bg-slate-800/95 backdrop-blur border border-slate-600/50',
            'shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[0.6875rem] font-medium text-amber-300/90 mb-2">How to find your Session ID</p>
          <ol className="text-[0.625rem] text-slate-400 leading-relaxed space-y-1.5 list-decimal list-inside">
            <li>Log in to <span className="text-slate-300">pathofexile.com</span></li>
            <li>Press <span className="text-slate-300">F12</span> to open DevTools</li>
            <li>Go to <span className="text-slate-300">Application</span> tab &rarr; <span className="text-slate-300">Cookies</span></li>
            <li>Find <span className="text-slate-300">POESESSID</span> and copy the value</li>
            <li>Paste it here</li>
          </ol>
          <p className="text-[0.5625rem] text-slate-500 mt-2 leading-relaxed">
            This stays on your PC and is only used for trade searches. It expires when you log out of the website.
          </p>
        </div>
      )}
    </div>
  );
}

export function SettingsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const brightness = useSettingsStore((s) => s.brightness);
  const setBrightness = useSettingsStore((s) => s.setBrightness);
  const sessionDataConsent = useSettingsStore((s) => s.sessionDataConsent);
  const setSessionDataConsent = useSettingsStore((s) => s.setSessionDataConsent);
  const poesessid = useSettingsStore((s) => s.poesessid);
  const setPoesessid = useSettingsStore((s) => s.setPoesessid);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'group relative flex items-center justify-center',
          'w-8 h-8 rounded-lg',
          'bg-gradient-to-b from-slate-700/30 to-slate-800/50',
          'border border-slate-600/20 hover:border-slate-500/30',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.2)]',
          'hover:shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_1px_4px_rgba(0,0,0,0.3)]',
          'transition-all duration-200',
          'focus:outline-none focus:ring-1 focus:ring-amber-500/30',
          isOpen && 'border-amber-500/30 shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_0_8px_rgba(251,191,36,0.06)]'
        )}
        title="Settings"
        aria-label="Settings"
        aria-expanded={isOpen}
      >
        <Settings
          className={cn(
            'w-4 h-4',
            'text-slate-500 group-hover:text-amber-400',
            'transition-all duration-200',
            isOpen && 'text-amber-400',
            isOpen && 'animate-[spin_0.5s_ease-out]'
          )}
        />
      </button>

      {/* Drawer Panel + Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={close}
            />

            {/* Slide-out panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed top-0 right-0 z-50 h-full w-80',
                'bg-slate-900/98 backdrop-blur-xl',
                'border-l border-slate-700/60',
                'shadow-[-8px_0_32px_rgba(0,0,0,0.6)]',
                'flex flex-col',
              )}
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-amber-400/80" />
                  <span className="text-sm font-display font-medium text-amber-400/90 uppercase tracking-widest">
                    Settings
                  </span>
                </div>
                <button
                  onClick={close}
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-lg',
                    'text-slate-500 hover:text-slate-300',
                    'hover:bg-slate-800/60',
                    'transition-all duration-150',
                  )}
                  aria-label="Close settings"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-fantasy">
                {/* Display Section Header */}
                <div className="px-5 py-3 border-b border-slate-700/40">
                  <span className="text-xs font-display font-medium text-amber-400/80 uppercase tracking-widest">
                    Display
                  </span>
                </div>

                {/* Font Scale Section */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Type className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400">Text Size</span>
                  </div>

                  <div className="space-y-1">
                    {FONT_SCALES.map(({ value, label, description }) => (
                      <button
                        key={value}
                        onClick={() => setFontScale(value)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                          'transition-all duration-150',
                          fontScale === value
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'hover:bg-slate-800/60 border border-transparent'
                        )}
                      >
                        {/* Size indicator */}
                        <div
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0',
                            'border transition-all duration-150',
                            fontScale === value
                              ? 'bg-amber-500/15 border-amber-500/40'
                              : 'bg-slate-800/50 border-slate-700/40'
                          )}
                        >
                          <span
                            className={cn(
                              'font-display font-semibold transition-colors duration-150',
                              fontScale === value ? 'text-amber-400' : 'text-slate-500',
                              value === 'compact' && 'text-xs',
                              value === 'normal' && 'text-sm',
                              value === 'large' && 'text-base',
                            )}
                          >
                            A
                          </span>
                        </div>

                        <div className="text-left min-w-0">
                          <div
                            className={cn(
                              'text-sm font-medium transition-colors duration-150',
                              fontScale === value ? 'text-amber-200' : 'text-slate-300'
                            )}
                          >
                            {label}
                          </div>
                          <div className="text-[0.6875rem] text-slate-500 leading-tight">
                            {description}
                          </div>
                        </div>

                        {/* Active indicator dot */}
                        {fontScale === value && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brightness Section */}
                <div className="p-4 border-t border-slate-700/40">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Sun className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400">Brightness</span>
                  </div>

                  <div className="px-1">
                    <div className="flex items-center gap-2">
                      {([0, 1, 2, 3, 4] as BrightnessLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setBrightness(level)}
                          className={cn(
                            'flex-1 h-2 rounded-full transition-all duration-150',
                            level <= brightness
                              ? 'bg-amber-400/70'
                              : 'bg-slate-700/60 hover:bg-slate-600/60',
                          )}
                          title={level === 0 ? 'Default' : `Brightness ${level}`}
                          aria-label={level === 0 ? 'Default brightness' : `Brightness level ${level}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[0.625rem] text-slate-600">Default</span>
                      <span className="text-[0.625rem] text-slate-600">Brighter</span>
                    </div>
                  </div>
                </div>

                {/* Trade API Section Header */}
                <div className="px-5 py-3 border-t border-slate-700/40">
                  <span className="text-xs font-display font-medium text-amber-400/80 uppercase tracking-widest">
                    Trade API
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400">PoE Session ID</span>
                    <SessionIdHelp />
                  </div>
                  <div className="px-1 space-y-2">
                    <p className="text-[0.625rem] text-slate-500 leading-relaxed">
                      Speeds up trade searches. Without it, GGG heavily rate-limits requests.
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="password"
                        value={poesessid}
                        onChange={(e) => setPoesessid(e.target.value)}
                        placeholder="POESESSID"
                        className={cn(
                          'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs',
                          'bg-slate-800/60 border border-slate-700/50',
                          'text-slate-300 placeholder:text-slate-600',
                          'focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20',
                          'transition-all duration-150',
                        )}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {poesessid && (
                        <button
                          onClick={() => setPoesessid('')}
                          className={cn(
                            'flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0',
                            'bg-slate-800/40 border border-slate-700/40',
                            'text-slate-500 hover:text-red-400 hover:border-red-500/30',
                            'transition-all duration-150',
                          )}
                          title="Clear session ID"
                          aria-label="Clear session ID"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {poesessid && (
                      <p className="text-[0.5625rem] text-emerald-500/70">Session ID configured</p>
                    )}
                  </div>
                </div>

                {/* Privacy Section Header */}
                <div className="px-5 py-3 border-t border-slate-700/40">
                  <span className="text-xs font-display font-medium text-amber-400/80 uppercase tracking-widest">
                    Privacy
                  </span>
                </div>

                {/* Data Sharing */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Shield className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400">Session Data</span>
                  </div>
                  <div className="px-1 space-y-2">
                    <p className="text-[0.625rem] text-slate-500 leading-relaxed">
                      Allow session logs to be stored on the server to help debug issues you report.
                    </p>
                    <div className="flex items-center justify-between">
                      {/* Toggle */}
                      <button
                        onClick={() => setSessionDataConsent(sessionDataConsent === true ? false : true)}
                        className={cn(
                          'relative w-9 h-5 rounded-full transition-all duration-200',
                          sessionDataConsent === true
                            ? 'bg-amber-500/30 border border-amber-500/50'
                            : 'bg-slate-700/60 border border-slate-600/40',
                        )}
                        aria-label="Toggle session data sharing"
                        role="switch"
                        aria-checked={sessionDataConsent === true}
                      >
                        <div
                          className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200',
                            sessionDataConsent === true
                              ? 'left-[1.125rem] bg-amber-400'
                              : 'left-0.5 bg-slate-400',
                          )}
                        />
                      </button>
                      <span className="text-[0.625rem] text-slate-500">
                        {sessionDataConsent === undefined ? 'Ask each time' : sessionDataConsent ? 'Always share' : 'Never share'}
                      </span>
                    </div>
                    {/* Reset to "ask each time" when explicitly set */}
                    {sessionDataConsent !== undefined && (
                      <button
                        onClick={() => setSessionDataConsent(undefined)}
                        className="text-[0.625rem] text-amber-500/60 hover:text-amber-400 transition-colors"
                      >
                        Reset to ask each time
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
