# Deploy with Nginx

The application is a static website after building. There is no application server, database, or Node.js server at runtime. A production build works at any site path: it loads its assets relative to its own script, so the same `dist/` serves `/vr-player/` or a dedicated host.

## Releases

Pushing a version tag builds and publishes a release with the [Release workflow](../.github/workflows/release.yml). The tag must be the `package.json` version with a `v` in front:

```bash
npm version minor   # updates package.json and package-lock.json, commits, and tags, e.g. v1.3.0
git push --follow-tags
```

A tag with a hyphen, such as `v1.15.0-uikit.1` from `npm version 1.15.0-uikit.1`, is published as a pre-release, for trying a branch on a server.

The release holds `projectionist-vr-<tag>.tar.gz`, which contains:

- `dist/`: the built site, without `files.json`.
- `scripts/`: the catalogue and thumbnail generators, which need only Python 3 and FFmpeg (for thumbnails, and for the media info the catalogue records). The other media preparation scripts come along.
- `LICENSE`.
- `config.toml.example` and `nginx.conf.example`, to start the configuration from.

Running the workflow by hand from the Actions tab builds and tests the branch without publishing; the tarball is kept as a workflow artifact.

The release is built without a `config.toml`, so `[player]` settings keep their defaults. To change them, build the bundle yourself (below).

## Build it yourself

Create an optimized bundle:

```powershell
npm run build
```

Then generate the catalogue, because the build clears old output:

```powershell
python scripts/generate_thumbs.py config.toml
python scripts/generate_json.py config.toml
```

## Serve it

Deploy the `dist/` directory as a single unit. The catalogue can live inside it (the default output of `generate_json.py`) or elsewhere, with `--output`: keeping it outside `dist/` lets a new release replace `dist/` without losing it. Generate thumbnails before the catalogue, which only links thumbnails that exist. Both scripts write to the thumbnails directory, which also holds the media info and fingerprints the catalogue reuses ([Catalogue](catalogue.md#thumbnails-and-media-info-follow-the-videos-content)), so the user who runs them needs write access to it. Add `--prune` to the catalogue command now and then to delete the thumbnails of deleted videos. Seek thumbnails take longer to make ([Prepare media](media-preparation.md#generate-seek-thumbnails)): run `generate_seek_thumbs.py` after the catalogue, so a long run doesn't hold new videos back; the next catalogue run lists what it made.

Configure Nginx to serve `dist/` at the configured site path, `files.json` at the same path, and map `/media/` and `/thumbnails/` to the actual library directories. Nginx must be able to read those directories and support HTTP byte-range requests for video seeking.

Use [nginx.conf.example](nginx.conf.example) as the site configuration starting point. Its paths must match `[web]` in `config.toml`.
