/**
 * BuildDetailLayout Component - Build Library Detail Page Layout
 *
 * Three-column layout for build library detail pages, matching ChatPageLayout styling.
 * Provides:
 * - Left sidebar: Stats panel with metallic frame
 * - Center: Main content area (hero + progression)
 * - Right sidebar: Visualization tabs (gear/skills/tree)
 *
 * @module desktop/src/components/build-library/BuildDetailLayout
 */

import { useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Flame, ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

// ============================================
// Types
// ============================================

export interface BuildDetailLayoutProps {
  /** Content for the left stats panel */
  statsPanel: ReactNode;
  /** Main content area (hero + progression) */
  mainContent: ReactNode;
  /** Right context panel content (viz tabs) */
  contextPanel: ReactNode;
  /** Callback for back button click */
  onBack?: () => void;
}

// ============================================
// Animation Configuration
// ============================================

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// CSS clamp values for responsive panel widths - matches ChatPageLayout
const LEFT_PANEL_CLAMP = 'clamp(160px, 12vw, 240px)';
const RIGHT_PANEL_CLAMP = 'clamp(320px, 25vw, 480px)';

const toggleButtonVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

// ============================================
// Sub-Components
// ============================================

interface HeaderProps {
  onBack?: () => void;
}

function Header({ onBack }: HeaderProps) {
  return (
    <header className="h-14 panel-header-solid-translucent flex items-center justify-between px-5 flex-shrink-0 relative">
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-l border-t border-amber-500/30" />
      <div className="absolute top-0 right-0 w-6 h-6 border-r border-t border-amber-500/30" />

      {/* Left: Back button + Logo + Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className={cn(
              'group flex items-center gap-2',
              'px-3 py-1.5 rounded-lg',
              'bg-slate-800/60 hover:bg-slate-700/80',
              'border border-slate-700/50 hover:border-amber-500/30',
              'transition-all duration-200'
            )}
            aria-label="Go back to build library"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
            <span className="text-sm text-slate-400 group-hover:text-amber-400 transition-colors font-medium">
              Back
            </span>
          </button>
        )}

        {/* Logo + Breadcrumb */}
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-amber-400/80" />
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/library"
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              Build Library
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-medium">Build Details</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface StatsSidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function StatsSidebarToggle({ isOpen, onToggle }: StatsSidebarToggleProps) {
  return (
    <motion.button
      variants={toggleButtonVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={onToggle}
      className={cn(
        'group absolute top-1/2 -translate-y-1/2 z-10',
        'w-5 h-16 flex items-center justify-center',
        'bg-transparent border border-slate-600/20',
        'hover:bg-slate-900/90 hover:border-amber-500/40',
        'hover:shadow-[0_0_10px_rgba(0,0,0,0.5),inset_0_0_8px_rgba(0,0,0,0.3)]',
        'transition-all duration-200',
        'rounded-r-md'
      )}
      style={{ left: isOpen ? LEFT_PANEL_CLAMP : '0px' }}
      aria-label={isOpen ? 'Collapse stats panel' : 'Expand stats panel'}
    >
      {isOpen ? (
        <ChevronLeft className="w-3 h-3 text-slate-500/30 group-hover:text-amber-400/80 transition-colors" />
      ) : (
        <ChevronRight className="w-3 h-3 text-slate-500/30 group-hover:text-amber-400/80 transition-colors" />
      )}
    </motion.button>
  );
}

interface ContextPanelToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ContextPanelToggle({ isOpen, onToggle }: ContextPanelToggleProps) {
  return (
    <motion.button
      variants={toggleButtonVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={onToggle}
      className={cn(
        'group absolute top-1/2 -translate-y-1/2 z-10',
        'w-5 h-16 flex items-center justify-center',
        'bg-transparent border border-slate-600/20',
        'hover:bg-slate-900/90 hover:border-amber-500/40',
        'hover:shadow-[0_0_10px_rgba(0,0,0,0.5),inset_0_0_8px_rgba(0,0,0,0.3)]',
        'transition-all duration-200',
        'rounded-l-md'
      )}
      style={{ right: isOpen ? RIGHT_PANEL_CLAMP : '0px' }}
      aria-label={isOpen ? 'Collapse visualization panel' : 'Expand visualization panel'}
    >
      {isOpen ? (
        <ChevronRight className="w-3 h-3 text-slate-500/30 group-hover:text-amber-400/80 transition-colors" />
      ) : (
        <ChevronLeft className="w-3 h-3 text-slate-500/30 group-hover:text-amber-400/80 transition-colors" />
      )}
    </motion.button>
  );
}

// ============================================
// Main Component
// ============================================

export function BuildDetailLayout({
  statsPanel,
  mainContent,
  contextPanel,
  onBack,
}: BuildDetailLayoutProps) {
  // State for sidebar visibility
  const [isStatsSidebarOpen, setIsStatsSidebarOpen] = useState(true);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);

  // Animation variants
  const leftSidebarVariants = {
    open: {
      width: 'auto',
      opacity: 1,
      transition: springTransition,
    },
    closed: {
      width: 0,
      opacity: 0,
      transition: springTransition,
    },
  };

  const rightSidebarVariants = {
    open: {
      width: 'auto',
      opacity: 1,
      transition: springTransition,
    },
    closed: {
      width: 0,
      opacity: 0,
      transition: springTransition,
    },
  };

  const toggleStatsSidebar = useCallback(() => {
    setIsStatsSidebarOpen((prev) => !prev);
  }, []);

  const toggleContextPanel = useCallback(() => {
    setIsContextPanelOpen((prev) => !prev);
  }, []);

  // Grid column style using CSS clamp() for responsive scaling
  const getGridTemplateColumns = () => {
    if (isStatsSidebarOpen && isContextPanelOpen) {
      return `${LEFT_PANEL_CLAMP} 1fr ${RIGHT_PANEL_CLAMP}`;
    }
    if (isStatsSidebarOpen) {
      return `${LEFT_PANEL_CLAMP} 1fr 0px`;
    }
    if (isContextPanelOpen) {
      return `0px 1fr ${RIGHT_PANEL_CLAMP}`;
    }
    return '0px 1fr 0px';
  };

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
        <Header onBack={onBack} />

        {/* Main Content Area - Three Column Grid */}
        <div className="flex-1 relative overflow-hidden">
          {/* Stats Sidebar Toggle */}
          <StatsSidebarToggle
            isOpen={isStatsSidebarOpen}
            onToggle={toggleStatsSidebar}
          />

          {/* Context Panel Toggle */}
          <ContextPanelToggle
            isOpen={isContextPanelOpen}
            onToggle={toggleContextPanel}
          />

          {/* Grid Container */}
          <div className="h-full">
            <div
              className="h-full w-full grid transition-[grid-template-columns] duration-300"
              style={{ gridTemplateColumns: getGridTemplateColumns() }}
            >
              {/* Left: Stats Panel */}
              <AnimatePresence mode="wait">
                {isStatsSidebarOpen && (
                  <motion.aside
                    key="stats-panel"
                    variants={leftSidebarVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    className="h-full frame-metallic-subtle-translucent overflow-hidden"
                  >
                    {statsPanel}
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* When stats panel is closed, render empty column for grid alignment */}
              {!isStatsSidebarOpen && <div className="w-0" />}

              {/* Center: Main Content */}
              <main className="h-full overflow-hidden flex flex-col relative">
                {/* Top edge accent */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                <div className="h-full w-full overflow-y-auto scrollbar-fantasy">
                  {mainContent}
                </div>
              </main>

              {/* Right: Context Panel (Visualization Tabs) */}
              <AnimatePresence mode="wait">
                {isContextPanelOpen && (
                  <motion.aside
                    key="context-panel"
                    variants={rightSidebarVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    className="h-full frame-metallic-translucent overflow-hidden flex flex-col"
                  >
                    {contextPanel}
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* When context panel is closed, render empty column for grid alignment */}
              {!isContextPanelOpen && <div className="w-0" />}
            </div>
          </div>
        </div>

        {/* Bottom edge accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  );
}

export default BuildDetailLayout;
