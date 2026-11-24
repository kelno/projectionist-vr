# Catalogue and video formats

The player reads a locally generated `files.json` catalogue. Configure
`config.toml`, then run:

```powershell
python scripts/generate_json.py config.toml
```

The generator creates one category for each video directory and uses the
directory name as its label. A video's label is its file name without the
extension, with `_` and `+` read as spaces; `name_prefixes` in `config.toml`
lists text to cut from the start of file names, such as a site's or a
studio's name (`name_prefixes = ["Studio - "]`). Each entry's `screen_type`, its layout (below), is
guessed: from a marker in the file name, as a whole word (`sbs`, `lr`, `3dh` or
`180` for side-by-side; `tb`, `ou` or `3dv` for top-bottom; `360` for
top-bottom 360°; `2d` or `flat` for a flat screen), else from the frame's shape
in the media info (2:1 side-by-side, 1:2 top-bottom, 1:1 top-bottom 360°, 16:9
flat), else side-by-side. To set another, rename the file with a marker, edit
the entry in `files.json`, or provide a catalogue from another source.

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
            "bit_rate": 38000000,
            "faststart": true
          },
          "seek_thumbnails": {
            "url": "/vr-player/thumbnails/fa56ea00-3f6c2b9e81d04a57.seek.jpg",
            "interval": 60,
            "columns": 8,
            "count": 63
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

`faststart` says whether an MP4 or MOV keeps its index before the video data.
When it doesn't (`false`), the browser must fetch the end of the file before
showing anything, so the video starts slowly; the Media info page flags it, and
the generator ends its run by listing these videos with the command that fixes
them ([Prepare media](media-preparation.md#make-mp4s-stream-efficiently)). The
check reads only the headers of the file's boxes, a few bytes each, needs no
FFprobe, and is kept in the store with the rest of the media info.

`seek_thumbnails` is what hovering the seek bar shows: one image of `count`
small frames in a grid `columns` wide, filled row by row, each frame standing
for `interval` seconds from the one before. `generate_seek_thumbs.py` makes
them ([Prepare media](media-preparation.md#generate-seek-thumbnails)); a video
without them shows only the time under the pointer.

## Thumbnails and media info follow the video's content

The generator knows each video by a fingerprint: its size and a hash of its
first and last megabyte, such as `fa56ea00-3f6c2b9e81d04a57`. Thumbnails, seek
thumbnails and media info are kept under that fingerprint, so a video that is
moved or renamed keeps them, and two copies of one video share them. Only those two
megabytes are read, because reading a whole file from a cloud mount downloads
it.

The thumbnails directory (`thumbnails_path`) is this store, with no subfolders:

- `<fingerprint>.jpg`: a thumbnail, which `thumbnail` links when it exists.
- `<fingerprint>.seek.jpg`: the seek thumbnails, which `seek_thumbnails` links
  when they exist.
- `media.json`: the `media` of each fingerprint. FFprobe runs only for a
  fingerprint missing from it.
- `seek.json`: the `interval`, `columns` and `count` of each fingerprint's seek
  thumbnails.
- `fingerprints.json`: the fingerprint computed for each video path, with the
  file's size and modification time then. A video whose size and modification
  time haven't changed since is not read again.

Thumbnails, seek thumbnails and media info of deleted videos stay in the store
until a run with
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
