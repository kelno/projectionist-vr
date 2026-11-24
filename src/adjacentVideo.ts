// The video before (offset -1) or after (offset 1) the one playing, in the
// list the library shows: the current folder, searched and sorted. Null at
// either end of the list, or when the playing video isn't in it.
export function adjacentVideo<T extends { src: string }>(
    files: readonly T[],
    currentSource: string | null,
    offset: number,
): T | null {
    const index = files.findIndex((file) => file.src === currentSource);
    if (index === -1) {
        return null;
    }
    return files[index + offset] ?? null;
}
