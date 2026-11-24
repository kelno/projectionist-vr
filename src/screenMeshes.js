import { Mesh, PlaneGeometry, SphereGeometry } from "three";

import * as ScreenManager from "./ScreenManager/ScreenManager.js";

// The surfaces the video is shown on, one per layout and eye. A stereo video
// shows half of each frame to each eye: three.js draws layer 1 in the left
// eye and layer 2 in the right, so a layout has a left mesh on layer 1, a
// right mesh on layer 2, and a "2d" mesh on layer 2 with the left eye's half,
// used when the stereo effect is turned off. ScreenManager picks which ones
// show; this module only builds them.

// The video's frame, as the part of the texture a mesh shows.
const FRAME_PARTS = {
    whole: null,
    leftHalf: (uv) => [uv[0] * 0.5, uv[1]],
    rightHalf: (uv) => [uv[0] * 0.5 + 0.5, uv[1]],
    topHalf: (uv) => [uv[0], uv[1] * 0.5 + 0.5],
    bottomHalf: (uv) => [uv[0], uv[1] * 0.5],
};

// The shapes, seen from inside for the spheres.
const SHAPES = {
    // 180° in front of the viewer, for side-by-side videos.
    halfSphere: () => new SphereGeometry(120, 60, 40, Math.PI, Math.PI).scale(-1, 1, 1),
    // 270° around the viewer, for top-bottom videos.
    wideSphere: () => new SphereGeometry(120, 60, 40, (Math.PI / 4) * 3, (Math.PI / 2) * 3).scale(-1, 1, 1),
    sphere: () => new SphereGeometry(240, 120, 80, Math.PI / 2).scale(-1, 1, 1),
    plane: () => new PlaneGeometry(120, 120),
};

const FLAT_DISTANCE = -240;
const SPHERE_CENTER = -120;

// name: [shape, frame part, layer, mode, layout, eye]. A plane stands at
// FLAT_DISTANCE and eye height; a sphere's centre is at SPHERE_CENTER.
const SCREENS = {
    meshForScreenMode: ["plane", "whole", 0, "screen", "screen", "both"],
    mesh1802D: ["halfSphere", "whole", 0, "screen", "sphere180", "both"],
    mesh3602D: ["sphere", "whole", 0, "screen", "sphere360", "both"],

    meshLeftSBS: ["halfSphere", "leftHalf", 1, "3d", "sbs", "left"],
    meshRightSBS: ["halfSphere", "rightHalf", 2, "3d", "sbs", "right"],
    mesh2dSBS: ["halfSphere", "leftHalf", 2, "2d", "sbs", "right"],

    meshLeftTB: ["wideSphere", "topHalf", 1, "3d", "tb", "left"],
    meshRightTB: ["wideSphere", "bottomHalf", 2, "3d", "tb", "right"],
    mesh2dTB: ["wideSphere", "topHalf", 2, "2d", "tb", "right"],

    meshLeft360: ["sphere", "topHalf", 1, "3d", "360", "left"],
    meshRight360: ["sphere", "bottomHalf", 2, "3d", "360", "right"],
    mesh2d360: ["sphere", "topHalf", 2, "2d", "360", "right"],

    meshLeftTBScreen: ["plane", "topHalf", 1, "3d", "tb_screen", "left"],
    meshRightTBScreen: ["plane", "bottomHalf", 2, "3d", "tb_screen", "right"],
    mesh2dTBScreen: ["plane", "topHalf", 2, "2d", "tb_screen", "right"],
};

function geometry(shape, part) {
    const built = SHAPES[shape]();
    const map = FRAME_PARTS[part];
    if (map) {
        const uv = built.attributes.uv.array;
        for (let i = 0; i < uv.length; i += 2) {
            [uv[i], uv[i + 1]] = map([uv[i], uv[i + 1]]);
        }
    }
    return built;
}

// Builds every screen, hidden, adds them to the scene and registers them
// with ScreenManager, which moves, zooms and tilts them together.
export function createScreenMeshes(scene, material, eyeHeight) {
    const meshes = {};
    for (const [name, [shape, part, layer, mode, layout, eye]] of Object.entries(SCREENS)) {
        const mesh = new Mesh(geometry(shape, part), material);
        mesh.name = name;
        mesh.layers.set(layer);
        mesh.visible = false;
        if (shape === "plane") {
            mesh.position.set(0, eyeHeight, FLAT_DISTANCE);
        } else {
            mesh.position.setZ(SPHERE_CENTER);
        }
        scene.add(mesh);
        ScreenManager.registerMeshPanel(mesh, mode, layout, eye);
        ScreenManager.registerObjectToDrag(mesh, "player", "meshes");
        meshes[name] = mesh;
    }
    meshes.meshForScreenMode.scale.x = 1.5;

    return {
        meshes,
        // Side by side, the default layout, until the player picks one.
        showDefault() {
            meshes.meshLeftSBS.visible = true;
            meshes.meshRightSBS.visible = true;
        },
        hideAll() {
            Object.values(meshes).forEach((mesh) => {
                mesh.visible = false;
            });
        },
        // Flat videos keep their aspect ratio: the flat screens' widths.
        setScreenAspect(aspect) {
            meshes.meshForScreenMode.scale.x = aspect;
        },
        setTBScreenAspect(aspect) {
            for (const name of ["meshLeftTBScreen", "meshRightTBScreen", "mesh2dTBScreen"]) {
                meshes[name].scale.x = aspect;
            }
        },
    };
}
