import type { Object3D } from "three";

import * as MAIN from "../index.ts";
import PanelsList from "./Panels.ts";
import type { Eye, PanelGroup, ScreenMode } from "./Panels.ts";
import type { ScreenType } from "../types/catalogue.ts";
import { playerConfig } from "../playerConfig.ts";
import { loadPreference, savePreference } from "../browserPreferences.ts";

const ZOOM_PREFERENCE = "zoom";
const MAX_ZOOM = 180;

// What can be dragged together: the video's screens and the player's panel
// ("player"), the player's controls alone, or the library.
export type DragView = "player" | "playerControls" | "files";

interface DragObject {
    panelName: PanelGroup;
    ref: Object3D;
}

function clampZoom(value: unknown): number | null {
    const zoom = Number(value);
    return Number.isFinite(zoom) ? Math.min(Math.max(zoom, 0), MAX_ZOOM) : null;
}

function loadSavedZoom(): number | null {
    const savedZoom = loadPreference(ZOOM_PREFERENCE);
    return savedZoom === null ? null : clampZoom(savedZoom);
}

function saveZoom(zoom: number): void {
    savePreference(ZOOM_PREFERENCE, zoom);
}

let isVRModeUsed = true;
// The layout of the video playing; a flat video ("screen") keeps the last one.
export let VRMode: Exclude<ScreenType, "screen"> = "sbs";
let currently_3d = true;
export let force_2d_mode = false;
export let currentZoom = 0;
const panels = new PanelsList();
export const objectsToDrag: { [view: string]: DragObject[] } = {};

// `group` is what the panel resets with: "playMenuPanel", "fileBrowserPanel"...
export function registerPanel(ref: Object3D, group: Exclude<PanelGroup, "meshes">): void {
    panels.addPanel(ref, group);
}

export function registerMeshPanel(ref: Object3D, mode: ScreenMode, screen_type: ScreenType, eye: Eye): void {
    panels.addMesh(ref, mode, screen_type, eye);
}

export function registerObjectToDrag(obj: Object3D, view: DragView, panelName: PanelGroup): void {
    if (!(view in objectsToDrag)) {
        objectsToDrag[view] = [];
    }
    objectsToDrag[view].push({
        panelName: panelName,
        ref: obj,
    });
}

// Leaving VR (the headset sleeping, for instance) puts every panel back in
// place, but keeps the zoom the user was watching with.
export function vrsessionend(): void {
    const zoomInUse = currentZoom;
    resetZoomPosition();
    resetPosition("cameras");
    resetPosition("playMenuPanel");
    resetPosition("fileBrowserPanel");
    resetPosition("meshes");
    setZoom(zoomInUse, false);
}

export function resetPosition(group: PanelGroup): void {
    panels[group]?.panels.forEach((panel) => panel.reset());
}

export function zoom(in_or_out: "in" | "out" | "reset", step = 10): void {
    let targetZoom = currentZoom;
    switch (in_or_out) {
        case "in":
            targetZoom = currentZoom + step;
            break;
        case "out":
            targetZoom = currentZoom - step;
            break;
        case "reset":
            targetZoom = 0;
            break;
        default:
            return;
    }
    setZoom(targetZoom, true);
}

function setZoom(targetZoom: number, persistPreference: boolean): void {
    const oldZoom = currentZoom;
    currentZoom = clampZoom(targetZoom) ?? 0;
    if (oldZoom !== currentZoom) {
        for (const screen of panels.meshes.panels) {
            const start = screen.position.clone();
            if (currentZoom === 0) {
                screen.reference.position.copy(start.applyEuler(screen.reference.rotation));
            } else {
                screen.reference.translateOnAxis(start.normalize(), oldZoom - currentZoom);
            }
        }
    }
    if (persistPreference) {
        saveZoom(currentZoom);
    }
}

// Restore the user's choice for every video. Before a choice has been saved,
// retain the configured SBS-only behaviour and leave other modes at base size.
export function applyPlaybackZoom(): void {
    const savedZoom = loadSavedZoom();
    const initialZoom = savedZoom ?? (VRMode === "sbs" ? playerConfig.defaultSbsZoom : 0);
    setZoom(initialZoom, false);
}

// The player reset control restores the deployment's configured starting zoom
// and makes it the new browser preference for later videos.
export function resetZoomToConfiguredDefault(): void {
    setZoom(playerConfig.defaultSbsZoom, true);
}

// Playback transitions need a base mesh position, but must not erase the
// browser preference that will be restored for the next selected video.
export function resetZoomPosition(): void {
    setZoom(0, false);
}

export function tilt(up_or_down: "up" | "down" | "reset", value = 0.01): void {
    switch (up_or_down) {
        case "up":
            for (const screen of panels.meshes.panels) {
                screen.reference.rotation.x -= value;
            }
            break;
        case "down":
            for (const screen of panels.meshes.panels) {
                screen.reference.rotation.x += value;
            }
            break;
        case "reset":
            for (const screen of panels.meshes.panels) {
                screen.reference.rotation.x = screen.rotation.x;
            }
            break;
        default:
            break;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Switch between VR and Screen mode

export function switchModeVRScreen(vr_or_screen: ScreenType | "vr"): void {
    if (!currently_3d) {
        switch2d3d("3d", true);
    }
    panels.meshes.panels.forEach((mesh) => {
        mesh.switchModeVRScreen(vr_or_screen);
    });
    switch (vr_or_screen) {
        case "vr":
        case "sbs":
            isVRModeUsed = true;
            VRMode = "sbs";
            break;
        case "tb":
            isVRModeUsed = true;
            VRMode = "tb";
            break;
        case "360":
            isVRModeUsed = true;
            VRMode = "360";
            break;
        case "sphere180":
            VRMode = "sphere180";
            isVRModeUsed = false;
            break;
        case "sphere360":
            VRMode = "sphere360";
            isVRModeUsed = false;
            break;
        case "screen":
            isVRModeUsed = false;
            break;
        case "tb_screen":
            VRMode = "tb_screen";
            isVRModeUsed = true;
            break;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Switch between 2D and 3D mode

export function switch2d3d(switch_2d_or_3d: "2d" | "3d", forced = false): void {
    if (isVRModeUsed && (!force_2d_mode || forced)) {
        panels.meshes.panels.forEach((mesh) => {
            mesh.switch2d3d(switch_2d_or_3d, VRMode);
        });
        switch (switch_2d_or_3d) {
            case "2d":
                currently_3d = false;
                break;
            case "3d":
                currently_3d = true;
                break;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Force 2D mode

export function force2DMode(bool: boolean): void {
    force_2d_mode = bool;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export let dragging = false;

export function startDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && !dragging && view in objectsToDrag) {
        objectsToDrag[view].forEach((obj) => {
            MAIN.vrControl.controllers[
                MAIN.vrControlCurrentlyUsedController
            ].attach(obj.ref);
        });
        dragging = true;
    }
}

export function stopDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && dragging && view in objectsToDrag) {
        objectsToDrag[view].forEach((obj) => {
            MAIN.scene.attach(obj.ref);
        });
        dragging = false;
    }
}

export function resetDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && view in objectsToDrag) {
        resetZoomPosition();
        const readyList: PanelGroup[] = [];
        objectsToDrag[view].forEach((obj) => {
            if (!(obj.panelName in readyList)) {
                resetPosition(obj.panelName);
                readyList.push(obj.panelName);
            }
        });
        if (view === "player") {
            // Same as the zoom reset in the settings: the configured default.
            resetZoomToConfiguredDefault();
        }
    }
}
