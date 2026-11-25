import * as THREE from "three";
import type { Object3D } from "three";

import type { Component } from "@pmndrs/uikit";

import * as MAIN from "./index.ts";
import type { Block } from "./ui/meshUi.ts";

import * as ScreenManager from "./ScreenManager/ScreenManager.ts";

import * as Helpers from "./Helpers.ts";

// The sphere behind everything (HiddenSphere below), which the pointer
// treats as a three-mesh-ui block: it has the states and the uv a block has.
export interface HiddenSphereMesh extends THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
    isUI: boolean;
    currentState: string | undefined;
    states: Record<string, { onSet?: () => void }>;
    // Whether the player's buttons show, so a click toggles them.
    buttonsVisible: boolean;
    // Where the pointer last hit it; input/pointer.ts sets it.
    uv?: { x: number; y: number };
    setupState(options: { state: string; onSet?: () => void }): void;
    setState(state: string): void;
}

// What the pointer can click: three-mesh-ui blocks, uikit panels and the
// hidden sphere.
export type PointerTarget = Block | Component | HiddenSphereMesh;

export let objsToTest: PointerTarget[] = [];

export function hideMenu(
    menuContainer: Object3D | Object3D[],
    passedObjsToTest: PointerTarget[] = [],
    shouldSwitch2d3d = false,
): void {
    if (shouldSwitch2d3d) {
        ScreenManager.switch2d3d("3d");
    }
    if (menuContainer.constructor === Array) {
        menuContainer.forEach((element) => {
            element.visible = false;
        });
    } else {
        // Not an array: the check above narrows only its own branch.
        (menuContainer as Object3D).visible = false;
    }
    objsToTest = [];
    if (passedObjsToTest.length > 0) {
        objsToTest = passedObjsToTest.slice();
    } else {
        objsToTest.push(MAIN.hiddenSphere);
        MAIN.vrControl.controllers[MAIN.vrControlCurrentlyUsedController].point.visible = false;
    }
}

export function showMenu(
    menuContainer: Object3D | Object3D[],
    passedObjsToTest: PointerTarget[],
    shouldSwitch2d3d = false,
): void {
    if (shouldSwitch2d3d) {
        ScreenManager.switch2d3d("2d");
    }
    if (menuContainer.constructor === Array) {
        menuContainer.forEach((element) => {
            element.visible = true;
        });
    } else {
        // Not an array: the check above narrows only its own branch.
        (menuContainer as Object3D).visible = true;
    }
    objsToTest = [];
    objsToTest = passedObjsToTest.slice();
    MAIN.vrControl.controllers[MAIN.vrControlCurrentlyUsedController].point.visible = true;
}

// What a click outside the open window does, usually closing it. The window
// sets it when it opens and clears it when it closes; the hidden sphere behind
// everything calls it. Add MAIN.hiddenSphere to the targets for it to work.
let closeOpenWindow: (() => void) | null = null;

export function setOutsideClick(close: (() => void) | null): void {
    closeOpenWindow = close;
}

export function registerNewObjectsToTest(passedObjsToTest: PointerTarget[]): void {
    objsToTest = [];
    objsToTest = passedObjsToTest.slice();
}

// `new HiddenSphere()` gives the sphere mesh, not an instance of this class:
// the constructor returns it.
export class HiddenSphere {
    hiddenSphere: HiddenSphereMesh;

    constructor() {
        //////////
        // Hidden Sphere
        //////////
        const hiddenGeometry = new THREE.SphereGeometry(100, 60, 40);
        const hiddenMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            opacity: 0,
            transparent: true,
        });
        hiddenMaterial.side = THREE.BackSide;
        // The lines below add what makes it a HiddenSphereMesh.
        this.hiddenSphere = new THREE.Mesh(hiddenGeometry, hiddenMaterial) as HiddenSphereMesh;
        this.hiddenSphere.name = "hiddenSphere";
        this.hiddenSphere.isUI = true;
        this.hiddenSphere.currentState = undefined;
        this.hiddenSphere.states = {};
        this.hiddenSphere.buttonsVisible = false;
        this.hiddenSphere.setupState = function (options) {
            this.states[options.state] = {
                onSet: options.onSet,
            };
        };
        this.hiddenSphere.setState = function (state) {
            const savedState = this.states[state];

            if (!savedState) {
                console.warn(`state "${state}" does not exist within this component:`, this.name);
                return;
            }
            if (state === this.currentState) return;
            this.currentState = state;
            if (savedState.onSet) savedState.onSet();
        };
        this.hiddenSphere.setupState({
            state: "hovered",
        });
        this.hiddenSphere.setupState({
            state: "idle",
        });
        this.hiddenSphere.setupState({
            state: "selected",
            onSet: () => {
                // A click outside an open window closes only that window.
                if (closeOpenWindow) {
                    const close = closeOpenWindow;
                    closeOpenWindow = null;
                    close();
                } else if (Helpers.videoSrcExists() && !this.hiddenSphere.buttonsVisible) {
                    MAIN.playMenuPanel.showPlayMenuPanel();
                } else if (Helpers.videoSrcExists()) {
                    MAIN.playMenuPanel.hidePlayMenuPanel();
                }
            },
        });

        // ScreenManager.registerObjectToDrag(this.hiddenSphere, "player", "meshes");
        // ??????

        return this.hiddenSphere as unknown as HiddenSphere;
    }
}
