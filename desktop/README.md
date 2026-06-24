# Desktop Agent — GUI Frontend for Qwen-Agent

A desktop GUI application for the Qwen-Agent cross-application automation engine. Built with Electron + SolidJS + TypeScript + Tailwind CSS.

## Architecture

```
desktop-agent/
├── agent_bridge.py              # Python adapter (bridge between Electron and core agent)
├── run_gui_owl_1_5_for_pc.py    # Core agent (LangGraph-based, UNCHANGED)
├── utils.py                     # Core utilities (UNCHANGED)
└── desktop/                     # Electron desktop app
    ├── package.json
    ├── electron.vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    └── src/
        ├── main/                # Electron main process
        │   ├── main.ts          # App entry, window creation, custom protocol
        │   ├── config-store.ts  # Secure API config storage (safeStorage)
        │   └── python-runner.ts # Python child process management
        ├── preload/
        │   ├── index.ts         # contextBridge API for renderer
        │   └── index.d.ts       # TypeScript declarations
        └── renderer/            # SolidJS frontend
            ├── index.html
            ├── main.tsx
            ├── App.tsx          # Main layout with sidebar + router
            ├── global.css       # Tailwind + custom styles
            ├── types.ts         # Shared type definitions
            ├── routes/
            │   ├── ChatView.tsx       # Main task view
            │   └── ApiSettingsView.tsx # API config page
            └── components/
                ├── Sidebar.tsx
                ├── AgentTimeline.tsx
                ├── StepCard.tsx
                ├── ScreenshotPreview.tsx
                ├── ToolCallCard.tsx
                ├── ApiConfigPanel.tsx
                ├── RunControls.tsx
                ├── StatusBadge.tsx
                └── TaskInput.tsx
```

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.9
- Python packages: `pyautogui`, `pyperclip`, `Pillow`, `numpy`, `openai`

## Quick Start

```powershell
# 1. Install Python dependencies
pip install pyautogui pyperclip Pillow numpy openai langgraph

# 2. Install Node.js dependencies and run
cd desktop
npm install
npm run dev
```

## How It Works

1. **Desktop GUI** collects user's API key, base URL, and model name via the Settings page.
2. API key is encrypted with OS-level `safeStorage` (Windows DPAPI / macOS Keychain).
3. User enters a task instruction → frontend sends it via IPC to main process.
4. Main process spawns `agent_bridge.py` with user config and instruction.
5. `agent_bridge.py` imports the core agent module, creates `GUIOwlWrapper` with user config, and calls `core.run_agent(...)`.
6. Python outputs JSON Lines on stdout — events like `step_started`, `output`, `screenshot`, `run_finished`.
7. Electron reads stdout in real-time, emits events to renderer via IPC.
8. Renderer updates the step timeline, screenshot previews, and tool call cards.
9. User can click **Stop** to kill the Python process at any time.

## Security

- API key is encrypted with Electron's `safeStorage` (system credential store).
- Renderer never has access to the plaintext API key — it only gets a masked version.
- Logs and error messages are sanitized to never leak the API key.
- `pyautogui` FAILSAFE is preserved (move mouse to corner to abort).

## Key Design Decisions

- **Core agent files are NEVER modified** — `run_gui_owl_1_5_for_pc.py` and `utils.py` remain unchanged.
- **No `core.main()` is called** — the bridge creates its own `GUIOwlWrapper` and calls `core.run_agent()` directly.
- **`MODEL_NAME` is monkey-patched** — the bridge overrides the module constant before execution.
- **API config is always user-provided** — no hardcoded keys in any file.
