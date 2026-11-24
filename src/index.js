import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import WebGL from "three/addons/capabilities/WebGL.js";

import ThreeMeshUI from "./ui/meshUi.js";
import VRControl from "./vr/VRControl.js";

import { PlayerPanel } from "./PlayerPanelUI.js";
import { FileBrowserPanel } from "./FileBrowser/FileBrowserPanelUI.js";
import * as ScreenManager from "./ScreenManager/ScreenManager.js";
import * as UI from "./UI.js";
import * as Helpers from "./Helpers.js";
import { watchVideoTexture } from "./videoTextureWatchdog.mjs";
import {
  GRIP_LIBRARY_CONTROLS,
  GRIP_PLAYER_CONTROLS,
  makeGripPopup,
} from "./ui/controlHints.js";
import { createTooltip } from "./ui/tooltip.js";
import { createBufferingIndicator } from "./ui/bufferingIndicator.js";
import { createErrorReporter } from "./errorReport.mjs";
import { playerVersion } from "./playerConfig.js";
import { createScreenMeshes } from "./screenMeshes.js";
import { createControllerInput, readGamepad } from "./input/controllerInput.mjs";
import { createPointer } from "./input/pointer.js";
import { createPopupMessage } from "./ui/popupMessage.js";

export let scene,
  camera,
  renderer,
  orbitControls,
  vrControl,
  vrControlCurrentlyUsedController,
  video,
  videoTexture,
  playMenuPanel,
  fileBrowserPanel,
  hiddenSphere;
export let camToSave = {};

// The pointer (input/pointer.js) and the popup message (ui/popupMessage.js).
let pointer, popup;
// The surfaces the video shows on (screenMeshes.js).
let screens;
let pendingVideoPlayback = null;

const CAMERAPOSITIONY = 1.6;

function init() {
  const libraryLoading = loadCatalogue();

  ////////////////////////
  //  Basic Three Setup
  ////////////////////////

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);

  // In VR the near plane is the headset's too: at 1 m it cut off the
  // controllers in the user's hands, which flickered as they crossed it.
  camera = new THREE.PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    0.05,
    1000
  );
  camera.layers.enable(1);
  camera.position.y = CAMERAPOSITIONY;
  scene.add(camera);
  ScreenManager.registerPanel(camera, "cameras");

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(VRButton.createButton(renderer));
  document.getElementById("three_scene").appendChild(renderer.domElement);

  // Orbit controls for no-vr

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target = new THREE.Vector3(0, 1, -1.8);

  /////////
  // Room
  /////////

  video = document.getElementById("video");
  video.addEventListener("error", () => {
    if (!isPendingVideoPlaybackCurrent()) {
      return;
    }

    console.error("Unable to load video:", video.currentSrc, video.error);
    pendingVideoPlayback = null;
    showPopupMessage(Helpers.getWordFromLang("video_not_found"));
  });
  video.addEventListener("loadedmetadata", startPendingVideoPlayback);

  videoTexture = new THREE.VideoTexture(video);
  checkVideoTexture = watchVideoTexture(video, videoTexture);
  screens = createScreenMeshes(
    scene,
    new THREE.MeshBasicMaterial({ map: videoTexture }),
    CAMERAPOSITIONY
  );

  //////////
  // Light
  //////////

  const color = 0xffffff;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(-1, 2, 4);
  scene.add(light);

  ////////////////
  // Controllers
  ////////////////

  vrControl = VRControl(renderer);
  vrControlCurrentlyUsedController = 0;
  scene.add(vrControl.controllerGrips[0], vrControl.controllers[0]);
  scene.add(vrControl.controllerGrips[1], vrControl.controllers[1]);
  createGripPopups();
  updateTooltip = createTooltip(scene);
  updateBufferingIndicator = createBufferingIndicator(scene);

  vrControl.controllers[0].addEventListener("selectstart", () => {
    vrControlSelected(0);
  });
  vrControl.controllers[0].addEventListener("selectend", () => {
    vrControlUnselected(0);
  });

  vrControl.controllers[1].addEventListener("selectstart", () => {
    vrControlSelected(1);
  });
  vrControl.controllers[1].addEventListener("selectend", () => {
    vrControlUnselected(1);
  });

  // Each controller keeps the input source three.js gives it on connecting.
  // The session's own list of input sources shifts when one disconnects (a
  // controller low on battery), so it can't be read by controller number.
  //
  // The controller in use must be a connected one. When it disconnects, the
  // other takes over if it is connected; when a controller connects while the
  // one in use isn't, it takes over. Ending a session disconnects both, so
  // with a single controller, the next session would otherwise start on the
  // missing one, with no pointer and no buttons.
  const isConnected = (id) => Boolean(vrControl.controllers[id].userData.inputSource);
  vrControl.controllers.forEach((controller, id) => {
    controller.addEventListener("connected", (event) => {
      controller.userData.inputSource = event.data;
      if (!isConnected(vrControlCurrentlyUsedController)) {
        useController(id);
      }
    });
    controller.addEventListener("disconnected", () => {
      controller.userData.inputSource = null;
      if (vrControlCurrentlyUsedController === id && isConnected(1 - id)) {
        useController(1 - id);
      }
    });
  });

  function useController(id) {
    vrControl.controllers[vrControlCurrentlyUsedController].point.visible = false;
    vrControlCurrentlyUsedController = id;
  }

  // A press of the controller in use clicks; a press of the other one
  // makes it the one in use.
  function vrControlSelected(id) {
    if (vrControlCurrentlyUsedController == id) {
      pointer.press();
    } else {
      useController(id);
    }
  }

  function vrControlUnselected(id) {
    if (vrControlCurrentlyUsedController == id) {
      pointer.release();
    }
  }

  //////////
  // Panel
  //////////

  hiddenSphere = new UI.HiddenSphere();
  scene.add(hiddenSphere);
  UI.objsToTest.push(hiddenSphere);
  playMenuPanel = new PlayerPanel(video);

  pointer = createPointer({
    renderer,
    camera,
    vrControl,
    controller: () => vrControlCurrentlyUsedController,
    hiddenSphere,
  });
  popup = createPopupMessage(scene);

  /////////////////////////////////////////////////////////////

  // save current camera position
  camToSave.position = camera.position.clone();
  camToSave.rotation = camera.rotation.clone();
  camToSave.controlCenter = orbitControls.target.clone();

  renderer.xr.addEventListener("sessionend", ScreenManager.vrsessionend);
  renderer.xr.addEventListener("sessionend", () => showGripPopup(false));

  //
  // FILES

  fileBrowserPanel = new FileBrowserPanel({});

  setTimeout(setLoop, 500);

  // Say the library is loading, then open it as soon as files.json arrives.
  showPopupMessage(Helpers.getWordFromLang("loading_library"), 0);
  Promise.all([
    libraryLoading,
    fileBrowserPanel.defaultVideoThumbnailReady,
  ]).then(([catalogue]) => {
    fileBrowserPanel.libraryLoading = false;
    if (catalogue === null) {
      showPopupMessage(Helpers.getWordFromLang("library_load_failed"), 0);
      return;
    }
    hidePopupMessage();
    fileBrowserPanel.loadCatalogue(catalogue);
    fileBrowserPanel.showFileMenuPanel();
  });
}

