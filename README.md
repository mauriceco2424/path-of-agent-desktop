# Path of Agent — Desktop Client

This is the desktop client for [Path of Agent](https://pathofagent.com), a Path of Exile 1 build analysis tool. Tauri (Rust shell) + React (TypeScript UI). This repository contains the part that runs on the user's PC.

The source is published so anyone can audit, build, and modify the code that the production installer ships to your machine.

## Repository contents

- `desktop/` — Tauri app shell (Rust) and React UI (TypeScript). The `.exe` users install is built from this directory.
- `shared/` — TypeScript types and constants shared between the desktop client and the backend.
- `LICENSE` — MIT.

## What this repository does NOT contain

- **The backend.** Closed source. Handles auth, billing, the OpenAI proxy, the analytics pipeline, and the ladder data hydration. Production users hit `api.pathofagent.com` for those.
- **The bundled backend sidecar.** The production `.exe` ships a `poa-backend` binary alongside the Tauri app, started as a Tauri sidecar, that drives Path of Building locally on the user's PC. That binary is built from the closed-source backend and is not in this repo. A local build from this source produces a Tauri app that has nothing to talk to on `localhost:9876` unless you run a backend yourself.
- **The Path of Building engine extension.** Lives in a separate public repository: [`mauriceco2424/PathOfBuilding`](https://github.com/mauriceco2424/PathOfBuilding/tree/dev/src/API) (branch `dev`). That's where the ~5,900 lines of custom Lua and the 52-function JSON-RPC API the agent calls into actually live. Forked from [`PathOfBuildingCommunity/PathOfBuilding`](https://github.com/PathOfBuildingCommunity/PathOfBuilding).
- **Production signing keys, certificates, or `.env` files.** Standard.

## Why some parts are open and some aren't

The desktop client is the part that runs on your PC. "Trust this random installer" is a fair concern, and the right answer is to publish the source so it can be audited. The same logic applies to the PoB engine extension — every DPS, EHP, and resistance number in the app's output came from a real Path of Building simulation, and the simulation code is open.

The server backend stays closed because it carries auth, billing, and a proxied OpenAI key. That's a normal client/server split, not a transparency hole. What runs on your PC is auditable; what runs on a server you don't operate is not yours to inspect anyway.

## Build from source

Requirements:

- Node.js 18+ and npm
- Rust toolchain (stable) for the Tauri side — `cargo`, `rustc`
- Windows 10 or newer for a Windows build (the target platform for the production app)

Install dependencies and start the dev server:

```sh
cd desktop
npm install
npm run tauri:dev
```

Note that `tauri:dev` will start the Tauri shell and try to spawn the `poa-backend` sidecar. Without that binary (closed source, see above), the agent functionality will not work end-to-end — but the UI builds, runs, and is fully inspectable.

## License

MIT. See [LICENSE](LICENSE). Copyright © 2026 Maurice Colling.

## Related

- [pathofagent.com](https://pathofagent.com) — product website
- [`mauriceco2424/PathOfBuilding`](https://github.com/mauriceco2424/PathOfBuilding/tree/dev/src/API) — PoB engine extension (52-function JSON-RPC API), forked from PoB Community
