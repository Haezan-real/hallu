# Hallu Video Editor

## Quick Start (Batch Scripts)

- **`launch_vite_server.bat`**: Starts the Vite dev server on `0.0.0.0:5173` (`npm run dev -- --host 0.0.0.0`). Run this first.
- **`hallu_editor_dev.exe`**: Native launcher with embedded Hallu Day icon (no shortcut arrow) that launches `bin/hallu_editor_dev.bat`.
- **`bin/hallu_editor_dev.bat`**: Launches Electron in dev mode (`npx electron main.cjs`). Checks that the Vite server is running first, and shows an error with next steps if not.
- **`npm_install.bat`**: Installs dependencies inside `bin/`.

---

## Folder Structure

```text
hallu/
├── hallu_editor_dev.exe      # Native launcher with embedded Hallu Day icon
├── launch_vite_server.bat    # Starts Vite dev server (run this first)
├── npm_install.bat           # Run npm install inside bin/
├── readme.md                 # Project documentation
├── assets/                   # Shared media assets (icons, sounds)
│   ├── icons/
│   │   └── app/              # Day/night .ico and .png icons
│   └── sounds/
│       └── SFX/              # Sound effects
├── dist/                     # Compiled frontend output (from Vite build)
├── user/                     # User-customizable content
│   ├── settings.json         # Human-readable settings, themes, and keybinds
│   ├── shaders/              # Custom user shaders
│   ├── projects/             # Saved project files
│   └── talismans/            # Custom talismans
└── bin/                      # Engine source, tests, and build tooling
    ├── hallu_editor_dev.bat  # Dev launcher batch script
    ├── hallu_editor_dev.cs   # Source code for root .exe launcher
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




