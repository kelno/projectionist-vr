import {
    CircleGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    RingGeometry,
    Vector3,
} from "three";

import { createBufferingTracker, isBuffering } from "../bufferingState.mjs";

// A spinner shown while the video seeks or waits for data, floating a little
// ahead of where the viewer looks: the video surrounds them in VR, so there is
// no fixed spot on it that they are sure to see.
const DISTANCE = 1.5;
const RADIUS = 0.04;

const forward = new Vector3();

export function createBufferingIndicator(scene) {
    const background = new Mesh(
        new CircleGeometry(RADIUS * 1.35, 32),
        new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
    );
    const ring = new Mesh(
        new RingGeometry(RADIUS * 0.7, RADIUS, 32, 1, 0, Math.PI * 1.5),
        new MeshBasicMaterial({ color: 0xffff00, side: DoubleSide })
    );
    ring.position.z = 0.001;
    const spinner = new Group().add(background, ring);
    spinner.visible = false;
    scene.add(spinner);

    const shouldShow = createBufferingTracker();

    // Call once per frame.
    return function update(video, camera, now) {
        spinner.visible = shouldShow(isBuffering(video), now);
        if (!spinner.visible) {
            return;
        }
        camera.getWorldPosition(spinner.position);
        camera.getWorldDirection(forward);
        spinner.position.addScaledVector(forward, DISTANCE);
        camera.getWorldQuaternion(spinner.quaternion);
        ring.rotation.z -= 0.15;
    };
}
