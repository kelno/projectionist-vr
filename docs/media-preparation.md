# Prepare media for streaming

## Generate thumbnails

Configure `config.ini`, then run:

```bash
./generate_thumbnails.sh
```

`ffmpeg` and `ffprobe` must be available on `PATH`.

## Make MP4s stream efficiently

Large MP4 files load promptly only when their `moov` metadata atom precedes
the media data. Check a directory without modifying files:

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
