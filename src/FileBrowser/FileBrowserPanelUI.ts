import { Block } from "../ui/meshUi.ts";
import type { Keyboard, Options } from "../ui/meshUi.ts";
import { TextureLoader } from "three";
import type { Object3D, Texture } from "three";

import ThumbnailBlock from "./ThumbnailBlock.ts";
import { SearchBar } from "./SearchBar.ts";
import { buildSortMenu } from "./sortMenu.ts";
import type { SortMenu } from "./sortMenu.ts";
import { DEFAULT_SORT, listFiles } from "./libraryList.ts";
import type { SortId } from "./libraryList.ts";
import { folderPage } from "./folderPages.ts";
import type { FolderRow } from "./folderPages.ts";
import type { Catalogue, CatalogueEntry, CatalogueFolder, ScreenType } from "../types/catalogue.ts";

import clearUiChildren from "../ui/clearUiChildren.ts";
import {
    FONT,
    dragHandle,
    iconButton,
    label,
    markActive,
    SURFACE,
    panel,
    row,
    textButton,
} from "../ui/kit.ts";
import type { IconButton, Label, TextButton } from "../ui/kit.ts";
import { createSpinner } from "../ui/spinner.ts";
import type { Spinner } from "../ui/spinner.ts";
import { createSystemKeyboard } from "../input/systemKeyboard.ts";
import {
    GRIP_PLAYER_CONTROLS,
    LIBRARY_CONTROLS,
    PLAYER_CONTROLS,
    makeControlsColumn,
} from "../ui/controlHints.ts";

import * as MAIN from "../index.ts";
import * as UI from "../UI.ts";
import * as Helpers from "../Helpers.ts";
import * as ScreenManager from "../ScreenManager/ScreenManager.ts";
import { sanitizeFontText, shortenText } from "../font.ts";
import { adjacentVideo } from "../adjacentVideo.ts";
import { playerVersion } from "../playerConfig.ts";
import { space } from "../ui/theme.ts";

import LeftIcon from "../../assets/icons/left.png";
import RightIcon from "../../assets/icons/right.png";
import VideoIcon from "../../assets/icons/video.png";
import PowerIcon from "../../assets/icons/power.png";
import SortIcon from "../../assets/icons/sort.png";

// A window over the library: its background, and the buttons on it.
interface LibraryWindow {
    block: Block;
    targets: Object3D[];
}

// A folder list button's label and action.
type FolderButtonAction = [text: string, onSelect: () => void];

// The library: the current folder's videos as a grid of thumbnails, a page at
// a time, between previous and next page buttons; the folders listed on the
// left; search, sort and leave VR above; the Controls help and the bar to
// move it all below.
export class FileBrowserPanel {
    GRID_WIDTH = 4.5;
    GRID_HEIGHT = 3.2;
    COLUMNS = 4;
    ROWS = 3;
    TILES_PER_PAGE = this.COLUMNS * this.ROWS;
    CELL_WIDTH = this.GRID_WIDTH / this.COLUMNS;
    CELL_HEIGHT = this.GRID_HEIGHT / this.ROWS;
    TILE_MARGIN = 0.03;
    PAGE_BUTTON_SIZE = 0.32;
    // The rows above and below the library: their height, and their distance
    // from it.
    ROW_HEIGHT = 0.22;
    ROW_GAP = space(5);
    FOLDER_ROWS = 12;
    // The most characters of a folder's name that fit on its button.
    FOLDER_NAME_LENGTH = 24;

    // Distances from the viewer.
    CENTER_Z = -5.2;
    SIDE_Z = -5;
    KEYBOARD_Z = -5;

    THUMBNAIL_LOAD_CONCURRENCY = 4;

    // The catalogue's folders, the one shown, and the folder list's page.
    VIDEOS: CatalogueFolder[] = [];
    FOLDER = 0;
    folderListPage = 0;

    // The shown folder's videos, searched and sorted, and the grid's page.
    FILES: CatalogueEntry[] = [];
    currentPage = 0;

    searchPhrase = "";
    sort: SortId = DEFAULT_SORT;