function setLoop() {
  renderer.setAnimationLoop(loop);
}

export function showPopupMessage(message, duration = 4000) {
  popup.show(message, duration);
}

function hidePopupMessage() {
  popup.hide();
}

export function requestVideoPlayback(source, screenType) {
  // Explicitly abort the old resource before registering this selection. This
  // prevents late media events from a rapid previous click opening the player.
  cancelVideoPlaybackRequest();
  pendingVideoPlayback = { source, screenType };
  showPopupMessage(Helpers.getWordFromLang("loading_video"), 0);

  const { sourceChanged, playback } = Helpers.setVideoSrc(source);
  playback.catch((error) => {
    if (error.name !== "AbortError") {
      console.error("Unable to start video playback:", error);
    }
  });

  if (!sourceChanged && Number.isFinite(video.duration) && video.duration > 0) {
    startPendingVideoPlayback();
  }
}

// Play an entry of the catalogue, from the library or from the player's
// next and previous buttons.
export function playCatalogueVideo(file) {
  const aspect = (file.frame_width ?? 1) / (file.frame_height ?? 1);
  if (file.screen_type === "screen") {
    screens.setScreenAspect(aspect);
  }
  if (file.screen_type === "tb_screen") {
    screens.setTBScreenAspect(aspect);
  }
  requestVideoPlayback(file.src, file.screen_type);
}

export function leaveVR() {
  renderer.xr.getSession()?.end();
}

export function cancelVideoPlaybackRequest() {
  pendingVideoPlayback = null;
  Helpers.removeVideoSrc();
  hidePopupMessage();
}

function startPendingVideoPlayback() {
  if (!isPendingVideoPlaybackCurrent()) {
    return;
  }

  const { source, screenType } = pendingVideoPlayback;
  pendingVideoPlayback = null;
  Helpers.restoreVideoPosition(source);
  hidePopupMessage();
  fileBrowserPanel.hideFileMenuPanel(screenType);
}

function isPendingVideoPlaybackCurrent() {
  return (
    pendingVideoPlayback !== null &&
    Helpers.isCurrentVideoSrc(pendingVideoPlayback.source)
  );
}


// Handle resizing the viewport

