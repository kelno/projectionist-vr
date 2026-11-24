# Get started

## Requirements

- Node.js and npm to install dependencies and build the browser bundle.
- A static web server: opening `index.html` directly from disk cannot load `files.json`.
- Python 3.13 or later to generate `files.json`. The scripts use only the standard library.
- [uv](https://docs.astral.sh/uv/), only to run the checks below.
- FFmpeg and FFprobe, for thumbnails, for the media info in the catalogue (`--no-media-info` skips it) and for preparing media.

## First-time setup

Install the locked dependency versions:

```powershell
npm ci
```

Create `config.ini` from `config.ini.example`. Set local video and thumbnail
library paths, the player site path (for example `/vr-player`), and the media
URL prefixes Nginx exposes below it. In `[player]`, `default_sbs_zoom` accepts
0 through 180 and defaults to 100. The project’s own filesystem path is not
part of this configuration.

Generate the catalogue:

```powershell
python scripts/generate_json.py config.ini
```

The generator writes `dist/files.json`. Run it after adding, removing, or
moving videos.

`[library]` holds local filesystem paths used by the Python tooling and the
development server; `[web]` defines browser and Nginx URL paths; `[player]`
contains browser-safe player preferences. Configurations using `[videos]` must
move local paths to `[library]` and URL prefixes to `[web]`.

## Local development

Run the HTTPS development server from the repository root:

```powershell
npm run dev
```

It rebuilds on source changes and serves the player at port 8040. It reads the
media paths and URL prefixes from `config.ini`, so local playback uses the same
site and media URL contract as Nginx. Open the configured site path after the
printed desktop or LAN URL (for example `/vr-player/`). Stop it with `Ctrl+C`.

Webpack generates a self-signed development certificate. In a headset, open
the printed HTTPS URL and accept its one-time certificate warning before
entering WebXR.

For production build and serving instructions, see [Deploy with Nginx](deployment.md).

## Checks

Run every check before committing:

```powershell
npm run check
```

It runs the JavaScript tests, then checks the Python scripts with
[ruff](https://docs.astral.sh/ruff/) (lint and formatting) and
[basedpyright](https://docs.basedpyright.com/) (types), then runs their tests.
`uv run ruff format` formats the scripts; their settings are in
`pyproject.toml`. The same command runs on GitHub for each push to `main` and
each pull request, and before each release is built.
