# Hallu Video Editor

## Quick Start (Batch Scripts)

- **`hallu_editor_dev.bat`**: One-click developer launcher. Builds assets, starts the Vite server on `0.0.0.0:5173`, and opens the Electron app with live dev server reload.
- **`build_vite_server.bat`**: Builds frontend assets into `dist/` and runs the Vite server (`npm run dev -- --host 0.0.0.0`).
- **`npm_install.bat`**: Installs dependencies inside `bin/`.

---

## Folder Structure

```text
hallu/
├── hallu_editor_dev.bat      # One-click dev launcher
├── build_vite_server.bat     # Build + run Vite dev server
├── npm_install.bat           # Run npm install inside bin/
├── readme.md                 # Project documentation
├── assets/                   # Shared media assets (icons, sounds)
│   ├── icons/
│   │   └── app/              # Day/night .ico and .png icons
│   └── sounds/
│       └── SFX/              # Sound effects
├── dist/                     # Compiled frontend output (from Vite build)
├── user/                     # User-customizable content
│   ├── shaders/              # Custom user shaders
│   ├── projects/             # Saved project files
│   └── talismans/            # Custom talismans
└── bin/                      # Engine source, tests, and build tooling
    ├── node_modules/         # Dependencies
    ├── src/                  # React + TypeScript source code
    ├── tests/                # Vitest test suite
    ├── main.cjs              # Electron main process
    ├── preload.cjs           # Electron preload script
    ├── iconRounding.cjs      # Icon corner-rounding utility
    ├── package.json          # Manifest & scripts
    ├── vite.config.ts        # Vite configuration
    ├── vitest.config.ts      # Vitest configuration
    ├── tsconfig.json         # TypeScript configuration
    └── config.json           # Runtime app configuration
```

---

## IMPORTANT NOTES

### Shaders
- The editor will not work if `base_window_transparency` is less than `0.004` in `bin/config.json`.
- When coding a shader, make sure to swap the blue and red channels in the output color (WebGL uses BGRA, GLSL uses RGBA).

### Enshittify & Downscale
- `downscale_factor` won't downscale if `enshittify` is disabled.
- Enabling `enshittify` makes the whole image look shit, even with no downscale.


