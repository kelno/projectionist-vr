// What clearUiChildren() needs of a container: a three.js object fits, and so
// does the tests' stand-in.
interface Container<Child> {
    children: Child[];
    remove(child: Child): unknown;
}

/**
 * Dispose and remove each direct Three-Mesh-UI child from a container.
 *
 * Three-Mesh-UI's public `clear()` method traverses the child subtree and
 * releases its UI update state, geometry, and materials. Copy the children
 * first because `remove()` changes the live Object3D children collection.
 */
export default function clearUiChildren<Child extends { clear(): unknown }>(container: Container<Child>): void {
    const children = [...container.children];

    for (const child of children) {
        if (typeof child.clear !== "function") {
            throw new TypeError("Expected a Three-Mesh-UI child with a clear() method.");
        }

        child.clear();
        container.remove(child);
    }
}
