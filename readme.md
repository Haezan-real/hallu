# Hallu Video Editor

## Quick Start (Batch Scripts)

- **`launch_vite_server.bat`**: Starts the Vite dev server on `0.0.0.0:5173` (`npm run dev -- --host 0.0.0.0`). Run this first.
- **`hallu_editor_dev.bat`**: Launches Electron in dev mode (`npx electron main.cjs`). Checks that the Vite server is running first, and shows an error with next steps if not.
- **`npm_install.bat`**: Installs dependencies inside `bin/`.

---

## Folder Structure

```text
hallu/
├── launch_vite_server.bat    # Starts Vite dev server (run this first)
├── hallu_editor_dev.bat      # Launches Electron dev mode (npx electron main.cjs)
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




