/**
 * Shared diagnostics types for LangChain tool output.
 * Used by frontend to render errors/warnings in ToolStepCard.
 */

export interface DiagnosticEntry {
  code: string;
  message: string;
  hint?: string;
}

export interface ToolDiagnostics {
  errors: DiagnosticEntry[];
  warnings: DiagnosticEntry[];
}
