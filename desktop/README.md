# Path of Agent Desktop

Desktop application for Path of Agent built with Tauri.

## Overview

Path of Agent Desktop is a native desktop application that provides a seamless Path of Exile build analysis experience. The desktop version leverages Tauri to combine a Rust backend with a React frontend, enabling features that require direct system access such as:

- Trade API calls from the user's local IP (required by GGG's trade API)
- Local caching for offline analysis
- OAuth authentication flow coordination
- Native system integrations

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Rust 1.75+** - [Install via rustup](https://rustup.rs/)
- **Tauri CLI** - Install via cargo:
  ```bash
  cargo install tauri-cli
  ```

### Platform-Specific Requirements

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux:**
- Development packages:
  ```bash
  # Debian/Ubuntu
  sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

  # Fedora
  sudo dnf install webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel

  # Arch
  sudo pacman -S webkit2gtk \
    base-devel \
    curl \
    wget \
    file \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
  ```

## Development Setup

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd path-of-agent/desktop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the `desktop/` directory:
   ```env
   BACKEND_URL=http://localhost:3000
   ```

4. **Start development server**:
   ```bash
   npm run tauri dev
   ```

   This will:
   - Start the React frontend in development mode
   - Compile the Rust backend
   - Launch the desktop application with hot-reload enabled

## Building for Production

To create a production build:

```bash
npm run tauri build
```

This will generate platform-specific installers in `src-tauri/target/release/bundle/`:

- **Windows**: `.msi` and `.exe` installers
- **macOS**: `.dmg` and `.app` bundle
- **Linux**: `.deb`, `.AppImage`, and/or `.rpm` (depending on your system)

### Build Options

```bash
# Build for specific target
npm run tauri build -- --target x86_64-pc-windows-msvc

# Debug build (faster compilation)
npm run tauri build -- --debug

# Bundle-specific build
npm run tauri build -- --bundles msi,nsis
```

## Architecture Overview

### Rust Backend (`src-tauri/`)

The Rust backend handles system-level operations and API calls:

- **Trade API Integration**: Makes trade API calls from the user's local IP address (required by GGG's trade API policies)
- **Local Caching**: Stores build data, KB modules, and API responses locally for offline access
- **OAuth Flow Coordination**: Manages authentication with Path of Exile account services
- **System Integration**: File system access, clipboard operations, native notifications

Key files:
- `src-tauri/src/main.rs` - Application entry point and Tauri commands
- `src-tauri/src/trade.rs` - Trade API client implementation
- `src-tauri/src/cache.rs` - Local caching layer
- `src-tauri/src/auth.rs` - OAuth flow handler
- `src-tauri/tauri.conf.json` - Tauri configuration

### React Frontend (`src/`)

Desktop-specific adaptations of the web frontend:

- Reuses components from `../frontend/src/components`
- Desktop-specific routing and navigation
- Tauri API integration for invoking Rust commands
- Adapted UI for native window controls

Key differences from web version:
- Uses `@tauri-apps/api` for system integration
- Custom titlebar and window controls
- Native file picker dialogs
- System tray integration

## Key Environment Variables

Configure these in your `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_URL` | Path of Agent backend API URL | `http://localhost:3000` |
| `VITE_API_BASE_URL` | Vite build-time API URL | Same as `BACKEND_URL` |

## Development Workflow

### Running the Backend

The desktop application requires the Path of Agent backend to be running for:
- PoB (Path of Building) analysis
- AI-powered build recommendations
- Knowledge base access
- Meta build comparisons

Start the backend separately:
```bash
cd ../backend
npm run dev
```

### Hot Reload

The development server supports hot reload for:
- React components (instant)
- Rust code (requires recompilation, ~10-30s)

### Debugging

**Frontend (React):**
- Open DevTools: Right-click → Inspect Element
- Or use `Ctrl+Shift+I` / `Cmd+Option+I`

**Backend (Rust):**
- Use `println!()` or `dbg!()` macros - output appears in terminal
- Enable Rust backtrace: `RUST_BACKTRACE=1 npm run tauri dev`

### Testing

```bash
# Frontend tests
npm test

# Rust tests
cd src-tauri
cargo test

# Integration tests
npm run test:integration
```

## Common Issues

### "Backend not responding"
Ensure the backend is running at the URL specified in `BACKEND_URL`.

### "Trade API blocked"
The desktop app makes trade API calls from your local IP. Ensure you're not rate-limited by GGG's trade API.

### "WebView2 not found" (Windows)
Install WebView2 Runtime: https://developer.microsoft.com/microsoft-edge/webview2/

### Build fails with "linker error"
Ensure all platform-specific dependencies are installed (see Prerequisites).

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri API Reference](https://tauri.app/v1/api/js/)
- [Path of Agent Backend API](../docs/api-reference/)
- [Contributing Guide](../CONTRIBUTING.md)

## License

See [LICENSE](../LICENSE) file in the project root.