    // The window open over the library (the sort menu or the controls
    // help), as { block, targets }, or null.
    openWindow: LibraryWindow | null = null;

    // True until the catalogue has loaded, to show the spinner meanwhile.
    libraryLoading = true;

    // What can be clicked, besides the search bar, folders and thumbnails.
    defaultObjsToTest: Block[] = [];
    foldersButtons: TextButton[] = [];
    thumbTargets: ThumbnailBlock[] = [];

    // The thumbnails still to load for the shown page, and those loaded,
    // to free when the page changes.
    pendingTiles: ThumbnailBlock[] = [];
    loadingThumbnails = 0;
    loadedTextures: Texture[] = [];
    pageGeneration = 0;

    loader = new TextureLoader();

    // Resolves once the placeholder thumbnail has loaded or failed to.
    defaultVideoThumbnailReady: Promise<unknown>;
    defaultVideoThumbnail!: Texture;

    // The parts below are made by the build methods the constructor calls.
    buttonLeft!: IconButton;
    buttonRight!: IconButton;
    thumbsContainerAttributes!: Options;
    thumbsContainer!: Block;
    fileBrowserContainer!: Block;
    loadingSpinner!: Spinner;
    foldersContainerAttributes!: Options;
    foldersContainer!: Block;
    search!: SearchBar;
    searchBar!: Block;
    keyboard!: Keyboard;
    sortButton!: IconButton;
    leaveVRButton!: IconButton;
    sortWindow!: SortMenu;
    sortMenu!: Block;
    draggingBox!: Block;
    controlsButton!: TextButton;
    versionLabel!: Label;
    controlsHelp!: Block;
    controlsWindow!: LibraryWindow;

