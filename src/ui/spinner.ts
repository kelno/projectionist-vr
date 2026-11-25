import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";

import { colour } from "./theme.ts";

export type Spinner = Group & { spin(): void };

// A ring in the accent colour turning on a dark disc, shown while something loads. Call
// `spin()` each frame it shows.
export function createSpinner(radius: number): Spinner {
    const background = new Mesh(
        new CircleGeometry(radius * 1.35, 32),
        new MeshBasicMaterial({ color: colour("surface"), transparent: true, opacity: 0.85 }),
    );
    const ring = new Mesh(
        new RingGeometry(radius * 0.7, radius, 32, 1, 0, Math.PI * 1.5),
        new MeshBasicMaterial({ color: colour("accent"), side: DoubleSide }),
    );
    ring.position.z = 0.001;
    // A Spinner once spin() is set, just below.
    const spinner = new Group().add(background, ring) as Spinner;
    spinner.visible = false;
    spinner.spin = () => {
        ring.rotation.z -= 0.15;
    };
    return spinner;
}
