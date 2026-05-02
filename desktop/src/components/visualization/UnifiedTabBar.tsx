/**
 * UnifiedTabBar Component
 *
 * Unified tab bar for switching between Overview, Skills, Tree, Equipment, and Chat tabs.
 * The Overview tab shows general build stats and assessment.
 * Skills/Tree/Equipment tabs show detailed visualization for each pillar.
 */

import { motion } from 'framer-motion';
import { BarChart3, Gem, TreePine, Shield, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Tab types for the unified tab system
 */
export type UnifiedTab = 'overview' | 'skills' | 'tree' | 'gear' | 'chat';

interface UnifiedTabBarProps {
  activeTab: UnifiedTab;
  onTabChange: (tab: UnifiedTab) => void;
}

interface TabConfig {
  id: UnifiedTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'skills', label: 'Skills', icon: <Gem className="w-4 h-4" /> },
  { id: 'tree', label: 'Tree', icon: <TreePine className="w-4 h-4" /> },
  { id: 'gear', label: 'Equipment', icon: <Shield className="w-4 h-4" /> },
  { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-4 h-4" /> },
];

export function UnifiedTabBar({ activeTab, onTabChange }: UnifiedTabBarProps) {

  return (
    <div className="flex gap-1 p-1 bg-slate-900/25 rounded-lg border border-slate-700/40">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-md',
              'text-sm font-medium transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
              isActive
                ? 'text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeUnifiedTab"
                className="absolute inset-0 bg-slate-800/30 border border-amber-500/30 rounded-md"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.icon}</span>
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default UnifiedTabBar;
