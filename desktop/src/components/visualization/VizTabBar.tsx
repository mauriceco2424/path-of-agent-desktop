/**
 * VizTabBar Component
 *
 * Tab bar for switching between Gear/Skills/Tree views in the build visualization panel.
 * Uses dark fantasy styling matching the ChatPage tabs.
 */

import { Gem, TreePine, Shield } from 'lucide-react';
import type { VizTab } from '../../store';
import { cn } from '../../lib/utils';

interface VizTabBarProps {
  activeTab: VizTab;
  onTabChange: (tab: VizTab) => void;
}

interface TabConfig {
  id: VizTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'gear', label: 'Gear', icon: <Shield className="w-4 h-4" /> },
  { id: 'skills', label: 'Skills', icon: <Gem className="w-4 h-4" /> },
  { id: 'tree', label: 'Tree', icon: <TreePine className="w-4 h-4" /> },
];

export function VizTabBar({ activeTab, onTabChange }: VizTabBarProps) {
  return (
    <div className="flex panel-header relative">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex-1 px-4 py-3 text-sm font-display font-medium tracking-wide',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
              isActive
                ? 'text-amber-300 tab-metallic-active'
                : 'text-slate-400 tab-metallic hover:text-slate-200'
            )}
          >
            <span className="relative z-10 flex items-center gap-2 justify-center">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default VizTabBar;
