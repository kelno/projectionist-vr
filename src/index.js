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
import SourcesSelectorPanel from "./sourceSelector.js";

import FontJSON from "../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../assets/fonts/Roboto-Regular.png";
import { JsonLoader } from "./jsonLoader.js";
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
  sourcesSelectorPanel,
  hiddenSphere;
export let clickedButton = undefined;
export let camToSave = {};

let popupMessage, popupContainer;
// The surfaces the video shows on (screenMeshes.js).
let screens;
let pendingVideoPlayback = null;

const CAMERAPOSITIONY = 1.6;

// compute mouse position in normalized device coordinates
// (-1 to +1) for both directions.
// Used to raycasting against the interactive elements

const raycaster = new THREE.Raycaster();
raycaster.layers.set(0);

const mouse = new THREE.Vector2();
mouse.x = mouse.y = null;

let selectState = false;

window.addEventListener("pointermove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("pointerdown", () => {
  selectState = true;
});

window.addEventListener("pointerup", () => {
  selectState = false;
  clickedButton = undefined;
});

window.addEventListener("touchstart", (event) => {
  selectState = true;
  mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("touchend", () => {
  selectState = false;
  clickedButton = undefined;
  mouse.x = null;
  mouse.y = null;
});

//

function init() {
  const libraryLoading = loadJsonLoader();

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
  vrControl.controllers.forEach((controller, id) => {
    controller.addEventListener("connected", (event) => {
      controller.userData.inputSource = event.data;
    });
    controller.addEventListener("disconnected", () => {
      controller.userData.inputSource = null;
      if (vrControlCurrentlyUsedController === id) {
        vrControlCurrentlyUsedController = 1 - id;
      }
    });
  });

  function vrControlSelected(id) {
    if (vrControlCurrentlyUsedController == id) {
      selectState = true;
    } else {
      vrControl.controllers[
        vrControlCurrentlyUsedController
      ].point.visible = false;
      vrControlCurrentlyUsedController = id;
    }
  }

  function vrControlUnselected(id) {
    if (vrControlCurrentlyUsedController == id) {
      selectState = false;
      clickedButton = undefined;
    }
  }

  //////////
  // Panel
  //////////

  hiddenSphere = new UI.HiddenSphere();
  scene.add(hiddenSphere);
  UI.objsToTest.push(hiddenSphere);
  playMenuPanel = new PlayerPanel(video);

  ////////////////////////////////////////
  popupContainer = new ThreeMeshUI.Block({
    justifyContent: "center",
    contentDirection: "row",
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontSize: 0.07,
    padding: 0.02,
    borderRadius: 0,
    backgroundOpacity: 1,
    backgroundColor: new THREE.Color(0x5c5c5c),
    height: 0.2,
    width: 2,
  });
  popupMessage = new ThreeMeshUI.Text({
    content: "",
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontSize: 0.07,
    offset: 0.035,
    fontColor: new THREE.Color(0xffffff),
  });
  popupContainer.add(popupMessage);
  popupContainer.position.set(0, 1, -2);
  popupContainer.visible = false;
  scene.add(popupContainer);
  ////////////////////////////////////////

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
  sourcesSelectorPanel = new SourcesSelectorPanel(Extensions.registered);

  //

  setTimeout(setLoop, 500);

  // Say the library is loading, then open it as soon as files.json arrives.
  sourcesSelectorPanel.sourcesSelectorContainer.visible = false;
  showPopupMessage(Helpers.getWordFromLang("loading_library"), 0);
  Promise.all([
    libraryLoading,
    fileBrowserPanel.defaultVideoThumbnailReady,
  ]).then(([jsonLoader]) => {
    fileBrowserPanel.libraryLoading = false;
    if (jsonLoader.status !== "success") {
      showPopupMessage(Helpers.getWordFromLang("library_load_failed"), 0);
      return;
    }
    hidePopupMessage();
    sourcesSelectorPanel.refreshSources();
    if (sourcesSelectorPanel.sources.length === 1) {
      selectFirst();
    } else {
      sourcesSelectorPanel.showSourcesSelectorPanel();
    }
  });
}

function setLoop() {
  renderer.setAnimationLoop(loop);
}

function selectFirst() {
  sourcesSelectorPanel.selectFirstSourceIfOnlyOneAvailable();
}

let showPopupTimeoutID;

export function showPopupMessage(message, duration = 4000) {
  if (typeof message === "string") {
    popupMessage.set({ content: message });
    popupContainer.visible = true;
    clearTimeout(showPopupTimeoutID);
    if (duration > 0) {
      showPopupTimeoutID = setTimeout(() => {
        popupContainer.visible = false;
      }, duration);
    }
  } else {
    console.warn(Helpers.getWordFromLang("show_popup_message_error"));
  }
}

function hidePopupMessage() {
  clearTimeout(showPopupTimeoutID);
  popupContainer.visible = false;
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
    popup.rotation.x = -0.7;
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
  const actions = controllerInput(
    state,
    { playing: playbackIsActive },
    performance.now()
  );
  actions.forEach(runControllerAction);
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

  updateButtons();

  playMenuPanel.progressBarAndDuration();

  // Execute Thumbnails Loader
  if (fileBrowserPanel !== undefined) {
    fileBrowserPanel.loadingAnimation();
    fileBrowserPanel.generateThumbnails();
  }
}

// Called in the loop, get intersection with either the mouse or the VR controllers,
// then update the buttons states according to result

function updateButtons() {
  // Find closest intersecting object

  let intersect;

  if (renderer.xr.isPresenting) {
    vrControl.setFromController(
      vrControlCurrentlyUsedController,
      raycaster.ray
    );

    intersect = raycast();

    // Position the little white dot at the end of the controller pointing ray
    // need to skip this if intersecting hiddenSphere because in VR it spreads points apart
    if (intersect && intersect.object.name != hiddenSphere.name) {
      vrControl.setPointerAt(vrControlCurrentlyUsedController, intersect.point);
    }
  } else if (mouse.x !== null && mouse.y !== null) {
    raycaster.setFromCamera(mouse, camera);

    intersect = raycast();
  }

  // Update targeted button state (if any)

  if (intersect && intersect.object.isUI) {
    intersect.object.uv = { x: intersect.uv.x, y: intersect.uv.y };

    if (selectState) {
      // A press selects the component under the pointer once. Coming back
      // over it during the same press must not fire it again: a button that
      // opens a panel covering itself would otherwise close it at once.
      if (clickedButton === undefined) {
        clickedButton = intersect.object.uuid;
        intersect.object.setState("selected");
      }
    } else {
      // Component.setState internally call component.set with the options you defined in component.setupState
      intersect.object.setState("hovered");
    }
  }

  updateTooltip(
    intersect && intersect.object.isUI && intersect.object !== hiddenSphere
      ? intersect.object
      : null,
    renderer.xr.isPresenting ? renderer.xr.getCamera() : camera
  );

  // Update non-targeted buttons state

  UI.objsToTest.forEach((obj) => {
    // The sphere catching clicks outside the panels isn't a Block, but must
    // also go idle, or its next click is ignored as a repeat.
    if (obj === hiddenSphere && (!intersect || obj !== intersect.object)) {
      obj.setState("idle");
      return;
    }
    if (
      obj instanceof ThreeMeshUI.Block &&
      (!intersect || obj !== intersect.object) &&
      obj.isUI
    ) {
      obj.setState("idle");
    }
  });
}

//

function raycast() {
  return UI.objsToTest.reduce((closestIntersection, obj) => {
    // Keyboard
    if (
      obj.type === "Key" &&
      fileBrowserPanel !== undefined &&
      !fileBrowserPanel.keyboard.getObjectById(obj.id)
    ) {
      return closestIntersection;
    }

    const intersection = raycaster.intersectObject(obj, true);

    if (!intersection[0]) return closestIntersection;

    if (
      !closestIntersection ||
      intersection[0].distance < closestIntersection.distance
    ) {
      intersection[0].object = obj;

      return intersection[0];
    }

    return closestIntersection;
  }, null);
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

let Extensions = { registered: [] };

export default function registerExtension(name) {
  Extensions.registered.push(name);
}

async function loadJsonLoader() {
  const jsonFile = "files.json";
  const jsonLoader = new JsonLoader(jsonFile);
  await jsonLoader.load();
  return jsonLoader;
}
