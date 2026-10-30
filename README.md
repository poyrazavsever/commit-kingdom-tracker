# Commit Kingdom Tracker

The open-source coding tracker behind [Commit Kingdom](https://commitkingdom.com), the strategy game where your commits build your kingdom.

> Formerly Tudi Tracker. For compatibility with existing installs, the CLI keeps the name `tudi-cli`, its files stay in `~/.tudi` and `~/.tudi.cfg`, `TUDI_HOME` still selects another folder, and the extension, plugin and app ids, setting keys and command ids are unchanged. The desktop installers keep their `TudiDesktop-*` file names so existing download links keep working.

Commit Kingdom Tracker counts **when** you code, **in which language**, **how many lines changed** and **how many of them an AI tool wrote**. That is all that leaves your computer. File names, file paths, branches, dependencies and your real project names never do; a project is sent only as a salted one-way hash that is different on every computer.

This repository is open so you can check exactly what is sent.

## What is here

| Folder | What |
|---|---|
| `desktop/` | Commit Kingdom Desktop (Electron, MIT): signs this computer in with your Commit Kingdom account and shows today's coding |
| `cli/` | `tudi-cli`, a fork of [wakatime-cli](https://github.com/wakatime/wakatime-cli) (BSD-3-Clause) pointed at Commit Kingdom, with an always-on privacy step |
| `vscode/` | The extension for the VS Code family (VS Code, Cursor, Windsurf, VSCodium, Antigravity) |
| `jetbrains/` | The plugin for JetBrains IDEs 2024.2 and later (IntelliJ IDEA, PyCharm, WebStorm, Rider, GoLand, Android Studio…) |

Editor extensions call `tudi-cli` the same way WakaTime plugins call `wakatime-cli`.

## Sign your computer in

1. Install Commit Kingdom Desktop and click **Sign in**. Your browser opens Commit Kingdom; approve this computer there.
2. Commit Kingdom Desktop gets a device key for this computer. It keeps the key encrypted with your operating system's key store and writes it to `~/.tudi.cfg` for `tudi-cli` (set `TUDI_HOME` to use another folder).

The key can only write coding activity. Signing out of Commit Kingdom Desktop, or removing the computer in the app's Code Tower, turns it off.

3. Commit Kingdom Desktop carries `tudi-cli` and puts it in `~/.tudi`; each Commit Kingdom Desktop update brings the matching `tudi-cli`. It finds the VS Code family editors on the computer by their install folders and installs the Commit Kingdom Tracker extension in each with one click. The extension never asks you to sign in: it uses the key Commit Kingdom Desktop wrote and sends nothing until there is one. The JetBrains plugin works the same way.

## What changed from wakatime-cli

Upstream: wakatime/wakatime-cli at `bac8eba3b7f10f0a4c23dcc7609277b6be406277`. Every change is marked with a `tudi-tracker` comment.

- Default API: `https://api.commitkingdom.com/api/tracker/v1`; config file `~/.tudi.cfg` and its own folder `~/.tudi` for the offline queue, log and state (a WakaTime setup on the same computer is left alone).
- `pkg/heartbeat/tudi_privacy.go`: runs on every heartbeat after the upstream sanitization, whatever the config says. It removes the file name (keeps the extension), branch, dependencies, line numbers, AI session id and prompt length, and hashes the project name with a per-computer salt (`~/.tudi-salt`).
- `pkg/ai/tudi_lookback.go`: AI tool logs are read from the moment the computer is signed in and never more than 24 hours back. Upstream starts a first sync in February 2025 and reads every AI session on the computer; on a busy machine that took over 8 minutes, now the first heartbeat after signing in takes about a second.

AI line attribution works as upstream does: the CLI reads the local logs of AI coding tools (Claude Code, Copilot, Cursor…) on your computer to count AI-written lines. Those logs never leave your computer; only the line counts do. `--sync-ai-disable` turns it off.

## Build

```sh
cd cli
go build -o ../bin/tudi-cli .
go test ./...
```

The upstream tests expect what tudi-cli sends: hidden file names, hashed projects, no AI session ids, the Commit Kingdom API. The AI parsing tests read dated log fixtures, so they run without the one-day lookback, which has its own test. File experts needs a file path, so tudi-cli never asks for them. `.github/workflows/cli.yml` runs the tests on Linux, Windows and macOS, and a Commit Kingdom Desktop release runs them before it builds `tudi-cli`.

Commit Kingdom Desktop (`build:cli` puts this platform's `tudi-cli` in `desktop/resources/bin/`; pass targets such as `darwin-arm64 win32-x64` to build others):

```sh
cd desktop
npm install
npm run build:cli
npm test
TUDI_API_URL=http://localhost:5130 TUDI_APP_URL=http://localhost:8080 npm start
```

Packaging and releases: `npm run dist` builds the editor extension and then the installer for this machine into `desktop/dist` (Windows: a per-user NSIS setup). Pushing a `desktop-vX.Y.Z` tag matching `desktop/package.json` runs `.github/workflows/desktop-release.yml`, which builds Windows and macOS (arm64 + x64) with their `tudi-cli` and VS Code extension and publishes them to GitHub Releases; installed copies update from there in the background.

The VS Code extension is built automatically for local Desktop development and packaged inside release builds, so the one-click installer works before Marketplace and Open VSX publishing. `TUDI_VSIX` remains available as an explicit development override. To build or test the extension directly:

```sh
cd vscode
npm install
npm test
npm run package
```

The JetBrains plugin (Java 21; it behaves like the VS Code extension: the key comes from Commit Kingdom Desktop, heartbeats go through `tudi-cli`, the status bar shows today). `buildPlugin` puts the installable zip in `jetbrains/build/distributions/`; until it is on JetBrains Marketplace, install it with *Settings → Plugins → ⚙ → Install Plugin from Disk*:

```sh
cd jetbrains
./gradlew test buildPlugin
./gradlew runIde   # a sandbox IDE with the plugin
```

## Licence

- `cli/` keeps wakatime-cli's BSD-3-Clause licence and copyright notice (`cli/LICENSE`, `cli/AUTHORS`).
- New code in this repository is MIT (`LICENSE`).
