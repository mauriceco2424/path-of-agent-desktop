import { AlertTriangle, XCircle } from 'lucide-react';
import type { ToolDiagnostics } from '../../../../shared/types/ToolDiagnostics';

/**
 * Generic error/warning renderer for LangChain tool output.
 * Renders diagnostics.errors (red) and diagnostics.warnings (amber).
 * Returns null when there are no diagnostics to display.
 */
export function DiagnosticsPanel({ diagnostics }: { diagnostics?: ToolDiagnostics }) {
  if (!diagnostics) return null;

  const hasErrors = diagnostics.errors && diagnostics.errors.length > 0;
  const hasWarnings = diagnostics.warnings && diagnostics.warnings.length > 0;

  if (!hasErrors && !hasWarnings) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {hasErrors && diagnostics.errors.map((entry, i) => (
        <div
          key={`e-${i}`}
          className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-red-950/30 border border-red-500/20"
        >
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-red-200">{entry.message}</span>
            {entry.hint && (
              <div className="text-red-400/70 italic mt-0.5">{entry.hint}</div>
            )}
          </div>
        </div>
      ))}

      {hasWarnings && diagnostics.warnings.map((entry, i) => (
        <div
          key={`w-${i}`}
          className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-amber-950/20 border border-amber-500/20"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-amber-200">{entry.message}</span>
            {entry.hint && (
              <div className="text-amber-400/70 italic mt-0.5">{entry.hint}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
