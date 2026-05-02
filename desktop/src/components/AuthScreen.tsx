/**
 * AuthScreen Component - Authentication Gate
 *
 * Full-screen overlay shown in production when no valid session exists.
 * Supports sign-in, account creation, and password reset flows.
 * Uses the Onyx Gold theme.
 *
 * @module desktop/src/components/AuthScreen
 */

import { useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../lib/utils';
import { openExternal } from '../utils/open-external';
import { pushSessionTokenToLocalBackend } from '../services/session-token';
import {
  remoteSignIn,
  remoteCreateAccount,
  remoteRequestPasswordReset,
  remoteResendVerification,
  AuthApiError,
} from '../services/auth-api';

// ============================================
// Constants
// ============================================

const MIN_PASSWORD_LENGTH = 12;
const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 40;
const TERMS_URL = 'https://pathofagent.com/terms';
const PRIVACY_URL = 'https://pathofagent.com/privacy';

// ============================================
// Types
// ============================================

type AuthMode = 'signin' | 'create' | 'forgot';
type SuccessState = 'account-created' | 'reset-sent' | null;

interface AuthScreenProps {
  onAuthenticated: () => void;
}

// ============================================
// Validation
// ============================================

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Please enter your email';
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return 'Please enter your password';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Please enter a display name';
  if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) {
    return `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters`;
  }
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`;
  }
  return null;
}

// ============================================
// Component
// ============================================

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [successState, setSuccessState] = useState<SuccessState>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // ------------------------------------------
  // Mode switching
  // ------------------------------------------

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessState(null);
    setShowPassword(false);
    // Keep email across mode switches for convenience
  }, []);

  // ------------------------------------------
  // Sign In
  // ------------------------------------------

  const handleSignIn = useCallback(async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    if (!password) { setError('Please enter your password'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await remoteSignIn(email.trim(), password);

      // Store session token in Tauri config (persists for next launch)
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('store_session_token', { token: response.sessionToken });

      // Push token to the already-running sidecar so proxy calls work immediately
      try {
        await pushSessionTokenToLocalBackend(response.sessionToken);
      } catch {
        // Sidecar may not be ready yet — token will be picked up on next restart
        console.warn('[AuthScreen] Failed to push session token to sidecar');
      }

      onAuthenticated();
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'email_not_verified') {
          setError('Your email has not been verified. Please check your inbox (and spam folder).');
        } else {
          setError(err.message);
        }
      } else {
        // Show actual error for debugging
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Connection error: ${msg}`);
      }
      setIsSubmitting(false);
    }
  }, [email, password, onAuthenticated]);

  // ------------------------------------------
  // Create Account
  // ------------------------------------------

  const handleCreateAccount = useCallback(async () => {
    const nameErr = validateDisplayName(displayName);
    if (nameErr) { setError(nameErr); return; }

    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    const passErr = validatePassword(password);
    if (passErr) { setError(passErr); return; }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!tosAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await remoteCreateAccount(email.trim(), password, displayName.trim());
      setSuccessState('account-created');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to the server. Please check your internet connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, confirmPassword, displayName, tosAccepted]);

  // ------------------------------------------
  // Forgot Password
  // ------------------------------------------

  const handleForgotPassword = useCallback(async () => {
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      await remoteRequestPasswordReset(email.trim());
      setSuccessState('reset-sent');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to the server. Please check your internet connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email]);

  // ------------------------------------------
  // Resend verification
  // ------------------------------------------

  const handleResendVerification = useCallback(async () => {
    setIsResending(true);
    setError(null);

    try {
      await remoteResendVerification(email.trim());
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to the server. Please check your internet connection.');
      }
    } finally {
      setIsResending(false);
    }
  }, [email]);

  // ------------------------------------------
  // Form submission
  // ------------------------------------------

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    switch (mode) {
      case 'signin': void handleSignIn(); break;
      case 'create': void handleCreateAccount(); break;
      case 'forgot': void handleForgotPassword(); break;
    }
  }, [mode, isSubmitting, handleSignIn, handleCreateAccount, handleForgotPassword]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSubmitting],
  );

  // ------------------------------------------
  // Derived state
  // ------------------------------------------

  const isCreateDisabled =
    isSubmitting ||
    !email.trim() ||
    !password ||
    !confirmPassword ||
    !displayName.trim() ||
    !tosAccepted;

  // ------------------------------------------
  // Card header config
  // ------------------------------------------

  const headerConfig = {
    signin: {
      icon: LogIn,
      title: 'Sign In',
      subtitle: 'Welcome back, Exile',
    },
    create: {
      icon: UserPlus,
      title: 'Create Account',
      subtitle: 'Join the hunt',
    },
    forgot: {
      icon: ShieldCheck,
      title: 'Reset Password',
      subtitle: "We'll send you a reset link",
    },
  } as const;

  const { icon: HeaderIcon, title, subtitle } = headerConfig[mode];

  // ------------------------------------------
  // Render
  // ------------------------------------------

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background layer - cosmic void (matches rest of app) */}
      <div className="absolute inset-0 z-0">
        <img
          src="/mockups/cosmic-void-bg.png"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-950/30" />
      </div>

      {/* Atmosphere + vignette + grain (matches rest of app) */}
      <div className="absolute inset-0 z-[1] bg-forge-atmosphere-translucent vignette-overlay grain-overlay pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full flex justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-md my-auto py-8">
          {/* Logo / Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="relative">
                <img src={seerIcon} alt="Path of Agent" className="w-12 h-12 rounded-full drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]" />
                <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full scale-150" />
              </div>
            </div>
            <h1 className="text-4xl font-display font-bold tracking-widest uppercase text-glow-amber"
              style={{
                background: 'linear-gradient(180deg, #fcd34d 0%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.3))',
              }}
            >
              Path of Agent
            </h1>
            <p className="text-sm text-slate-400/80 mt-3 tracking-wide font-light">
              Agent-driven build analysis for Path of Exile
            </p>
          </div>

          {/* Auth Card */}
          <div
            className={cn(
              'rounded-xl overflow-hidden',
              'bg-slate-900/40 backdrop-blur-sm',
              'border border-slate-700/50',
              'shadow-2xl shadow-black/50',
            )}
          >
            {/* Card Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    'bg-amber-500/10 border border-amber-500/30',
                  )}
                >
                  <HeaderIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-semibold text-slate-200">
                    {title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-5">
              {/* ---------- SUCCESS: Account Created ---------- */}
              {successState === 'account-created' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="relative mb-4">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      <div className="absolute inset-0 blur-xl bg-emerald-500/25 rounded-full" />
                    </div>
                    <h3 className="text-sm font-display font-semibold text-slate-200 mb-2">
                      Check your email
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      We sent a verification link to{' '}
                      <span className="text-slate-300">{email}</span>.
                      Please verify your email to sign in.
                      <br />
                      <span className="text-slate-600 italic">
                        Not seeing it? Check your spam or junk folder.
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => void handleResendVerification()}
                    disabled={isResending}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg',
                      'bg-slate-800/60 border border-slate-700/50',
                      'hover:bg-slate-800/80 hover:border-slate-600/50',
                      'text-slate-300 text-sm font-medium',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'transition-all duration-200',
                      'flex items-center justify-center gap-2',
                    )}
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Resend verification email
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className={cn(
                      'flex items-center gap-1 text-xs mx-auto',
                      'text-amber-500/70 hover:text-amber-400',
                      'transition-colors duration-200',
                    )}
                  >
                    Back to sign in
                  </button>
                </div>
              )}

              {/* ---------- SUCCESS: Reset Sent ---------- */}
              {successState === 'reset-sent' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="relative mb-4">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      <div className="absolute inset-0 blur-xl bg-emerald-500/25 rounded-full" />
                    </div>
                    <h3 className="text-sm font-display font-semibold text-slate-200 mb-2">
                      Reset link sent
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      If an account exists for{' '}
                      <span className="text-slate-300">{email}</span>,
                      you will receive an email with a reset link.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className={cn(
                      'flex items-center gap-1 text-xs mx-auto',
                      'text-amber-500/70 hover:text-amber-400',
                      'transition-colors duration-200',
                    )}
                  >
                    Back to sign in
                  </button>
                </div>
              )}

              {/* ---------- FORM: Sign In ---------- */}
              {mode === 'signin' && !successState && (
                <>
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="exile@wraeclast.com"
                      disabled={isSubmitting}
                      autoFocus
                      autoComplete="email"
                      className={cn(
                        'w-full px-4 py-3 rounded-sm',
                        'bg-slate-950/60 border',
                        error
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50'
                          : 'border-slate-700/50 focus:ring-amber-500/30 focus:border-amber-500/40',
                        'text-slate-200 placeholder-slate-600 text-sm',
                        'focus:outline-none focus:ring-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                      )}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter your password"
                        disabled={isSubmitting}
                        autoComplete="current-password"
                        className={cn(
                          'w-full px-4 py-3 pr-12 rounded-sm',
                          'bg-slate-950/60 border',
                          error
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50'
                            : 'border-slate-700/50 focus:ring-amber-500/30 focus:border-amber-500/40',
                          'text-slate-200 placeholder-slate-600 text-sm',
                          'focus:outline-none focus:ring-1',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'transition-all duration-200',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={cn(
                          'absolute right-3 top-1/2 -translate-y-1/2',
                          'p-1 rounded text-slate-500 hover:text-slate-300',
                          'transition-colors duration-150',
                        )}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      'text-amber-500/70 hover:text-amber-400',
                      'transition-colors duration-200',
                    )}
                  >
                    Forgot your password?
                  </button>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={() => void handleSignIn()}
                    disabled={isSubmitting || !email.trim() || !password}
                    className={cn(
                      'w-full px-4 py-3.5 rounded-lg',
                      'bg-gradient-to-r from-amber-600 to-amber-500',
                      'hover:from-amber-500 hover:to-amber-400',
                      'text-black font-display font-semibold text-sm',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'disabled:hover:from-amber-600 disabled:hover:to-amber-500',
                      'transition-all duration-200',
                      'flex items-center justify-center gap-2',
                      'shadow-lg shadow-amber-500/20',
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </>
              )}

              {/* ---------- FORM: Create Account ---------- */}
              {mode === 'create' && !successState && (
                <>
                  {/* Display Name */}
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Display Name
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Your display name"
                      disabled={isSubmitting}
                      autoFocus
                      autoComplete="username"
                      className={cn(
                        'w-full px-4 py-3 rounded-sm',
                        'bg-slate-950/60 border border-slate-700/50',
                        'focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/40',
                        'text-slate-200 placeholder-slate-600 text-sm',
                        'focus:outline-none',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                      )}
                    />
                    <p className="text-[0.6875rem] text-slate-600 mt-1.5">
                      {MIN_DISPLAY_NAME_LENGTH}-{MAX_DISPLAY_NAME_LENGTH} characters
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="auth-create-email"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Email
                    </label>
                    <input
                      id="auth-create-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="exile@wraeclast.com"
                      disabled={isSubmitting}
                      autoComplete="email"
                      className={cn(
                        'w-full px-4 py-3 rounded-sm',
                        'bg-slate-950/60 border border-slate-700/50',
                        'focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/40',
                        'text-slate-200 placeholder-slate-600 text-sm',
                        'focus:outline-none',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                      )}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="auth-create-password"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-create-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Choose a strong password"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        className={cn(
                          'w-full px-4 py-3 pr-12 rounded-sm',
                          'bg-slate-950/60 border border-slate-700/50',
                          'focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/40',
                          'text-slate-200 placeholder-slate-600 text-sm',
                          'focus:outline-none',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'transition-all duration-200',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={cn(
                          'absolute right-3 top-1/2 -translate-y-1/2',
                          'p-1 rounded text-slate-500 hover:text-slate-300',
                          'transition-colors duration-150',
                        )}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[0.6875rem] text-slate-600 mt-1.5">
                      Minimum {MIN_PASSWORD_LENGTH} characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Repeat your password"
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      className={cn(
                        'w-full px-4 py-3 rounded-sm',
                        'bg-slate-950/60 border border-slate-700/50',
                        'focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/40',
                        'text-slate-200 placeholder-slate-600 text-sm',
                        'focus:outline-none',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                      )}
                    />
                  </div>

                  {/* Terms of Service */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={tosAccepted}
                      onChange={(e) => {
                        setTosAccepted(e.target.checked);
                        if (error) setError(null);
                      }}
                      disabled={isSubmitting}
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded border border-slate-600',
                        'bg-slate-950/60 text-amber-500',
                        'focus:ring-1 focus:ring-amber-500/30',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    />
                    <span className="text-xs text-slate-500 leading-relaxed">
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExternal(TERMS_URL); }}
                        className="text-amber-500/70 hover:text-amber-400 transition-colors underline underline-offset-2"
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExternal(PRIVACY_URL); }}
                        className="text-amber-500/70 hover:text-amber-400 transition-colors underline underline-offset-2"
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={() => void handleCreateAccount()}
                    disabled={isCreateDisabled}
                    className={cn(
                      'w-full px-4 py-3.5 rounded-lg',
                      'bg-gradient-to-r from-amber-600 to-amber-500',
                      'hover:from-amber-500 hover:to-amber-400',
                      'text-black font-display font-semibold text-sm',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'disabled:hover:from-amber-600 disabled:hover:to-amber-500',
                      'transition-all duration-200',
                      'flex items-center justify-center gap-2',
                      'shadow-lg shadow-amber-500/20',
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </>
              )}

              {/* ---------- FORM: Forgot Password ---------- */}
              {mode === 'forgot' && !successState && (
                <>
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="auth-reset-email"
                      className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"
                    >
                      Email
                    </label>
                    <input
                      id="auth-reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="exile@wraeclast.com"
                      disabled={isSubmitting}
                      autoFocus
                      autoComplete="email"
                      className={cn(
                        'w-full px-4 py-3 rounded-sm',
                        'bg-slate-950/60 border border-slate-700/50',
                        'focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/40',
                        'text-slate-200 placeholder-slate-600 text-sm',
                        'focus:outline-none',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                      )}
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={() => void handleForgotPassword()}
                    disabled={isSubmitting || !email.trim()}
                    className={cn(
                      'w-full px-4 py-3.5 rounded-lg',
                      'bg-gradient-to-r from-amber-600 to-amber-500',
                      'hover:from-amber-500 hover:to-amber-400',
                      'text-black font-display font-semibold text-sm',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'disabled:hover:from-amber-600 disabled:hover:to-amber-500',
                      'transition-all duration-200',
                      'flex items-center justify-center gap-2',
                      'shadow-lg shadow-amber-500/20',
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer links */}
          {!successState && (
            <p className="text-center text-[0.6875rem] text-slate-600 mt-6">
              {mode === 'signin' && (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('create')}
                    className="text-amber-500/70 hover:text-amber-400 transition-colors"
                  >
                    Create one
                  </button>
                </>
              )}
              {mode === 'create' && (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-amber-500/70 hover:text-amber-400 transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-amber-500/70 hover:text-amber-400 transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