function onWindowResize() {
  if (camera !== undefined && renderer !== undefined) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

//

export let playbackIsActive = false;

export function playbackChange(is_active = false, screen_type = null) {
  switch (is_active) {
    case true:
      playbackIsActive = true;
      screens.showDefault();
      if (screen_type !== null) {
        ScreenManager.switchModeVRScreen(screen_type);
      }
      ScreenManager.applyPlaybackZoom();
      // The fisheye layouts are 2D only.
      if (["sphere180", "sphere360"].includes(ScreenManager.VRMode)) {
        ScreenManager.force2DMode(true);
      }
      playMenuPanel.refreshModeLabels();
      break;
    default:
    case false:
      playbackIsActive = false;
      screens.hideAll();
      ScreenManager.resetZoomPosition();
      break;
  }
}

// The grip popup floats above the controller in use while its grip is held,
// and lists what the grip does where the user is: player or library.
const gripPopups = {};

function createGripPopups() {
  gripPopups.player = makeGripPopup(GRIP_PLAYER_CONTROLS);
  gripPopups.library = makeGripPopup(GRIP_LIBRARY_CONTROLS);
  for (const popup of Object.values(gripPopups)) {
    popup.scale.setScalar(0.15);
    popup.position.set(0, 0.12, 0.02);
    // Tilted back to face the eyes with the hand held level: at -0.7 the
    // owner had to dip their hand to read it, so it's 45° further back.
    popup.rotation.x = -0.7 - Math.PI / 4;
    popup.visible = false;
  }
}

function showGripPopup(held) {
  const shown = playbackIsActive ? gripPopups.player : gripPopups.library;
  const grip = vrControl.controllerGrips[vrControlCurrentlyUsedController];
  for (const popup of Object.values(gripPopups)) {
    const visible = held && popup === shown;
    if (visible && popup.parent !== grip) {
      grip.add(popup);
    }
    popup.visible = visible;
  }
}

const controllerInput = createControllerInput();

function gamepadControlsUpdate() {
  if (!renderer.xr.isPresenting) {
    return;
  }
  const controller = vrControl.controllers[vrControlCurrentlyUsedController];
  const gamepad = controller.userData.inputSource?.gamepad;
  if (gamepad?.mapping !== "xr-standard") {
    showGripPopup(false);
    return;
  }
  const state = readGamepad(gamepad);
  showGripPopup(state.grip);
  controllerInput(state, { playing: playbackIsActive }).forEach(runControllerAction);
}

function runControllerAction(action) {
  switch (action.type) {
    case "zoom":
      ScreenManager.zoom(action.direction, 0.5);
      break;
    case "tilt":
      ScreenManager.tilt(action.direction, 0.005);
      break;
    case "seek":
      playMenuPanel.videoPlaybackFFRew(action.seconds > 0 ? "FF" : "Rew", Math.abs(action.seconds));
      break;
    case "adjacentVideo":
      playMenuPanel.playAdjacentVideo(action.offset);
      break;
    case "page":
      if (action.offset > 0) {
        fileBrowserPanel.nextPage();
      } else {
        fileBrowserPanel.previousPage();
      }
      break;
    case "playPause":
      playMenuPanel.playPause();
      break;
    case "exitToLibrary":
      playMenuPanel.ExitToMain();
      break;
    case "leaveVR":
      leaveVR();
      break;
  }
}

let checkVideoTexture = () => {};
let updateTooltip = () => {};
let updateBufferingIndicator = () => {};

// Errors go to the server's access log, where they can be read without the
// headset (see errorReport.mjs).
const reportError = createErrorReporter({
  send: (query) => fetch(`diag?${query}`, { cache: "no-store" }).catch(() => {}),
  version: playerVersion,
});
window.addEventListener("error", (event) =>
  reportError("window", event.error ?? event.message)
);
window.addEventListener("unhandledrejection", (event) =>
  reportError("promise", event.reason)
);

// three.js asks for the next frame only once this one has returned, so an
// error thrown during a frame would stop every later one: the picture
// freezes while the sound plays on, and no button responds, until the
// headset sleeps and the VR session restarts. Catch it, report it, go on.
function loop() {
  try {
    renderFrame();
  } catch (error) {
    // Logged and reported the first time only: it may repeat every frame.
    if (reportError("frame", error)) {
      console.error(error);
    }
  }
}

function renderFrame() {
  const now = performance.now();
  checkVideoTexture(now);
  updateBufferingIndicator(
    video,
    renderer.xr.isPresenting ? renderer.xr.getCamera() : camera,
    now
  );

  renderer.render(scene, camera);

  ThreeMeshUI.update();

  orbitControls.update();

  gamepadControlsUpdate();

  updateTooltip(
    pointer.update(),
    renderer.xr.isPresenting ? renderer.xr.getCamera() : camera
  );

  playMenuPanel.progressBarAndDuration();

  // Execute Thumbnails Loader
  if (fileBrowserPanel !== undefined) {
    fileBrowserPanel.loadingAnimation();
    fileBrowserPanel.generateThumbnails();
  }
}

if (WebGL.isWebGL2Available()) {
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("load", () => {
    init();
  });
} else {
  const warning = WebGL.getWebGL2ErrorMessage();
  document.body.appendChild(warning);
}

// The catalogue (files.json, beside the page), or null when it can't be
// loaded.
async function loadCatalogue() {
  try {
    const response = await fetch("files.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("The catalogue could not be loaded:", error);
    return null;
  }
}
