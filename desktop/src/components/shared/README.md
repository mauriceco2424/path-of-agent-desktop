# Shared Code Integration Strategy

## Overview

The desktop application reuses components and types from the main frontend and shared packages through TypeScript path aliases. This avoids code duplication and ensures consistency between web and desktop versions.

## Path Aliases

The following aliases are configured in both TypeScript (`tsconfig.json`, `tsconfig.app.json`) and Vite (`vite.config.ts`):

| Alias | Points To | Use Case |
|-------|-----------|----------|
| `@/*` | `./src/*` | Desktop-specific code |
| `@shared/*` | `../shared/*` | Shared types and utilities |
| `@components/*` | `../frontend/src/components/*` | Reusable UI components |

## Usage Examples

### Importing Shared Types

```typescript
// Import shared type definitions
import type { ChatMessage, PoBContext } from '@shared/types';
import type { TradeUrl, ItemValidation } from '@shared/types';
```

### Importing UI Components

```typescript
// Import shadcn/ui primitives from frontend
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';

// Import complex components
import { ChatPanel } from '@components/chat/ChatPanel';
import { BuildSummary } from '@components/build-summary/BuildSummary';
```

### Desktop-Specific Components

For components that need desktop-specific behavior, create them in the desktop `src/components/` directory:

```typescript
// Desktop-specific component
import { Button } from '@components/ui/button';
import { invoke } from '@tauri-apps/api/core';

export function DesktopLoginButton() {
  const handleLogin = async () => {
    // Tauri-specific IPC call
    await invoke('open_login_window');
  };

  return <Button onClick={handleLogin}>Login</Button>;
}
```

## Architecture Decision: Path Aliases vs Copying

We chose **Option A (Path Aliases)** over copying components because:

1. **No duplication**: Changes in frontend components automatically reflect in desktop
2. **Single source of truth**: UI components are maintained in one place
3. **Build-time resolution**: Vite resolves aliases at build time, no runtime cost
4. **Type safety**: TypeScript validates imports across package boundaries

## When to Create Desktop-Specific Components

Create components in `desktop/src/components/` when:

1. Component requires Tauri IPC (`@tauri-apps/api`)
2. Component has desktop-only UI (system tray, native menus)
3. Component handles offline/local-first functionality
4. Component manages desktop auth flow (session tokens)

## Directory Structure

```
desktop/src/
  components/
    shared/           # This directory - for documentation
    auth/             # Desktop-specific auth components
      LoginForm.tsx
      AccountInfo.tsx
    OfflineIndicator.tsx

frontend/src/components/  # Shared via @components/* alias
  ui/               # shadcn/ui primitives
  chat/             # Chat components
  build-summary/    # Build display components
  seer/             # Consultation UI
```

## Caveats

1. **Dependency alignment**: Desktop and frontend must use compatible versions of shared dependencies (React, TailwindCSS)
2. **CSS imports**: Ensure `index.css` includes necessary Tailwind directives
3. **Context providers**: Some components may expect React context from frontend - wrap appropriately
4. **Relative imports within frontend**: Components using relative imports work correctly because Vite resolves them relative to the component location
