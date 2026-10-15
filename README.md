# Tudi Tracker

The open-source coding tracker behind [Tudi Daily](https://tudidaily.com), the RPG where the code you write levels up your character.

Tudi Tracker counts **when** you code, **in which language**, **how many lines changed** and **how many of them an AI tool wrote**. That is all that leaves your computer. File names, file paths, branches, dependencies and your real project names never do; a project is sent only as a salted one-way hash that is different on every computer.

This repository is open so you can check exactly what is sent.

## What is here

| Folder | What |
|---|---|
| `cli/` | `tudi-cli`, a fork of [wakatime-cli](https://github.com/wakatime/wakatime-cli) (BSD-3-Clause) pointed at Tudi Daily, with an always-on privacy step and a `--link` command |

Editor extensions (VS Code family, JetBrains) come next and call `tudi-cli` the same way WakaTime plugins call `wakatime-cli`.

## Link your computer

1. In the Tudi Daily app open **Kod Kulesi → Bilgisayarını bağla**; it shows an 8-character code.
2. Run:

   ```sh
   tudi-cli --link ABCD-EFGH
   ```

The device key is written to `~/.tudi.cfg` (set `TUDI_HOME` to use another folder). It can only write coding activity and you can remove the computer in the app at any time.

## What changed from wakatime-cli

Upstream: wakatime/wakatime-cli at `bac8eba3b7f10f0a4c23dcc7609277b6be406277`. Every change is marked with a `tudi-tracker` comment.

- Default API: `https://api.tudidaily.com/api/tracker/v1`; config file `~/.tudi.cfg` (a WakaTime setup on the same computer is left alone).
- `pkg/heartbeat/tudi_privacy.go`: runs on every heartbeat after the upstream sanitization, whatever the config says. It removes the file name (keeps the extension), branch, dependencies, line numbers, AI session id and prompt length, and hashes the project name with a per-computer salt (`~/.tudi-salt`).
- `cmd/link`: `--link CODE` trades a code from the app for a device key.

AI line attribution works as upstream does: the CLI reads the local logs of AI coding tools (Claude Code, Copilot, Cursor…) on your computer to count AI-written lines. Those logs never leave your computer; only the line counts do. `--sync-ai-disable` turns it off.

## Build

```sh
cd cli
go build -o ../bin/tudi-cli .
go test ./pkg/heartbeat/ ./pkg/ini/ ./cmd/...
```

## Licence

- `cli/` keeps wakatime-cli's BSD-3-Clause licence and copyright notice (`cli/LICENSE`, `cli/AUTHORS`).
- New code in this repository is MIT (`LICENSE`).
