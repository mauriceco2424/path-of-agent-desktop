/**
 * SessionDataConsentDialog
 *
 * Portal-based consent dialog shown when the user imports a build.
 * Asks whether session data (build info, AI prompts/responses) may be stored
 * on the server for quality improvement and issue debugging.
 */

import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Shield, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../store/settingsSlice';

// =============================================================================
// Props
// =============================================================================

interface SessionDataConsentDialogProps {
  open: boolean;
  onConsent: (allowed: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function SessionDataConsentDialog({
  open,
  onConsent,
}: SessionDataConsentDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const setSessionDataConsent = useSettingsStore((s) => s.setSessionDataConsent);

  const handleAllow = useCallback(() => {
    if (dontAskAgain) {
      setSessionDataConsent(true);
    }
    onConsent(true);
  }, [dontAskAgain, onConsent, setSessionDataConsent]);

  const handleDecline = useCallback(() => {
    if (dontAskAgain) {
      setSessionDataConsent(false);
    }
    onConsent(false);
  }, [dontAskAgain, onConsent, setSessionDataConsent]);

  // ESC key handler (decline)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDecline();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleDecline]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleDecline();
    },
    [handleDecline],
  );

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Session data consent"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Card */}
          <motion.div
            className={cn(
              'relative w-full max-w-md mx-4',
              'card-forge corner-accent rounded-2xl',
              'border border-slate-700/50 bg-slate-900/95 shadow-2xl',
              'overflow-hidden',
            )}
            style={{
              ['--corner-color' as string]: 'rgba(251, 191, 36, 0.4)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4">
              <div className="relative">
                <Shield className="w-5 h-5 text-amber-400" />
                <div className="absolute inset-0 blur-md bg-amber-400/30 rounded-full" />
              </div>
              <h2 className="font-display text-lg font-semibold text-slate-100 tracking-wide">
                Session Data Sharing
              </h2>
              <button
                onClick={handleDecline}
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                To help us improve analysis quality and investigate issues, Path of Agent can store
                your session data on our server. This includes:
              </p>

              <ul className="space-y-1.5 pl-1">
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
                  Build information and configuration
                </li>
                <li className="flex items-start gap-2.5 text-sm text-slate-400">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
                  Agent prompts, tool calls, and responses
                </li>
              </ul>

              <p className="text-xs text-slate-500 leading-relaxed">
                This data is used exclusively to improve the app and debug issues you report.
                It is never shared with third parties. You can change this setting anytime
                in Settings.
              </p>

              <p className="text-xs text-slate-500 leading-relaxed">
                If you report a bug, please include your{' '}
                <span className="text-slate-400 font-medium">Session ID</span>{' '}
                (visible in the top-right corner after import) so we can find the relevant data.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-between">
              {/* Don't ask again checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-all duration-200',
                    dontAskAgain
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'border-slate-600 group-hover:border-slate-500',
                  )}
                  onClick={() => setDontAskAgain(!dontAskAgain)}
                >
                  {dontAskAgain && (
                    <Check className="w-3 h-3 text-amber-400" />
                  )}
                </div>
                <span
                  className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors"
                  onClick={() => setDontAskAgain(!dontAskAgain)}
                >
                  Don't ask again
                </span>
              </label>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleDecline}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium',
                    'text-slate-400 hover:text-slate-200',
                    'bg-slate-800/50 border border-slate-700/50',
                    'hover:bg-slate-800 hover:border-slate-600/50',
                    'transition-all duration-200',
                  )}
                >
                  Decline
                </button>
                <button
                  onClick={handleAllow}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-semibold',
                    'bg-gradient-to-r from-amber-600 to-amber-500',
                    'hover:from-amber-500 hover:to-amber-400',
                    'text-black',
                    'transition-all duration-200',
                  )}
                >
                  <Shield className="w-4 h-4" />
                  Allow
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
