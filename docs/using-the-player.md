# Using the player

## Library features

- Browse video categories generated from the library directory structure.
- Search and sort the current category.
- Play SBS, top-bottom, 360°, fisheye, and flat entries from `files.json`.
- Select a video, then wait for browser media metadata before switching into
  the player.
- A video you leave and open again resumes where you left it, as long as the
  page stays open. Reloading the page forgets every position; a video watched
  to the end starts again from the beginning.

### Search and sorting

Search filters the current folder. The phrase remains active when you switch
folders until you clear it. Sort by name or date, in ascending or descending
order.

![Search box](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_4.png?raw=true)

![On-screen keyboard](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_4_1.png?raw=true)

![Sorting](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_5.png?raw=true)

### Reposition views

In the Folders view, hold the trigger and drag the bottom bar to reposition it.

![Reposition folders](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_6.png?raw=true)

In Player view, the same gesture repositions the controls and video spheres.
You can instead reposition only the player controls. Controls and spheres reset
to their default position when you exit the current video.

![Reposition player](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_7.png?raw=true)

![Reposition controls](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_8.png?raw=true)

## Controls

The Controls button under the library opens a panel listing the controls
below. While you hold the grip, a popup above the controller lists what the
grip combinations do there.
Resting the pointer on a button shows what it does.

On the left controller, X and Y take the place of A and B. If two controllers
are connected, pull the trigger on the other one to point with it instead.

### Library

- Trigger: select. On the bar under the library, hold it to move the library.
- Thumbstick left or right: previous or next page.
- Grip + B, held for a second, or the power button under the library: leave VR.

### Player

- Thumbstick up or down: zoom. The browser remembers your zoom for later
  videos; before you first change it, SBS playback starts at the configured
  `default_sbs_zoom`. Leaving VR, for instance when the headset sleeps, keeps
  the zoom.
- Thumbstick left or right: back or forward 10 seconds.
- A: play or pause. B: back to the library.
- Trigger on the video: show or hide the player controls. A click outside the
  settings closes them.
- Grip + thumbstick up or down: tilt the screen.
- Grip + thumbstick left or right: previous or next video in the library's
  current list, as searched and sorted. The arrow buttons at either end of the
  playback buttons do the same.
- Grip + B, held for a second: leave VR.
- The reset button puts the screen and the controls back in place, with the
  configured default zoom.

## Screenshots

![Library view](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_1.png?raw=true)

![Player view](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_2.png?raw=true)

![Playback controls](https://github.com/michal-repo/web_vr_video_player/blob/main/examples/Screenshot_VR_player_3.png?raw=true)
