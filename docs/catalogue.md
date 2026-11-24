# Catalogue and video formats

The player reads a locally generated `files.json` catalogue. Configure
`config.ini`, then run `generate_json.sh` or:

```powershell
python scripts/generate_json.py config.ini
```

The generator creates one category for each video directory and uses the
directory name as its label. Generated entries default to `sbs`. To use another
projection or stereo layout, edit an entry’s `screen_type` in `files.json`, or
provide a catalogue from another source.

## Catalogue structure

```json
{
  "videos": [
    {
      "name": "Music",
      "list": [
        {
          "name": "K-POP COVER DANCE",
          "src": "/vr-player/media/Music/K-POP%20COVER%20DANCE.mp4",
          "thumbnail": "/vr-player/thumbnails/fa56ea00-3f6c2b9e81d04a57.jpg",
          "screen_type": "sbs",
          "date": "2023-01-10 15:05:50",
          "epoch": "1673359550.854825",
          "media": {
            "size": 4200000000,
            "width": 5760,
            "height": 2880,
            "video_codec": "hevc",
            "fps": 59.94,
            "audio_codec": "aac",
            "audio_channels": 2,
            "duration": 3723.0,
            "bit_rate": 38000000
          }
        }
      ]
    }
  ]
}
```

Each category has a display `name` and a `list` of videos. `src` and
`thumbnail` must be browser-accessible URLs. `date` and `epoch` support date
sorting. Flat videos can additionally supply `frame_height` and `frame_width`.

`media` is what the player's Media info page shows. The generator reads it with
FFprobe, from each video's header; a field FFprobe can't tell is left out, and
an entry without `media` still plays, its page showing what the browser knows.
Pass `--no-media-info` to run no FFprobe: entries then only get the `media`
already in the store (below).

## Thumbnails and media info follow the video's content

The generator knows each video by a fingerprint: its size and a hash of its
first and last megabyte, such as `fa56ea00-3f6c2b9e81d04a57`. Thumbnails and
media info are kept under that fingerprint, so a video that is moved or
renamed keeps both, and two copies of one video share them. Only those two
megabytes are read, because reading a whole file from a cloud mount downloads
it.

The thumbnails directory (`thumbnails_path`) is this store, with no subfolders:

- `<fingerprint>.jpg`: a thumbnail, which `thumbnail` links when it exists.
- `media.json`: the `media` of each fingerprint. FFprobe runs only for a
  fingerprint missing from it.
- `fingerprints.json`: the fingerprint computed for each video path, with the
  file's size and modification time then. A video whose size and modification
  time haven't changed since is not read again.

Thumbnails and media info of deleted videos stay in the store until a run with
`--prune`, which deletes those no current video uses. It refuses to prune when
it finds no video at all, which more likely means the library isn't mounted.

## Screen types

| Value | Layout |
| --- | --- |
| `sbs` | Side-by-side 180° |
| `tb` | Top-bottom 180° |
| `360` | Top-bottom 360° |
| `sphere180` | Single-lens fisheye 180°, not VR |
| `sphere360` | Single-lens fisheye 360°, not VR |
| `screen` | Normal 2D screen |
