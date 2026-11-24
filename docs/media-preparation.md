# Prepare media for streaming

## Generate thumbnails

Configure `config.toml`, then run:

```bash
python scripts/generate_thumbs.py config.toml
```

`ffmpeg` and `ffprobe` must be available on `PATH`.

Each thumbnail is named by the video's fingerprint, in the thumbnails directory, so a moved or renamed video keeps its own and copies of one video share one; [Catalogue](catalogue.md#thumbnails-and-media-info-follow-the-videos-content) describes this store. It only creates missing thumbnails, from the frame 20 seconds in, keeping the part one eye sees for the layout the catalogue guesses ([Catalogue](catalogue.md)), or halfway through a video shorter than that (its duration read with `ffprobe`), through a temporary file so that an interrupted run leaves none half-written. A video it cannot make a thumbnail for, such as an unreadable file, is reported, and the script exits with an error after the others; the next run tries it again.

## Generate seek thumbnails

Hovering the player's seek bar shows the time under the pointer and, when the
video has seek thumbnails, its frame there. Make them with:

```bash
python scripts/generate_seek_thumbs.py config.toml
```

then run `generate_json.py` again, which lists them in the catalogue.

A video gets a frame every fortieth of its duration, rounded up to 10, 15, 20, 30 or 60 seconds: at most 40 frames for a video under 40 minutes, one a minute for a longer one (past 10 hours, a little less often). The frames are 160 pixels wide, showing what one eye sees, in one image per video named by its fingerprint, like the thumbnails. Each frame is the keyframe just before its time, so the script reads a little of the file around each one rather than the whole video, which matters on a cloud mount.

It only makes what is missing, but a first run over a large library takes long, up to hours on a small server: run it after the catalogue, so that new videos show in the library without waiting for it. A video it cannot read is reported, and the script exits with an error after the others; the next run tries it again.

## Make MP4s stream efficiently

Large MP4 files load promptly only when their `moov` metadata atom precedes
the media data. The catalogue generator lists the videos without it at the end
of each run. Check a directory without modifying files:

```powershell
python scripts/remux_faststart.py D:\download\my_library --recursive
```

The script reports MP4s as `READY` or `NEEDS REMUX` and also finds MKVs. To
remux safe MP4s in place and replace compatible MKVs with `.mp4`, opt in:

```powershell
python scripts/remux_faststart.py D:\download\my_library --recursive --apply
```

It uses `ffmpeg -c copy -movflags +faststart`, so it rewrites the container
without re-encoding audio or video. An MKV is deleted only after its MP4 output
has been validated, and multiple audio tracks are preserved. MKVs with
incompatible subtitle, attachment, or data streams are skipped and explained.

Add `--keep-original` to retain every source file. Retained MKVs keep their
original names; retained MP4s are saved as `filename.mp4.original` after the
validated fast-start MP4 replaces `filename.mp4`. Existing `.original` backups
are never overwritten. To deliberately create a video/audio-only MP4 from
incompatible files, use `--force` with `--apply`:

```powershell
python scripts/remux_faststart.py D:\download\my_library --recursive --apply --force
```

`ffmpeg` and `ffprobe` must be available on `PATH`. The script validates the
expected output streams before publishing an output file. Regenerate
`files.json` after MKV conversions so the catalogue uses the new `.mp4` paths.

## Convert AV1 videos for Quest 2

The Quest 2 has no AV1 hardware decoder, so AV1 videos are decoded in software
and play with low frame rates and stuttering. HEVC is decoded in hardware. To
list the AV1 videos in a directory tree without modifying files:

```powershell
python scripts/transcode_av1.py D:\download\my_library
```

To re-encode them to HEVC one at a time, opt in:

```powershell
python scripts/transcode_av1.py D:\download\my_library --apply
```

Each file is encoded to a hidden `.name.av1-hevc-tmp.mp4` beside its source,
checked for HEVC video, a matching duration and every audio stream, and then
swapped into place. MP4 sources keep their names; MKV, WebM and MOV sources
become `.mp4` files and the source is deleted. Re-encoding is lossy, the source
is not kept, and subtitle and attachment streams are dropped. Audio is copied
when MP4 supports it and otherwise converted to AAC. 10-bit sources stay
10-bit.

If a run is interrupted, run the same command again. Leftover temporary files
are deleted and those sources are encoded from the start. A source whose
verified `.mp4` was already published is deleted without re-encoding. If the
script is force-killed rather than stopped with Ctrl+C, let its `ffmpeg`
process exit before resuming. Do not run two instances on the same tree.

Use `--crf` (default `20`; lower is higher quality and larger) and `--preset`
(default `medium`; `slow` is smaller but takes longer) to adjust the encode.
Regenerate `files.json` afterwards so the catalogue uses any new `.mp4` paths.
