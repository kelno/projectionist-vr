// Which videos of a folder the library shows, and in what order: the search
// phrase filters them by name, then the chosen sort orders them. Nothing here
// changes the catalogue's own lists.

export const SORT_OPTIONS = [
    { id: "name-asc", label: "Name, A to Z" },
    { id: "name-desc", label: "Name, Z to A" },
    { id: "date-desc", label: "Newest first" },
    { id: "date-asc", label: "Oldest first" },
];

export const DEFAULT_SORT = "name-asc";

// Names compare as people read them: case aside, and "Part 2" before "Part 10".
const byName = (a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
const byDate = (a, b) => Number(a.epoch) - Number(b.epoch);

const COMPARE = {
    "name-asc": byName,
    "name-desc": (a, b) => byName(b, a),
    "date-asc": byDate,
    "date-desc": (a, b) => byDate(b, a),
};

export function filterFiles(files, phrase) {
    const needle = phrase.trim().toLowerCase();
    if (needle === "") {
        return files.slice();
    }
    return files.filter((file) => file.name.toLowerCase().includes(needle));
}

export function sortFiles(files, sortId) {
    return files.slice().sort(COMPARE[sortId] ?? COMPARE[DEFAULT_SORT]);
}

export function listFiles(files, { phrase = "", sort = DEFAULT_SORT } = {}) {
    return sortFiles(filterFiles(files, phrase), sort);
}
