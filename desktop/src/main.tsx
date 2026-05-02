/**
 * Desktop Application Entry Point
 *
 * Main entry point for the Tauri desktop application.
 * Sets up React Router for navigation and initializes the Tauri context.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { attachConsole } from '@tauri-apps/plugin-log';
import App from './App';
import './index.css';

// Attach console to Tauri log plugin - forwards console.log/warn/error to log file
// This allows Claude Code to read frontend logs from the app.log file
attachConsole().catch((err) => {
  // Silently fail in web mode (non-Tauri)
  if (!err.message?.includes('not running in Tauri')) {
    console.error('Failed to attach console to Tauri log:', err);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          className: 'bg-card border-border text-foreground',
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
