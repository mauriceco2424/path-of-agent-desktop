/**
 * ChatPageLayout Component - Dark Fantasy Game UI
 *
 * Three-column layout foundation for the ChatPage with PoE-authentic styling.
 * Provides a premium game interface feel with:
 * - Left sidebar: Quick stats panel with metallic frame
 * - Center: Main content area with atmospheric depth
 * - Right sidebar: Context panel with decorative borders
 *
 * Design Features:
 * - Forge-style atmospheric background with subtle vignette
 * - Metallic frame borders with amber/gold accents
 * - Decorative corner accents and ornate dividers
 * - Cinzel display font for headers
 *
 * @module desktop/src/components/chat/ChatPageLayout
 */

import { useCallback, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../../lib/utils';
import { WindowControls } from '../ui/WindowControls';
import { SettingsPopover } from '../ui/SettingsPopover';

// ============================================
// Types
// ============================================

export interface ChatPageLayoutProps {
  /** Content for the left stats panel */
  statsPanel: ReactNode;
  /** Main content area (chat interface) */
  mainContent: ReactNode;
  /** Right context panel content */
  contextPanel: ReactNode;
  /** Build name to display in header (optional) */
  buildName?: string;
  /** Ascendancy class for header styling (optional) */
  ascendancy?: string;
  /** Character level for header display (optional) */
  level?: number;
  /** Main skill for header display (optional) */
  mainSkill?: string;
  /** Header action buttons (optional) */
  headerActions?: ReactNode;
  /** Callback for back button click (navigate to landing) */
  onBack?: () => void;
}

// Fixed desktop rail sizing.
// These do not grow with the window; extra width becomes gutters between the
// rails so the composition stays stable.
const LEFT_PANEL_WIDTH = 'min-content';
const MAIN_PANEL_WIDTH = '760px';
const RIGHT_PANEL_WIDTH = '360px';
const FLEX_GUTTER = 'minmax(0px, 1fr)';

// ============================================
// Sub-Components
// ============================================

interface HeaderProps {
  buildName?: string;
  ascendancy?: string;
  level?: number;
  mainSkill?: string;
  headerActions?: ReactNode;
  onBack?: () => void;
}

function Header({ buildName, ascendancy, level, mainSkill, headerActions, onBack }: HeaderProps) {
  return (
    <header
      data-tauri-drag-region
      className="h-14 panel-header-solid-translucent flex items-center justify-between px-5 flex-shrink-0 relative"
    >
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-l border-t border-amber-500/30" />
      <div className="absolute top-0 right-0 w-6 h-6 border-r border-t border-amber-500/30" />

      {/* Left: Back button + Logo + Build Info */}
      <div className="flex items-center gap-3">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className={cn(
              'group flex items-center justify-center',
              'w-9 h-9 rounded-lg',
              'bg-slate-800/60 hover:bg-slate-700/80',
              'border border-slate-700/50 hover:border-amber-500/30',
              'transition-all duration-200'
            )}
            aria-label="Go back to landing page"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </button>
        )}

        {/* Logo with glow */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img src={seerIcon} alt="Path of Agent" className="w-6 h-6 rounded-full" />
            <div className="absolute inset-0 blur-md bg-cyan-500/20 rounded-full" />
          </div>
          <span className="text-base font-semibold text-amber-100 font-display tracking-wide text-glow-amber">
            Path of Agent
          </span>
        </div>

        {/* Build Info with ornate divider */}
        {(ascendancy || buildName || mainSkill) && (
          <>
            <div className="divider-ornate-vertical h-6 mx-2" />
            <div className="flex items-center gap-2">
              {(ascendancy || buildName) && (
                <span className="text-sm font-display font-semibold text-slate-100 tracking-wide">
                  {ascendancy || buildName}
                </span>
              )}
              {mainSkill && (
                <>
                  <span className="text-slate-500/60 text-xs">|</span>
                  <span className="text-sm font-display text-amber-200/70 tracking-wide truncate max-w-[320px]">
                    {mainSkill}
                  </span>
                </>
              )}
              {level != null && (
                <>
                  <span className="text-slate-500/60 text-xs">|</span>
                  <span className="text-xs font-medium text-slate-400">
                    Lv {level}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions + Settings + Window Controls */}
      <div className="flex items-center gap-1.5">
        {headerActions}
        <SettingsPopover />
        {/* Subtle separator before window controls */}
        <div className="w-px h-4 bg-gradient-to-b from-transparent via-slate-600/20 to-transparent mx-0.5" />
        <WindowControls />
      </div>
    </header>
  );
}



// ============================================
// Main Component
// ============================================

export function ChatPageLayout({
  statsPanel,
  mainContent,
  contextPanel,
  buildName,
  ascendancy,
  level,
  mainSkill,
  headerActions,
  onBack,
}: ChatPageLayoutProps) {
  // Forward wheel events from the gutters to the center scroll container
  const mainRef = useRef<HTMLElement>(null);
  const handleGutterWheel = useCallback((e: React.WheelEvent) => {
    const scrollContainer = mainRef.current?.querySelector('.scrollbar-fantasy');
    if (scrollContainer) {
      scrollContainer.scrollBy({ top: e.deltaY, left: e.deltaX });
    }
  }, []);

  const gridTemplateColumns = `${LEFT_PANEL_WIDTH} ${FLEX_GUTTER} ${MAIN_PANEL_WIDTH} ${FLEX_GUTTER} ${RIGHT_PANEL_WIDTH}`;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Cosmic void background layer */}
      <div className="absolute inset-0 z-0">
        <img
          src="/mockups/cosmic-void-bg.png"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        {/* Subtle darkening overlay to ensure UI readability */}
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>

      {/* Main content layer with semi-transparent forge atmosphere */}
      <div className="relative z-10 h-full flex flex-col bg-forge-atmosphere-translucent vignette-overlay grain-overlay">
      {/* Header */}
      <Header
        buildName={buildName}
        ascendancy={ascendancy}
        level={level}
        mainSkill={mainSkill}
        headerActions={headerActions}
        onBack={onBack}
      />

      {/* Main Content Area - Fixed Rails With Flexible Gutters */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Grid Container */}
        <div className="h-full">
          <div
            className="h-full w-full grid"
            style={{ gridTemplateColumns }}
          >
            {/* Left: Stats Panel */}
            <aside className="h-full min-h-0 frame-metallic-subtle-translucent overflow-y-auto overflow-x-hidden">
              {statsPanel}
            </aside>

            {/* Left gutter — forwards scroll to center */}
            <div className="h-full" onWheel={handleGutterWheel} />

            {/* Center: Main Content - fixed rail */}
            <main ref={mainRef} className="h-full overflow-hidden flex flex-col relative min-w-0">
              {/* Top edge accent */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              <div className="flex-1 min-h-0 w-full">
                {mainContent}
              </div>
            </main>

            {/* Right gutter — forwards scroll to center */}
            <div className="h-full" onWheel={handleGutterWheel} />

            {/* Right: Context Panel - with metallic frame */}
            <aside className="h-full min-h-0 min-w-0 frame-metallic-translucent overflow-hidden flex flex-col">
              {contextPanel}
            </aside>
          </div>
        </div>
      </div>

      {/* Bottom edge accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  );
}

export default ChatPageLayout;
