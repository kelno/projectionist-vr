import { Vector3 } from "three";
import type { Camera, Object3D } from "three";

import { createBufferingTracker, isBuffering } from "../bufferingState.ts";
import { createSpinner } from "./spinner.ts";

// A spinner shown while the video seeks or waits for data, floating a little
// ahead of where the viewer looks: the video surrounds them in VR, so there is
// no fixed spot on it that they are sure to see.
const DISTANCE = 1.5;
const RADIUS = 0.04;

const forward = new Vector3();

export function createBufferingIndicator(
    scene: Object3D,
): (video: HTMLVideoElement | null | undefined, camera: Camera, now: number) => void {
    const spinner = createSpinner(RADIUS);
    scene.add(spinner);

    const shouldShow = createBufferingTracker();

    // Call once per frame.
    return function update(video: HTMLVideoElement | null | undefined, camera: Camera, now: number): void {
        spinner.visible = shouldShow(isBuffering(video), now);
        if (!spinner.visible) {
            return;
        }
        camera.getWorldPosition(spinner.position);
        camera.getWorldDirection(forward);
        spinner.position.addScaledVector(forward, DISTANCE);
        camera.getWorldQuaternion(spinner.quaternion);
        spinner.spin();
    };
}