    // `files` is the catalogue, or {} before it has loaded.
    constructor(files: Partial<Catalogue>) {
        // The placeholder thumbnail must have loaded before the library
        // shows: a texture without its image breaks the UI's layout.
        this.defaultVideoThumbnailReady = new Promise((resolve) => {
            this.defaultVideoThumbnail = this.loader.load(VideoIcon, resolve, undefined, resolve);
        });
        this.rebuildFiles(files);

        this.buildGrid();
        this.buildFolderList();
        this.buildTopRow();
        this.buildBottomRow();
        this.buildControlsHelp();

        // Everything moves with the library, and goes back in place when it
        // resets.
        for (const name of [
            "fileBrowserContainer",
            "foldersContainer",
            "searchBar",
            "keyboard",
            "sortButton",
            "sortMenu",
            "leaveVRButton",
            "loadingSpinner",
            "draggingBox",
            "controlsButton",
            "versionLabel",
            "controlsHelp",
        ] as const) {
            ScreenManager.registerPanel(this[name], "fileBrowserPanel");
            ScreenManager.registerObjectToDrag(this[name], "files", "fileBrowserPanel");
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Building

    buildGrid(): void {
        const pageButton = (icon: string, tooltip: string, onSelect: () => void) =>
            iconButton({ icon, tooltip, onSelect, size: this.PAGE_BUTTON_SIZE, round: true });
        this.buttonLeft = pageButton(LeftIcon, "Previous page", () => this.previousPage());
        this.buttonRight = pageButton(RightIcon, "Next page", () => this.nextPage());

        this.thumbsContainerAttributes = {
            width: this.GRID_WIDTH,
            height: this.GRID_HEIGHT,
            contentDirection: "column",
            justifyContent: "start",
            padding: 0,
            borderRadius: 0,
            backgroundOpacity: 0,
            ...FONT,
        };
        this.thumbsContainer = new Block(this.thumbsContainerAttributes);

        this.fileBrowserContainer = new Block({
            width: this.GRID_WIDTH + space(8) + this.PAGE_BUTTON_SIZE * 2,
            // The grid's height plus the padding, or the grid overflows it.
            height: this.GRID_HEIGHT + space(4),
            contentDirection: "row",
            justifyContent: "space-evenly",
            alignItems: "center",
            padding: space(2),
            ...SURFACE,
            ...FONT,
        }).add(this.buttonLeft, this.thumbsContainer, this.buttonRight);
        this.fileBrowserContainer.position.set(0, 1.4, this.CENTER_Z);
        MAIN.scene.add(this.fileBrowserContainer);

        this.loadingSpinner = createSpinner(0.15);
        this.loadingSpinner.position.set(0, 1.4, this.CENTER_Z + 0.2);
        MAIN.scene.add(this.loadingSpinner);

        this.defaultObjsToTest.push(this.buttonLeft, this.buttonRight);
    }

    buildFolderList(): void {
        this.foldersContainerAttributes = {
            width: this.GRID_WIDTH / 3,
            height: this.GRID_HEIGHT,
            contentDirection: "column",
            justifyContent: "start",
            padding: space(2),
            ...SURFACE,
            ...FONT,
        };
        this.foldersContainer = new Block(this.foldersContainerAttributes);
        // The first folder's top level with the library's top.
        const firstButtonTop = this.libraryEdges().top;
        const containerTop = firstButtonTop + space(2) + space(1);
        this.foldersContainer.position.set(-3.8, containerTop - this.GRID_HEIGHT / 2, this.SIDE_Z);
        this.foldersContainer.rotation.y = 0.5;
        MAIN.scene.add(this.foldersContainer);
        this.generateFoldersButtons();
    }

    // The library's edges, which the rows above and below line up with.
    libraryEdges(): { left: number; right: number; top: number; bottom: number } {
        const width = this.fileBrowserContainer.getWidth();
        const height = this.fileBrowserContainer.getHeight();
        const { x, y } = this.fileBrowserContainer.position;
        return { left: x - width / 2, right: x + width / 2, top: y + height / 2, bottom: y - height / 2 };
    }

    // Top row: search on the left; sorting and leaving VR on the right, each
    // row's ends at the library's edges.
    buildTopRow(): void {
        this.search = new SearchBar({
            onSearch: (phrase: string) => {
                this.searchPhrase = phrase;
                this.refreshList();
            },
            onTargetsChange: () => this.registerTargets(),
            systemKeyboard: createSystemKeyboard(() => MAIN.renderer.xr.getSession()),
        });
        // ScreenManager finds panels by these property names.
        this.searchBar = this.search.bar;
        this.keyboard = this.search.keyboard;
        const { left, right, top } = this.libraryEdges();
        const y = top + this.ROW_GAP + this.ROW_HEIGHT / 2;
        this.searchBar.position.set(left + this.searchBar.getWidth() / 2, y, this.CENTER_Z);
        this.keyboard.position.set(0, 2, this.KEYBOARD_Z);

        const size = this.ROW_HEIGHT;
        this.sortButton = iconButton({
            icon: SortIcon,
            tooltip: "Sort",
            size,
            onSelect: () => this.openLibraryWindow(this.sortWindow),
        });
        this.leaveVRButton = iconButton({
            icon: PowerIcon,
            tooltip: "Leave VR",
            size,
            hovered: "danger",
            onSelect: () => MAIN.leaveVR(),
        });
        this.leaveVRButton.position.set(right - size / 2, y, this.CENTER_Z);
        this.sortButton.position.set(right - size * 1.5 - space(3), y, this.CENTER_Z);

        // The sort menu opens under its button, over the library's top right.
        this.sortWindow = buildSortMenu({
            onChoose: (sortId: SortId) => {
                this.sort = sortId;
                this.sortWindow.setCurrent(sortId);
                this.closeLibraryWindow();
                this.refreshList();
            },
        });
        this.sortWindow.setCurrent(this.sort);
        this.sortMenu = this.sortWindow.block;
        const menuWidth = this.sortMenu.getWidth();
        const menuHeight = this.sortMenu.getHeight();
        this.sortMenu.position.set(right - menuWidth / 2, top - menuHeight / 2, this.CENTER_Z + 0.15);

        MAIN.scene.add(this.searchBar, this.keyboard, this.sortButton, this.leaveVRButton, this.sortMenu);
        this.defaultObjsToTest.push(this.sortButton, this.leaveVRButton);
    }

    // Bottom row: the Controls button under the library's left edge, the bar
    // to move the library in the middle, and the player's version, small and
    // muted, under its right edge.
    buildBottomRow(): void {
        const { left, right, bottom } = this.libraryEdges();
        const y = bottom - this.ROW_GAP - this.ROW_HEIGHT / 2;
        this.draggingBox = dragHandle({
            width: this.GRID_WIDTH / 2,
            height: this.ROW_HEIGHT * 0.8,
            tooltip: "Move the library",
            onStart: () => ScreenManager.startDrag("files"),
            onStop: () => ScreenManager.stopDrag("files"),
        });
        this.draggingBox.position.set(this.fileBrowserContainer.position.x, y, this.CENTER_Z);

        const controlsWidth = 0.7;
        this.controlsButton = textButton({
            label: Helpers.getWordFromLang("controls"),
            tooltip: "What the controller buttons do",
            width: controlsWidth,
            height: this.ROW_HEIGHT,
            fontSize: 0.09,
            onSelect: () => this.openLibraryWindow(this.controlsWindow),
        });
        this.controlsButton.position.set(left + controlsWidth / 2, y, this.CENTER_Z);

        const versionWidth = 0.8;
        this.versionLabel = label(`v${playerVersion}`, {
            width: versionWidth,
            height: this.ROW_HEIGHT,
            fontSize: 0.06,
            align: "right",
            color: "mutedText",
        });
        this.versionLabel.position.set(right - versionWidth / 2, y, this.CENTER_Z);

        MAIN.scene.add(this.draggingBox, this.controlsButton, this.versionLabel);
        this.defaultObjsToTest.push(this.draggingBox, this.controlsButton);
    }

    // The controls help, over the library until a click outside it.
    buildControlsHelp(): void {
        this.controlsHelp = panel(
            [
                label(Helpers.getWordFromLang("controls").toUpperCase(), {
                    width: 3.7,
                    height: 0.14,
                    fontSize: 0.1,
                    align: "center",
                }),
                row(
                    [
                        makeControlsColumn("LIBRARY", LIBRARY_CONTROLS, 1.2),
                        makeControlsColumn("PLAYER", PLAYER_CONTROLS, 1.2),
                        makeControlsColumn("HOLD GRIP +", GRIP_PLAYER_CONTROLS, 1.2),
                    ],
                    { width: 3.7, height: 0.95, justify: "space-between" }
                ),
                label("Left controller: X and Y instead of A and B.", {
                    width: 3.7,
                    height: 0.2,
                    fontSize: 0.06,
                    color: "mutedText",
                }),
            ],
            { width: 3.9, height: 1.5, padding: 0.08, justify: "space-between" }
        );
        this.controlsHelp.position.set(0, 1.4, this.CENTER_Z + 0.3);
        this.controlsHelp.scale.setScalar(1.35);
        this.controlsHelp.visible = false;
        MAIN.scene.add(this.controlsHelp);
        this.controlsWindow = { block: this.controlsHelp, targets: [] };
    }

    ////////////////////////////////////////////////////////////////////////////
    // The catalogue and the list shown

    // A catalogue: back to its first folder, keeping the search and sort.
    rebuildFiles(files: Partial<Catalogue>): void {
        if (!files.videos) {
            return;
        }
        this.VIDEOS = files.videos;
        this.FOLDER = 0;
        this.folderListPage = 0;
        this.listFolder();
    }

    // Shows a new catalogue: its folders and its first folder's videos.
    loadCatalogue(files: Catalogue): void {
        this.rebuildFiles(files);
        this.regenerateFoldersButtons();
        this.regenerateFileBrowser();
    }

    // The shown folder's videos, searched and sorted, from the first page.
    listFolder(): void {
        this.currentPage = 0;
        this.FILES = listFiles(this.VIDEOS[this.FOLDER]?.list ?? [], {
            phrase: this.searchPhrase,
            sort: this.sort,
        });
    }

    refreshList(): void {
        this.listFolder();
        this.regenerateFileBrowser();
    }

    get pageCount(): number {
        return Math.max(Math.ceil(this.FILES.length / this.TILES_PER_PAGE), 1);
    }

    previousPage(): void {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.regenerateFileBrowser();
        }
    }

    nextPage(): void {
        if (this.currentPage < this.pageCount - 1) {
            this.currentPage++;
            this.regenerateFileBrowser();
        }
    }

    // The catalogue entry of a source URL, in any folder, or null.
    fileForSource(source: string | null): CatalogueEntry | null {
        for (const folder of this.VIDEOS) {
            const file = folder.list.find((entry) => entry.src === source);
            if (file) {
                return file;
            }
        }
        return null;
    }

    adjacentFile(offset: number): CatalogueEntry | null {
        return adjacentVideo(this.FILES, MAIN.video.getAttribute("src"), offset);
    }

    ////////////////////////////////////////////////////////////////////////////
    // The grid

    // Lays out the current page's tiles; their thumbnails load afterwards,
    // a few at a time, in generateThumbnails().
    regenerateFileBrowser(): void {
        this.pageGeneration++;
        clearUiChildren(this.thumbsContainer);
        this.loadedTextures.forEach((texture) => texture.dispose());
        this.loadedTextures = [];
        this.thumbsContainer.set(this.thumbsContainerAttributes);

        const start = this.currentPage * this.TILES_PER_PAGE;
        const files = this.FILES.slice(start, start + this.TILES_PER_PAGE);
        this.thumbTargets = files.map(
            (file) =>
                new ThumbnailBlock(file, {
                    cellWidth: this.CELL_WIDTH,
                    cellHeight: this.CELL_HEIGHT,
                    margin: this.TILE_MARGIN,
                })
        );
        for (let first = 0; first < this.thumbTargets.length; first += this.COLUMNS) {
            this.thumbsContainer.add(
                new Block({
                    width: this.GRID_WIDTH,
                    height: this.CELL_HEIGHT,
                    contentDirection: "row",
                    justifyContent: "start",
                    backgroundOpacity: 0,
                }).add(...this.thumbTargets.slice(first, first + this.COLUMNS))
            );
        }
        this.pendingTiles = this.thumbTargets.slice();
        this.loadingThumbnails = 0;
        this.registerTargets();
    }

    // Called every frame: starts loading the next thumbnails.
    generateThumbnails(): void {
        while (this.loadingThumbnails < this.THUMBNAIL_LOAD_CONCURRENCY && this.pendingTiles.length > 0) {
            const tile = this.pendingTiles.shift()!;
            const generation = this.pageGeneration;
            this.loadingThumbnails++;
            this.loader
                .loadAsync(tile.thumbnailUrl)
                .then((texture) => {
                    if (generation !== this.pageGeneration) {
                        texture.dispose();
                        return;
                    }
                    this.loadedTextures.push(texture);
                    tile.setImage(texture);
                })
                .catch(() => {
                    if (generation === this.pageGeneration) {
                        console.error("Failed to load thumbnail:", tile.thumbnailUrl);
                        tile.setImage(this.defaultVideoThumbnail);
                    }
                })
                .finally(() => {
                    if (generation === this.pageGeneration) {
                        this.loadingThumbnails--;
                    }
                });
        }
    }

    get thumbnailsLoading(): boolean {
        return this.pendingTiles.length > 0 || this.loadingThumbnails > 0;
    }

    // Called every frame: the spinner turns while the catalogue or the
    // page's thumbnails load.
    loadingAnimation(): void {
        this.loadingSpinner.visible = this.libraryLoading || this.thumbnailsLoading;
        if (this.loadingSpinner.visible) {
            this.loadingSpinner.spin();
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // The folder list

    generateFoldersButtons(): void {
        const { rows } = folderPage(this.VIDEOS.length, this.folderListPage, this.FOLDER_ROWS);
        this.foldersButtons = rows.map((entry) => this.folderListButton(entry));
        if (this.foldersButtons.length > 0) {
            this.foldersContainer.add(...this.foldersButtons);
        }
        this.foldersButtonsIdleState();
    }

    folderListButton(entry: FolderRow): TextButton {
        const turnPage = (offset: number) => () => {
            this.folderListPage += offset;
            this.regenerateFoldersButtons();
        };
        const [text, onSelect] = {
            previous: (): FolderButtonAction => [Helpers.getWordFromLang("previous_page"), turnPage(-1)],
            next: (): FolderButtonAction => [Helpers.getWordFromLang("next_page"), turnPage(1)],
            folder: (): FolderButtonAction => {
                // Only a folder's row is looked up here.
                if (entry.type !== "folder") {
                    throw new Error(`Not a folder row: ${entry.type}`);
                }
                return [this.VIDEOS[entry.index].name, () => this.showFolder(entry.index)];
            },
        }[entry.type]();
        // One line per folder: a longer name is cut, and shows whole as the
        // tooltip.
        const shown = shortenText(text, this.FOLDER_NAME_LENGTH);
        const button = textButton({
            label: shown,
            tooltip: shown === sanitizeFontText(text) ? undefined : sanitizeFontText(text),
            width: this.GRID_WIDTH / 3 - 0.1,
            height: 0.2,
            fontSize: 0.1,
            onSelect,
        });
        button.folderIndex = entry.type === "folder" ? entry.index : null;
        return button;
    }

    showFolder(index: number): void {
        if (index === this.FOLDER) {
            return;
        }
        this.FOLDER = index;
        this.foldersButtonsIdleState();
        this.refreshList();
    }

    // The shown folder's button is marked.
    foldersButtonsIdleState(): void {
        for (const button of this.foldersButtons) {
            markActive(button, button.folderIndex === this.FOLDER);
        }
    }

    regenerateFoldersButtons(): void {
        clearUiChildren(this.foldersContainer);
        this.foldersContainer.set(this.foldersContainerAttributes);
        const { pageCount } = folderPage(this.VIDEOS.length, 0, this.FOLDER_ROWS);
        this.folderListPage = Math.max(0, Math.min(this.folderListPage, pageCount - 1));
        this.generateFoldersButtons();
        this.registerTargets();
    }

    ////////////////////////////////////////////////////////////////////////////
    // What can be clicked, and windows over the library

    // A window over the library, such as the sort menu: while it is open,
    // only its buttons count, and a click outside it closes it.
    openLibraryWindow(window: LibraryWindow): void {
        this.closeLibraryWindow();
        if (this.search.isTyping) {
            this.search.stopTyping();
        }
        this.openWindow = window;
        window.block.visible = true;
        UI.setOutsideClick(() => this.closeLibraryWindow());
        this.registerTargets();
    }

    closeLibraryWindow(): void {
        if (!this.openWindow) {
            return;
        }
        this.openWindow.block.visible = false;
        this.openWindow = null;
        UI.setOutsideClick(null);
        this.registerTargets();
    }

    // Everything clickable in the library when nothing is open over it.
    libraryTargets(): Object3D[] {
        return [
            ...this.defaultObjsToTest,
            ...this.search.targets(),
            ...this.foldersButtons,
            ...this.thumbTargets,
        ];
    }

    // Registers what can be clicked now: an open window's buttons, the
    // keyboard while typing, or the whole library.
    registerTargets(): void {
        if (this.openWindow) {
            UI.registerNewObjectsToTest([...this.openWindow.targets, this.openWindow.block, MAIN.hiddenSphere]);
        } else if (this.search.isTyping) {
            UI.registerNewObjectsToTest([...this.search.targets(), this.draggingBox]);
        } else {
            UI.registerNewObjectsToTest(this.libraryTargets());
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Showing and hiding

    get panels(): Block[] {
        return [
            this.fileBrowserContainer,
            this.foldersContainer,
            this.draggingBox,
            this.searchBar,
            this.sortButton,
            this.controlsButton,
            this.leaveVRButton,
        ];
    }

    showFileMenuPanel(): void {
        MAIN.cancelVideoPlaybackRequest();
        UI.showMenu(this.panels, this.libraryTargets(), true);
        MAIN.playbackChange(false);
    }

    hideFileMenuPanel(screen_type: ScreenType | null = null): void {
        this.closeLibraryWindow();
        this.search.stopTyping();
        UI.hideMenu([...this.panels, this.keyboard], [], true);
        MAIN.playbackChange(true, screen_type);
    }
}
