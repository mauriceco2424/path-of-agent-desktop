/**
 * Desktop Application Root Component
 *
 * Main app component with routing and layout.
 * Provides navigation between import and chat pages.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileCode, User, Loader2, ArrowLeft, LogIn, Coins, LogOut } from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from './lib/utils';
import { useDesktopStore } from './store';
import { useSettingsStore } from './store/settingsSlice';
import {
  importBuild,
  fetchCharacterList,
  importCharacter,
  startGGGOAuth,
  exchangeGGGOAuth,
  cancelGGGOAuth,
  type GGGCharacter,
} from './services/tauri-api';
import { ChatPage } from './pages/ChatPage';
import { GeneralChatPage } from './pages/GeneralChatPage';
import { HubPage } from './pages/HubPage';
import { BuildLibraryPage } from './pages/BuildLibraryPage';
import { BuildGuideDetailPage } from './pages/BuildGuideDetailPage';
import { AccountNameInput } from './components/shared/AccountNameInput';
import { useAccountHistory } from './hooks/useAccountHistory';
import { useAuthAccount } from './hooks/useAuthAccount';
import { WindowControls } from './components/ui/WindowControls';
import { DiscordButton } from './components/ui/DiscordButton';
import { VersionBadge } from './components/ui/VersionBadge';
import { UpdateDriver } from './components/ui/UpdateDriver';
import { AuthScreen } from './components/AuthScreen';
import { BackendReadiness } from './components/BackendReadiness';
import { AnalysisHistoryPanel } from './components/AnalysisHistoryPanel';
import { useAnalysisHistoryStore } from './store/analysisHistoryStore';
import { SettingsPopover } from './components/ui/SettingsPopover';
import { SessionDataConsentDialog } from './components/SessionDataConsentDialog';

// ============================================
// Import Page Component - Tabbed UI (PoB Code + Account Import)
// ============================================

type ImportMode = 'pob' | 'account' | 'oauth';
type ImportStep = 'input' | 'select' | 'importing';

function ImportPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Mode selection - default to 'oauth' as the primary import method
  const [mode, setMode] = useState<ImportMode>('oauth');

  // PoB import state
  const [pobCode, setPobCode] = useState('');

  // Account import state
  const [accountName, setAccountName] = useState('');
  const [characters, setCharacters] = useState<GGGCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<GGGCharacter | null>(null);
  const [step, setStep] = useState<ImportStep>('input');

  // OAuth state
  const [isOAuthInProgress, setIsOAuthInProgress] = useState(false);
  const [gggAccessToken, setGggAccessToken] = useState<string | null>(null);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session data consent — shown on each import unless user checked "don't show again"
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingImportAction, setPendingImportAction] = useState<((consent: boolean) => Promise<void>) | null>(null);
  const sessionDataConsent = useSettingsStore((s) => s.sessionDataConsent);

  const setBuild = useDesktopStore((s) => s.setBuild);


  // Auth & credit state (fetches from remote server on mount)
  const authAccount = useAuthAccount();

  // Account history for autocomplete
  const { addToHistory } = useAccountHistory();

  // Group characters by league
  const charactersByLeague = useMemo(() => {
    const grouped: Record<string, GGGCharacter[]> = {};
    for (const char of characters) {
      if (!grouped[char.league]) {
        grouped[char.league] = [];
      }
      grouped[char.league].push(char);
    }
    // Sort leagues: current challenge league first, then other challenge leagues, Standard/Hardcore last
    const currentLeague = 'Mirage';
    const permanentLeagues = ['Standard', 'Hardcore'];
    const leaguePriority = (name: string): number => {
      if (name === currentLeague) return 0;
      if (name.includes(currentLeague)) return 1; // SSF/HC variants
      if (permanentLeagues.includes(name)) return 3;
      return 2; // other challenge leagues
    };
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const diff = leaguePriority(a) - leaguePriority(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
    return sortedKeys.map(league => ({ league, characters: grouped[league] }));
  }, [characters]);


  /**
   * Gate an import action on consent. If the user already persisted a choice
   * ("don't show again"), use it immediately. Otherwise show the dialog —
   * the import proceeds regardless of Allow/Decline, but the consent value
   * is captured onto the build so analysis knows whether to log.
   */
  const withConsentCheck = useCallback((action: (consent: boolean) => Promise<void>) => {
    if (sessionDataConsent !== undefined) {
      // Persisted choice — proceed immediately
      action(sessionDataConsent);
    } else {
      // Show dialog, defer import until user responds
      setPendingImportAction(() => action);
      setShowConsentDialog(true);
    }
  }, [sessionDataConsent]);

  const handleConsentResponse = useCallback((allowed: boolean) => {
    setShowConsentDialog(false);
    const pending = pendingImportAction;
    setPendingImportAction(null);
    if (pending) pending(allowed);
  }, [pendingImportAction]);

  /**
   * Handle PoB import
   */
  const handlePobImport = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = pobCode.trim();
    if (!code) {
      setError('Please paste your PoB code');
      return;
    }

    withConsentCheck(async (consent) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await importBuild(code);

        const charName = result.characterName && result.characterName !== 'Unnamed' ? result.characterName : undefined;

        setBuild({
          buildId: result.buildId,
          characterName: charName,
          class: result.class,
          ascendancy: result.ascendancy,
          level: result.level,
          importedAt: new Date().toISOString(),
          pobCode: code,
          sessionDataConsent: consent,
        });

        // Create a history entry so the build appears in Recent Analyses immediately
        const snapshotId = useAnalysisHistoryStore.getState().saveSnapshot({
          build: { characterName: charName, class: result.class, ascendancy: result.ascendancy, level: result.level, pobCode: code },
          focus: [],
          customPrompt: '',
          label: 'Imported',
          pathwayContent: {},
          isPartial: false,
          completedPathways: [],
          status: 'imported',
        });
        useAnalysisHistoryStore.getState().setActiveSnapshotId(snapshotId);

        toast.success('Build imported successfully!');
        navigate('/chat');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    });
  };

  /**
   * Fetch characters handler
   */
  const handleFetchCharacters = async () => {
    const account = accountName.trim();
    if (!account) {
      setError('Please enter your account name');
      return;
    }

    // Validate format
    if (!account.includes('#')) {
      setError('Please include your discriminator (e.g., MyAccount#1234)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchCharacterList(account);
      setCharacters(result.characters);
      setStep('select');
      addToHistory(account); // Save to history on successful fetch

      if (result.characters.length === 0) {
        setError('No public characters found for this account');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch characters';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Import character handler
   */
  const handleCharacterImport = async () => {
    if (!selectedCharacter) {
      setError('Please select a character');
      return;
    }

    withConsentCheck(async (consent) => {
      setStep('importing');
      setIsLoading(true);
      setError(null);

      try {
        const result = await importCharacter(
          accountName.trim(),
          selectedCharacter.name,
          'pc',
          gggAccessToken || undefined
        );

        setBuild({
          buildId: result.buildId,
          characterName: selectedCharacter.name,
          class: result.class,
          ascendancy: result.ascendancy,
          level: result.level,
          importedAt: new Date().toISOString(),
          pobCode: result.pobCode,
          sessionDataConsent: consent,
        });

        // Create a history entry so the build appears in Recent Analyses immediately
        const snapshotId = useAnalysisHistoryStore.getState().saveSnapshot({
          build: {
            characterName: selectedCharacter.name,
            class: result.class,
            ascendancy: result.ascendancy,
            level: result.level,
            pobCode: result.pobCode,
          },
          focus: [],
          customPrompt: '',
          label: 'Imported',
          pathwayContent: {},
          isPartial: false,
          completedPathways: [],
          status: 'imported',
        });
        useAnalysisHistoryStore.getState().setActiveSnapshotId(snapshotId);

        toast.success(`Imported ${selectedCharacter.name} successfully!`);
        navigate('/chat');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        setError(message);
        toast.error(message);
        setStep('select');
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'pob') {
        handlePobImport();
      } else if (step === 'input') {
        handleFetchCharacters();
      }
    }
  };

  /**
   * Start GGG OAuth login flow — opens browser, then waits for deep link callback
   */
  const handleOAuthLogin = async () => {
    if (isOAuthInProgress) return;
    setIsOAuthInProgress(true);
    setError(null);

    try {
      await startGGGOAuth();
      // Browser is now open — flow continues when deep link fires (handleDeepLinkCallback)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start GGG login';
      setError(message);
      setIsOAuthInProgress(false);
    }
  };

  const handleOAuthCancel = async () => {
    await cancelGGGOAuth().catch(() => {});
    setIsOAuthInProgress(false);
    setError(null);
  };

  /**
   * Handle deep-link OAuth callback from GGG (via website relay)
   *
   * pathofagent://auth/callback?code=X&state=Y
   * → exchange code directly with GGG for access token
   * → fetch profile + characters
   * → show character selection
   */
  const handleDeepLinkCallback = useCallback(async (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');

      if (!code || !state) {
        setError('Invalid OAuth callback — missing parameters');
        setIsOAuthInProgress(false);
        return;
      }

      // Exchange code with GGG directly (Rust command, no server)
      const result = await exchangeGGGOAuth(code, state);

      const account = result.accountName;
      if (!account) {
        setError('Failed to get account name from GGG');
        setIsOAuthInProgress(false);
        return;
      }

      // Store the GGG access token for authenticated character imports
      // TODO: Remove this debug log after Phase 0 stash API exploration
      if (result.accessToken) {
        console.log('[GGG OAuth] Access token for stash API testing:', result.accessToken);
      }
      setGggAccessToken(result.accessToken || null);
      // Sync to Zustand store so ChatPage can access the token for atlas import
      useDesktopStore.getState().setGggAccessToken(result.accessToken || null);
      setAccountName(account);
      setMode('account');
      setIsOAuthInProgress(false);

      if (result.characters && result.characters.length > 0) {
        const mapped: GGGCharacter[] = result.characters.map((c: any) => ({
          name: c.name ?? '',
          league: c.league ?? '',
          classId: c.classId ?? 0,
          ascendancyClass: c.ascendancyClass ?? 0,
          class: c.class ?? '',
          level: c.level ?? 0,
          experience: c.experience ?? 0,
        }));
        setCharacters(mapped);
        setStep('select');
        addToHistory(account);
        toast.success(`Logged in as ${account}`);
      } else {
        // Fallback: fetch via sidecar using the access token
        setIsLoading(true);
        try {
          const charResult = await fetchCharacterList(account, 'pc', result.accessToken);
          setCharacters(charResult.characters);
          setStep('select');
          addToHistory(account);
          if (charResult.characters.length === 0) {
            setError('No characters found for this account');
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch characters';
          setError(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GGG OAuth failed';
      setError(message);
      toast.error(message);
      setIsOAuthInProgress(false);
    }
  }, [addToHistory]);

  // Deep-link listener for OAuth callback (Tauri only)
  useEffect(() => {
    if (!isTauri) return;

    let cleanup: (() => void) | undefined;

    async function setupDeepLinkListener() {
      try {
        const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
        console.log('[OAuth] Deep link listener registered');
        cleanup = await onOpenUrl((urls) => {
          console.log('[OAuth] Deep link fired with URLs:', urls);
          for (const url of urls) {
            if (url.includes('auth/callback')) {
              handleDeepLinkCallback(url);
            }
          }
        });
      } catch (err) {
        console.warn('[OAuth] Failed to set up deep link listener:', err);
      }
    }

    setupDeepLinkListener();

    // Dev mode: expose callback on window so you can paste the URL from the browser console
    // Usage: window.__oauthCallback("pathofagent://auth/callback?code=...&state=...")
    // Or just paste the full https://pathofagent.com/auth/callback?code=...&state=... URL
    if (import.meta.env.DEV) {
      (window as any).__oauthCallback = (url: string) => {
        // Accept both pathofagent:// and https://pathofagent.com/ URLs
        handleDeepLinkCallback(url.replace('https://pathofagent.com/', 'pathofagent://'));
      };
      console.log('[OAuth] Dev mode: use window.__oauthCallback("https://pathofagent.com/auth/callback?code=...&state=...") to complete OAuth');
    }

    return () => {
      cleanup?.();
      if (import.meta.env.DEV) delete (window as any).__oauthCallback;
    };
  }, [handleDeepLinkCallback]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Cosmic void background layer */}
      <div className="absolute inset-0 z-0">
        <img
          src="/mockups/cosmic-void-bg.png"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-950/30" />
      </div>

      {/* Main content layer */}
      <div className="relative z-10 h-full bg-forge-atmosphere-translucent vignette-overlay grain-overlay flex flex-col">
        {/* Compact Header */}
        <header
          data-tauri-drag-region
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img src={seerIcon} alt="Path of Agent" className="w-5 h-5 rounded-full" />
                <div className="absolute inset-0 blur-lg bg-cyan-500/30 rounded-full" />
              </div>
              <span className="text-sm font-display text-amber-200/80">Path of Agent</span>
            </div>
            {location.pathname !== '/' && (
              <button
                onClick={() => navigate('/')}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-slate-900/50 hover:bg-slate-800/70',
                  'border border-slate-700/30 hover:border-amber-500/30',
                  'transition-all duration-200'
                )}
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Account & Credits Strip */}
            {authAccount.isAuthenticated && !authAccount.isLoading && (
              <div className="flex items-center gap-3">
                {/* Credit Balance */}
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5',
                    'rounded-lg',
                    'bg-slate-800/60',
                    'border border-slate-700/50',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                  )}
                  title="Credit balance"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300 tabular-nums">
                    {authAccount.creditBalance !== null
                      ? authAccount.creditBalance.toLocaleString('en-US')
                      : '—'}
                  </span>
                </div>

                {/* Account Info */}
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5',
                    'rounded-lg',
                    'bg-slate-800/60',
                    'border border-slate-700/50',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                  )}
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-300 max-w-[160px] truncate">
                    {authAccount.email || authAccount.accountName || 'Account'}
                  </span>
                </div>

                {/* Logout */}
                <button
                  onClick={async () => {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      await invoke('logout');
                      window.location.reload();
                    } catch {
                      window.location.reload();
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5',
                    'rounded-lg',
                    'bg-slate-800/40 hover:bg-red-950/40',
                    'border border-slate-700/40 hover:border-red-500/30',
                    'transition-all duration-200',
                  )}
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                </button>
              </div>
            )}

            <VersionBadge />
            <DiscordButton />
            <SettingsPopover />
            <WindowControls />
          </div>
        </header>

        {/* Main Content - Centered, always wide to accommodate history column */}
        <div className="flex-1 flex justify-center px-4 pb-8 overflow-y-auto scrollbar-fantasy">
          <div className={cn(
            'w-full max-w-4xl flex gap-8 items-start my-auto',
          )}>
          {/* Import Column */}
          <div className="w-full flex-1 min-w-0">
            {/* Hero Title */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-amber-400 mb-2 text-glow-amber">
                Import Your Build
              </h1>
              <p className="text-slate-400 text-sm">
                Get agent-driven analysis and upgrade recommendations
              </p>
            </div>

            {/* Import Method Selection - Only show on input step */}
            {step === 'input' && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* Login with PoE - OAuth (Primary/Left) */}
                <button
                  onClick={() => { setMode('oauth'); setError(null); }}
                  disabled={isOAuthInProgress}
                  className={cn(
                    'group relative p-4 rounded-xl text-left transition-all duration-300',
                    'border',
                    isOAuthInProgress
                      ? 'bg-amber-500/10 border-amber-500/50 opacity-70 cursor-wait'
                      : mode === 'oauth'
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900/15 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/40'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-300',
                    mode === 'oauth' || isOAuthInProgress
                      ? 'bg-amber-500/20 border border-amber-500/40'
                      : 'bg-slate-800/60 border border-slate-700/50 group-hover:border-slate-600/60'
                  )}>
                    <LogIn className={cn(
                      'w-5 h-5 transition-colors',
                      mode === 'oauth' || isOAuthInProgress ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                    )} />
                  </div>
                  <h3 className={cn(
                    'font-display font-medium text-sm mb-1 transition-colors',
                    mode === 'oauth' || isOAuthInProgress ? 'text-amber-200' : 'text-slate-300 group-hover:text-slate-200'
                  )}>
                    {isOAuthInProgress ? 'Logging in...' : 'PoE Account'}
                  </h3>
                  <p className={cn(
                    'text-xs transition-colors',
                    mode === 'oauth' || isOAuthInProgress ? 'text-amber-300/60' : 'text-slate-600 group-hover:text-slate-500'
                  )}>
                    No public profile needed
                  </p>
                  {mode === 'oauth' && !isOAuthInProgress && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                  )}
                </button>

                {/* From Account - Middle */}
                <button
                  onClick={() => { setMode('account'); setError(null); }}
                  className={cn(
                    'group relative p-4 rounded-xl text-left transition-all duration-300',
                    'border',
                    mode === 'account'
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/15 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/40'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-300',
                    mode === 'account'
                      ? 'bg-amber-500/20 border border-amber-500/40'
                      : 'bg-slate-800/60 border border-slate-700/50 group-hover:border-slate-600/60'
                  )}>
                    <User className={cn(
                      'w-5 h-5 transition-colors',
                      mode === 'account' ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                    )} />
                  </div>
                  <h3 className={cn(
                    'font-display font-medium text-sm mb-1 transition-colors',
                    mode === 'account' ? 'text-amber-200' : 'text-slate-300 group-hover:text-slate-200'
                  )}>
                    Account Tag
                  </h3>
                  <p className={cn(
                    'text-xs transition-colors',
                    mode === 'account' ? 'text-amber-300/60' : 'text-slate-600 group-hover:text-slate-500'
                  )}>
                    Import directly from GGG
                  </p>
                  {mode === 'account' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                  )}
                </button>

                {/* PoB Code - Right */}
                <button
                  onClick={() => { setMode('pob'); setError(null); }}
                  className={cn(
                    'group relative p-4 rounded-xl text-left transition-all duration-300',
                    'border',
                    mode === 'pob'
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/15 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/40'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-300',
                    mode === 'pob'
                      ? 'bg-amber-500/20 border border-amber-500/40'
                      : 'bg-slate-800/60 border border-slate-700/50 group-hover:border-slate-600/60'
                  )}>
                    <FileCode className={cn(
                      'w-5 h-5 transition-colors',
                      mode === 'pob' ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                    )} />
                  </div>
                  <h3 className={cn(
                    'font-display font-medium text-sm mb-1 transition-colors',
                    mode === 'pob' ? 'text-amber-200' : 'text-slate-300 group-hover:text-slate-200'
                  )}>
                    PoB Code
                  </h3>
                  <p className={cn(
                    'text-xs transition-colors',
                    mode === 'pob' ? 'text-amber-300/60' : 'text-slate-600 group-hover:text-slate-500'
                  )}>
                    Paste Path of Building export
                  </p>
                  {mode === 'pob' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                  )}
                </button>
              </div>
            )}

            {/* Content Card */}
            <div className={cn(
              'rounded-xl overflow-hidden',
              'bg-poe-atmosphere border border-slate-700/40'
            )}>
              <div className="p-6">
                {/* PoB Code Input */}
                {mode === 'pob' && step === 'input' && (
                  <form onSubmit={handlePobImport} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                        Path of Building Code
                      </label>
                      <textarea
                        value={pobCode}
                        onChange={(e) => {
                          setPobCode(e.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Paste your PoB export code here..."
                        disabled={isLoading}
                        autoFocus
                        className={cn(
                          'w-full min-h-[140px] px-4 py-3 rounded-sm',
                          'bg-slate-950/50 border border-amber-900/50',
                          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]',
                          'text-slate-200 placeholder-slate-600 text-sm font-mono',
                          'focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/40',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'transition-all duration-200 resize-none'
                        )}
                      />
                    </div>

                    {error && (
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || !pobCode.trim()}
                      className={cn(
                        'w-full px-4 py-3.5 rounded-sm',
                        'bg-gradient-to-b from-slate-900 to-black',
                        'border border-amber-600/70 hover:border-amber-500',
                        'text-amber-200 hover:text-amber-100',
                        'font-display uppercase tracking-wider text-sm',
                        'shadow-[inset_0_1px_0_rgba(251,191,36,0.15),0_2px_8px_rgba(0,0,0,0.6)]',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        'transition-all duration-200',
                        'flex items-center justify-center gap-2'
                      )}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        'Import Build'
                      )}
                    </button>
                  </form>
                )}

                {/* Account Input */}
                {mode === 'account' && step === 'input' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                        Account Name
                      </label>
                      <AccountNameInput
                        value={accountName}
                        onChange={(value) => {
                          setAccountName(value);
                          if (error) setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        autoFocus
                      />
                      <p className="text-xs text-slate-600 mt-2">
                        Include your discriminator, e.g. <span className="text-slate-500">AccountName#1234</span>
                      </p>
                    </div>

                    <div className="px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Your character tab must be public. Go to{' '}
                        <span className="text-slate-400">pathofexile.com → Account → Privacy Settings</span>
                        {' '}and uncheck "Hide Characters"
                      </p>
                    </div>

                    {error && (
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={handleFetchCharacters}
                      disabled={isLoading || !accountName.trim()}
                      className={cn(
                        'w-full px-4 py-3.5 rounded-lg',
                        'bg-gradient-to-r from-amber-600 to-amber-500',
                        'hover:from-amber-500 hover:to-amber-400',
                        'text-black font-display font-semibold text-sm',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-600 disabled:hover:to-amber-500',
                        'transition-all duration-200',
                        'flex items-center justify-center gap-2',
                        'shadow-lg shadow-amber-500/20'
                      )}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Finding Characters...
                        </>
                      ) : (
                        'Find Characters'
                      )}
                    </button>
                  </div>
                )}

                {/* OAuth Login */}
                {mode === 'oauth' && step === 'input' && (
                  <div className="space-y-4">

                    {error && (
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    {isOAuthInProgress ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="relative">
                          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                          <div className="absolute inset-0 blur-xl bg-amber-500/30 rounded-full" />
                        </div>
                        <p className="text-sm text-slate-400 mt-4">
                          Waiting for authorization...
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Complete the login in your browser
                        </p>
                        <button
                          onClick={handleOAuthCancel}
                          className="mt-4 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleOAuthLogin}
                        className={cn(
                          'w-full px-4 py-3.5 rounded-lg',
                          'bg-gradient-to-r from-amber-600 to-amber-500',
                          'hover:from-amber-500 hover:to-amber-400',
                          'text-black font-display font-semibold text-sm',
                          'transition-all duration-200',
                          'flex items-center justify-center gap-2',
                          'shadow-lg shadow-amber-500/20'
                        )}
                      >
                        <LogIn className="h-4 w-4" />
                        Sign in with Path of Exile
                      </button>
                    )}
                  </div>
                )}

                {/* Character Selection */}
                {mode === 'account' && step === 'select' && (
                  <div className="space-y-4">
                    {/* Header with back button */}
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => { setStep('input'); setSelectedCharacter(null); setCharacters([]); }}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        Change account
                      </button>
                      <span className="text-xs text-slate-600">
                        {characters.length} character{characters.length !== 1 ? 's' : ''} found
                      </span>
                    </div>

                    {/* Character List */}
                    <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-fantasy pr-1">
                      {charactersByLeague.map(({ league, characters: chars }) => (
                        <div key={league}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[0.625rem] font-display font-medium text-slate-600 uppercase tracking-widest">
                              {league}
                            </span>
                            <div className="flex-1 h-px bg-slate-800" />
                          </div>
                          <div className="space-y-1.5">
                            {chars.map((char) => (
                              <button
                                key={char.name}
                                onClick={() => setSelectedCharacter(char)}
                                className={cn(
                                  'w-full px-4 py-3 rounded-lg text-left transition-all duration-200',
                                  'border',
                                  selectedCharacter?.name === char.name
                                    ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10'
                                    : 'bg-slate-900/40 border-slate-700/40 hover:bg-slate-800/50 hover:border-slate-600/50'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {/* Selection indicator */}
                                    <div className={cn(
                                      'w-2 h-2 rounded-full transition-all duration-200',
                                      selectedCharacter?.name === char.name
                                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                        : 'bg-slate-700'
                                    )} />
                                    <div>
                                      <span className={cn(
                                        'font-medium text-sm transition-colors',
                                        selectedCharacter?.name === char.name ? 'text-amber-200' : 'text-slate-200'
                                      )}>
                                        {char.name}
                                      </span>
                                      <span className={cn(
                                        'ml-2 text-xs transition-colors',
                                        selectedCharacter?.name === char.name ? 'text-amber-400/70' : 'text-slate-500'
                                      )}>
                                        {char.class}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={cn(
                                    'text-xs font-medium px-2 py-1 rounded transition-all',
                                    selectedCharacter?.name === char.name
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-800/50 text-slate-500'
                                  )}>
                                    Lv. {char.level}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {characters.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-500">No characters found</p>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    {/* Import button */}
                    <button
                      onClick={handleCharacterImport}
                      disabled={isLoading || !selectedCharacter}
                      className={cn(
                        'w-full px-4 py-3.5 rounded-lg',
                        'bg-gradient-to-r from-amber-600 to-amber-500',
                        'hover:from-amber-500 hover:to-amber-400',
                        'text-black font-display font-semibold text-sm',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-600 disabled:hover:to-amber-500',
                        'transition-all duration-200',
                        'flex items-center justify-center gap-2',
                        'shadow-lg shadow-amber-500/20'
                      )}
                    >
                      {selectedCharacter ? `Import ${selectedCharacter.name}` : 'Select a character'}
                    </button>
                  </div>
                )}

                {/* Importing State */}
                {mode === 'account' && step === 'importing' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                      <div className="absolute inset-0 blur-xl bg-amber-500/30 rounded-full" />
                    </div>
                    <p className="text-sm text-slate-400 mt-4">
                      Importing <span className="text-amber-300">{selectedCharacter?.name}</span>...
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      This may take a few seconds
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* History Column — always visible */}
          <div className="w-72 flex-shrink-0 pt-[4.5rem]">
            <AnalysisHistoryPanel />
          </div>
          </div>
        </div>
      </div>

      {/* Session data consent — shown on each import unless "don't show again" was checked */}
      <SessionDataConsentDialog
        open={showConsentDialog}
        onConsent={handleConsentResponse}
      />
    </div>
  );
}

// ============================================
// Environment Detection
// ============================================

/**
 * Check if running inside Tauri (desktop app mode).
 * In web dev mode (Vite dev server without Tauri), skip setup/readiness gates.
 * In Tauri mode (both dev and production), auth is always required.
 */
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

// ============================================
// Startup Gate States
// ============================================

type StartupPhase = 'checking' | 'needs-auth' | 'waiting-backend' | 'ready';

// ============================================
// Main App Component
// ============================================

function App() {
  const [phase, setPhase] = useState<StartupPhase>(isTauri ? 'checking' : 'ready');
  const fontScale = useSettingsStore((s) => s.fontScale);
  const brightness = useSettingsStore((s) => s.brightness);

  // Sync font scale to DOM — sets root font-size so all rem-based sizes cascade globally
  useEffect(() => {
    document.getElementById('root')?.setAttribute('data-font-scale', fontScale);
    const sizes: Record<string, string> = { compact: '15px', normal: '17px', large: '19px' };
    document.documentElement.style.fontSize = sizes[fontScale] || '17px';
  }, [fontScale]);

  // Sync brightness to DOM — data attribute triggers CSS filter brightness
  useEffect(() => {
    if (brightness > 0) {
      document.documentElement.setAttribute('data-brightness', String(brightness));
    } else {
      document.documentElement.removeAttribute('data-brightness');
    }
  }, [brightness]);

  // Check startup requirements on mount (Tauri only)
  useEffect(() => {
    if (!isTauri) return;

    // In dev mode, skip auth entirely — no need to contact production server
    if (import.meta.env.DEV) {
      setPhase('waiting-backend');
      return;
    }

    const checkStartup = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Check for valid session token (calls api.pathofagent.com)
        const authStatus = await invoke<{ isAuthenticated: boolean }>('get_auth_status');
        if (authStatus.isAuthenticated) {
          setPhase('waiting-backend');
        } else {
          setPhase('needs-auth');
        }
      } catch {
        // If auth check fails, show auth screen
        setPhase('needs-auth');
      }
    };

    void checkStartup();
  }, []);

  // Initialize session history store (loads from disk in Tauri, localStorage in browser)
  useEffect(() => {
    void useAnalysisHistoryStore.getState().init();
  }, []);

  const handleAuthComplete = useCallback(() => {
    setPhase('waiting-backend');
  }, []);

  const handleBackendReady = useCallback(() => {
    setPhase('ready');
  }, []);

  // Startup gates (Tauri only)
  if (phase === 'checking') {
    // Brief blank screen while we check -- avoids flash
    return <div className="fixed inset-0 bg-[#06060b]" />;
  }

  if (phase === 'needs-auth') {
    return <AuthScreen onAuthenticated={handleAuthComplete} />;
  }

  if (phase === 'waiting-backend') {
    return <BackendReadiness onReady={handleBackendReady} />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/*
        UpdateDriver MUST stay mounted at App root — it's the single active
        driver of the auto-update lifecycle. VersionBadge only displays
        progress; it does NOT poll for updates. Removing this mount silently
        breaks auto-update for every shipped release. See SIGN-21 in
        deployment-learnings (broke v0.1.4 → v0.2.2, ~6 weeks).
      */}
      <UpdateDriver />
      <Routes>
        {/* Hub is the new landing — two-card chooser between Analyze and Library */}
        <Route path="/" element={<HubPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/library" element={<BuildLibraryPage />} />
        <Route path="/library/:slug" element={<BuildGuideDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/general-chat" element={<GeneralChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
