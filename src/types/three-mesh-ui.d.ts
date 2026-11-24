// three-mesh-ui's own declarations are a stub that doesn't match what it does,
// so tsconfig.json points the module here instead. Its objects are typed
// loosely on purpose: the library is unmaintained and due to be replaced
// (docs/vendored-dependencies.md), and only src/ui/meshUi.ts imports it.
/* eslint-disable @typescript-eslint/no-explicit-any -- the loose typing is the point of this file */
declare module "three-mesh-ui" {
    import type { Object3D } from "three";

    export type Options = Record<string, any>;

    // A three-mesh-ui object: a three.js object with the library's methods
    // (set, setupState, setState, getWidth...) and whatever the player adds.
    class UiObject extends Object3D {
        constructor(options?: Options);
        [key: string]: any;
    }

    export class Block extends UiObject {}
    export class InlineBlock extends UiObject {}
    export class Text extends UiObject {}
    export class Keyboard extends UiObject {}
    export function update(): void;

    const ThreeMeshUI: {
        Block: typeof Block;
        InlineBlock: typeof InlineBlock;
        Text: typeof Text;
        Keyboard: typeof Keyboard;
        update: typeof update;
        [key: string]: any;
    };
    export default ThreeMeshUI;
}
