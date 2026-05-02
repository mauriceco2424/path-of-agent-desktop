/**
 * PageSkeleton Component
 *
 * Loading skeleton components for page-level loading states.
 * Provides consistent shimmer animation across the app.
 *
 * Features:
 * - Full page skeleton for initial loads
 * - Section skeletons for partial loading
 * - Card grid skeletons
 * - Configurable sizes and counts
 *
 * @module desktop/src/components/shared/PageSkeleton
 */

import { cn } from '../../lib/utils';

// ============================================
// Base Skeleton Component
// ============================================

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton element with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-700/50',
        className
      )}
    />
  );
}

// ============================================
// Card Skeleton
// ============================================

interface CardSkeletonProps {
  /** Whether this is a compact variant */
  compact?: boolean;
  className?: string;
}

/**
 * Skeleton for a build card
 */
export function CardSkeleton({ compact = false, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col w-full p-4 rounded-xl overflow-hidden',
        'bg-slate-800/30 border border-slate-700/30',
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-1">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-3 rounded-full" />
        </div>
      </div>

      {/* Title skeleton */}
      <Skeleton className="h-5 w-full mb-2" />
      {!compact && <Skeleton className="h-5 w-3/4 mb-3" />}

      {/* Skill skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Stats skeleton */}
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="ml-auto h-6 w-20 rounded-full" />
      </div>

      {/* Tags skeleton */}
      {!compact && (
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-12" />
        </div>
      )}
    </div>
  );
}

// ============================================
// Grid Skeleton
// ============================================

interface GridSkeletonProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Number of columns */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * Skeleton grid for multiple cards
 */
export function GridSkeleton({
  count = 8,
  columns = 4,
  className,
}: GridSkeletonProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridClasses[columns], className)}>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

// ============================================
// Section Skeleton
// ============================================

interface SectionSkeletonProps {
  /** Height of the section content */
  height?: string;
  /** Whether to show a header */
  showHeader?: boolean;
  className?: string;
}

/**
 * Skeleton for a content section
 */
export function SectionSkeleton({
  height = 'h-48',
  showHeader = true,
  className,
}: SectionSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 bg-slate-900/80 border border-slate-800/50',
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
      )}
      <Skeleton className={cn('w-full rounded-lg', height)} />
    </div>
  );
}

// ============================================
// Detail Page Skeleton
// ============================================

/**
 * Full page skeleton for build detail page
 */
export function DetailPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header skeleton */}
      <div
        className={cn(
          'rounded-xl p-6 border',
          'bg-slate-800/30 border-slate-700/30'
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-64" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-5 h-5" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-full max-w-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-40 rounded-lg mt-2" />
          </div>
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionSkeleton height="h-64" />
        <SectionSkeleton height="h-64" />
      </div>

      {/* Tree and Gear skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionSkeleton height="h-48" />
        <SectionSkeleton height="h-48" />
      </div>

      {/* Progression skeleton */}
      <SectionSkeleton height="h-96" />
    </div>
  );
}

// ============================================
// Landing Page Skeleton
// ============================================

/**
 * Skeleton for the landing page recent builds section
 */
export function RecentBuildsSkeleton() {
  return (
    <div className="w-full max-w-3xl">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-5 h-5" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} compact />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Designer Page Skeleton
// ============================================

/**
 * Skeleton for the designer step content
 */
export function DesignerStepSkeleton() {
  return (
    <div className="space-y-4">
      {/* Input area skeleton */}
      <Skeleton className="w-full h-32 rounded-xl" />

      {/* Button skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Results skeleton */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}

export default Skeleton;
