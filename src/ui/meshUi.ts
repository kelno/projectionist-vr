// Keep Three-Mesh-UI behind one application-owned boundary. This is the only
// module that should import the dependency directly.
import ThreeMeshUI from "three-mesh-ui";

export { default, Keyboard, Text, update } from "three-mesh-ui";

// Three-Mesh-UI hands a block's border down to every block inside it that
// sets none, so a panel's edge would outline each of its rows and buttons. A
// block from here has no border unless it sets one. (The keyboard builds its
// keys from Three-Mesh-UI's own blocks, so the keyboard sets no border.)
export class Block extends ThreeMeshUI.Block {
    constructor(options = {}) {
        super({ borderWidth: 0, ...options });
    }
}

export class InlineBlock extends ThreeMeshUI.InlineBlock {
    constructor(options = {}) {
        super({ borderWidth: 0, ...options });
    }
}
