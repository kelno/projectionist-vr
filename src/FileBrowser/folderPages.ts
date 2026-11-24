// The folder list shows `perPage` rows at most. When there are more folders,
// a page's first row goes back a page and its last goes forward, so each
// page holds `perPage - 2` folders and page n starts at n times that.
export type FolderRow = { type: "previous" } | { type: "next" } | { type: "folder"; index: number };

export interface FolderPage {
    rows: FolderRow[];
    pageCount: number;
}

export function folderPage(folderCount: number, page: number, perPage: number): FolderPage {
    if (folderCount <= perPage) {
        return { rows: range(0, folderCount).map(folderRow), pageCount: 1 };
    }
    const size = perPage - 2;
    const pageCount = Math.ceil(folderCount / size);
    const current = Math.min(Math.max(page, 0), pageCount - 1);
    const start = current * size;
    const rows = range(start, Math.min(start + size, folderCount)).map(folderRow);
    if (current > 0) {
        rows.unshift({ type: "previous" });
    }
    if (current < pageCount - 1) {
        rows.push({ type: "next" });
    }
    return { rows, pageCount };
}

function folderRow(index: number): FolderRow {
    return { type: "folder", index };
}

function range(start: number, end: number): number[] {
    return Array.from({ length: Math.max(end - start, 0) }, (_, i) => start + i);
}
