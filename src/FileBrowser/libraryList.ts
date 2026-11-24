// Which videos of a folder the library shows, and in what order: the search
// phrase filters them by name, then the chosen sort orders them. Nothing here
// changes the catalogue's own lists.

import type { CatalogueEntry } from "../types/catalogue.ts";

export type SortId = "name-asc" | "name-desc" | "date-desc" | "date-asc";

// What the search and sort read of a catalogue entry.
type ListedFile = Pick<CatalogueEntry, "name" | "epoch">;
type Compare = (a: ListedFile, b: ListedFile) => number;

export const SORT_OPTIONS: { id: SortId; label: string }[] = [
    { id: "name-asc", label: "Name, A to Z" },
    { id: "name-desc", label: "Name, Z to A" },
    { id: "date-desc", label: "Newest first" },
    { id: "date-asc", label: "Oldest first" },
];

export const DEFAULT_SORT: SortId = "name-asc";

// Names compare as people read them: case aside, and "Part 2" before "Part 10".
const byName: Compare = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
const byDate: Compare = (a, b) => Number(a.epoch) - Number(b.epoch);

// Indexed by any string, since an unknown sort falls back to the default.
const COMPARE: { [sortId: string]: Compare | undefined } = {
    "name-asc": byName,
    "name-desc": (a, b) => byName(b, a),
    "date-asc": byDate,
    "date-desc": (a, b) => byDate(b, a),
};

export function filterFiles<T extends ListedFile>(files: T[], phrase: string): T[] {
    const needle = phrase.trim().toLowerCase();
    if (needle === "") {
        return files.slice();
    }
    return files.filter((file) => file.name.toLowerCase().includes(needle));
}

export function sortFiles<T extends ListedFile>(files: T[], sortId: string): T[] {
    return files.slice().sort(COMPARE[sortId] ?? COMPARE[DEFAULT_SORT]);
}

export function listFiles<T extends ListedFile>(
    files: T[],
    { phrase = "", sort = DEFAULT_SORT }: { phrase?: string; sort?: string } = {},
): T[] {
    return sortFiles(filterFiles(files, phrase), sort);
}
