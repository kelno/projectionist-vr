import {
    Color,
    TextureLoader,
    RingGeometry,
    MeshBasicMaterial,
    DoubleSide,
    Mesh,
    CircleGeometry,
} from "three";
import { Block, Text, InlineBlock } from "../ui/meshUi.js";

import ThumbnailBlock from "./ThumbnailBlock.js";
import { SearchBar } from "./SearchBar.js";
import { buildSortMenu } from "./sortMenu.js";
import { DEFAULT_SORT, listFiles } from "./libraryList.mjs";

import clearUiChildren from "../ui/clearUiChildren.mjs";
import { iconButton, label, panel, row, textButton } from "../ui/kit.js";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

import * as MAIN from "../index.js";

import * as UI from "../UI.js";

import * as Helpers from "../Helpers.js";

import { sanitizeFontText } from "../font.js";

import * as ScreenManager from "../ScreenManager/ScreenManager.js";

// Import Icons
import LeftIcon from "../../assets/icons/left-arrow.png";
import RightIcon from "../../assets/icons/right-arrow.png";
import VideoIcon from "../../assets/icons/video.png";
import PowerIcon from "../../assets/icons/power.png";
import SortIcon from "../../assets/icons/sort.png";

import { adjacentVideo } from "../adjacentVideo.mjs";
import { playerVersion } from "../playerConfig.js";
import {
    GRIP_PLAYER_CONTROLS,
    LIBRARY_CONTROLS,
    PLAYER_CONTROLS,
    makeControlsColumn,
} from "../ui/controlHints.js";

export class FileBrowserPanel {
    fileBrowserContainer;
    foldersContainer;
    folderPageIndex = 0;
    currentFolderPageIndex = 0;
    MAXFOLDERSPERPAGE = 12;
    thumbsContainer;
    draggingBox;

    defaultVideoThumbnail;
    listOfVideoThumbnailTextures = [];

    // The search bar and its keyboard, and the phrase last searched for.
    search;
    keyboard;
    searchPhrase = "";

    sortButton;
    sortMenu;
    sort = DEFAULT_SORT;

    // The window open over the library (the sort menu or the controls
    // help), as { block, targets }, or null.
    openWindow = null;

    buttonLeft;
    buttonRight;

    loadingAnimatedObj;
    loadingAnimatedObjBackground;

    foldersButtons = [];
    thumbTargets = [];
    defaultObjsToTest = [];

    VIDEOS = [];
    FILES = [];
    FOLDER;
    ACTIVEFOLDER;

    FILES_PER_ROW = 4;
    FILES_ROWS = 3;

    CURRENT_PAGE = 0;
    TOTAL_PAGES;

    viewGeneratorThumbs = [];
    viewGeneratorThumbsIterator = 0;
    viewGeneratorPending = 0;
    viewGeneratorFinished = true;
    thumbnailViewGeneration = 0;
    THUMBNAIL_LOAD_CONCURRENCY = 4;

    loader = new TextureLoader();

    PANELMAXWIDTH = 4.5;
    PANELMAXHEIGHT = 3.2;
    CENTERPANELZDISTANCE = -5.2;
    SIDEPANELZDISTANCE = -5;
    KEYBOARDZDISTANCE = -5;

    BUTTONWIDTHHEIGHT = this.PANELMAXHEIGHT / this.FILES_ROWS - 0.5;

    // The grid: FILES_ROWS rows of FILES_PER_ROW cells filling the panel,
    // filled from the top left; each cell holds one tile.
    CELL_WIDTH = this.PANELMAXWIDTH / this.FILES_PER_ROW;
    CELL_HEIGHT = this.PANELMAXHEIGHT / this.FILES_ROWS;
    TILE_MARGIN = 0.03;

    thumbRowContainerAttributes = {
        width: this.PANELMAXWIDTH,
        height: this.CELL_HEIGHT,
        contentDirection: "row",
        justifyContent: "start",
        backgroundOpacity: 0,
    };

    thumbsContainerAttributes = {
        justifyContent: "start",
        contentDirection: "column",
        fontFamily: FontJSON,
        fontTexture: FontImage,
        padding: 0,
        borderRadius: 0,
        backgroundOpacity: 0,
        width: this.PANELMAXWIDTH,
        height: this.PANELMAXHEIGHT,
    };

    bigButtonAttributes = {
        height: this.BUTTONWIDTHHEIGHT,
        width: this.BUTTONWIDTHHEIGHT,
        justifyContent: "center",
        offset: 0.05,
        margin: 0.02,
        backgroundColor: new Color(0x999999),
        backgroundOpacity: 1,
        borderRadius: 0.075,
    };

    bigButtonAttributesTextureAttributes(texture) {
        return {
            height: this.BUTTONWIDTHHEIGHT,
            width: this.BUTTONWIDTHHEIGHT,
            backgroundTexture: texture,
            borderRadius: 0,
        };
    }

    // Options for component.setupState().
    // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

    hoveredStateAttributes = {
        offset: 0.035,
        backgroundColor: new Color(0xffff00),
        backgroundOpacity: 1,
        fontColor: new Color(0x000000),
    };

    hoveredState = {
        state: "hovered",
        attributes: this.hoveredStateAttributes,
    };

    idleStateAttributes = {
        offset: 0.035,
        backgroundColor: new Color(0x4f4f4f),
        backgroundOpacity: 1,
        fontColor: new Color(0xffffff),
    };

    idleState = {
        state: "idle",
        attributes: this.idleStateAttributes,
    };

    folderActiveIdleStateAttributes = {
        offset: 0.035,
        backgroundColor: new Color(0x008e7f),
        backgroundOpacity: 1,
        fontColor: new Color(0xffffff),
    };

    folderActiveIdleState = {
        state: "idle",
        attributes: this.folderActiveIdleStateAttributes,
    };

    selectedAttributes = {
        offset: 0.02,
        backgroundColor: new Color(0x777777),
        backgroundOpacity: 1,
        fontColor: new Color(0x222222),
    };

    foldersContainerAttributes = {
        justifyContent: "start",
        contentDirection: "column",
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontSize: 0.12,
        padding: 0.02,
        borderRadius: 0,
        backgroundOpacity: 1,
        backgroundColor: new Color(0x292929),
        width: this.PANELMAXWIDTH / 3,
        height: this.PANELMAXHEIGHT,
    };

    //////////////////////////////////////////////////////////////////////////////
    // CONSTRUCT
    //////////////////////////////////////////////////////////////////////////////

    constructor(files) {
        // The placeholder thumbnail must have loaded before the library
        // shows: a texture without its image breaks the UI's layout.
        this.defaultVideoThumbnailReady = new Promise((resolve) => {
            this.defaultVideoThumbnail = this.loader.load(
                VideoIcon,
                resolve,
                undefined,
                resolve
            );
        });
        this.rebuildFiles(files);

        const circle = new CircleGeometry(2, 32);
        const loadingAnimatedObjBackgroundMaterial = new MeshBasicMaterial({
            color: 0x000000,
        });
        this.loadingAnimatedObjBackground = new Mesh(
            circle,
            loadingAnimatedObjBackgroundMaterial
        );
        MAIN.scene.add(this.loadingAnimatedObjBackground);
        this.loadingAnimatedObjBackground.position.set(
            0,
            1.4,
            this.CENTERPANELZDISTANCE + 0.18
        );
        this.loadingAnimatedObjBackground.scale.set(0.1, 0.1, 0.1);
        this.loadingAnimatedObjBackground.visible = false;

        const ring = new RingGeometry(
            1,
            1.5,
            32,
            1,
            Math.PI * 0.5,
            Math.PI * 1.5
        );
        const loadingAnimatedObjMaterial = new MeshBasicMaterial({
            color: 0xffff00,
            side: DoubleSide,
        });
        this.loadingAnimatedObj = new Mesh(ring, loadingAnimatedObjMaterial);
        MAIN.scene.add(this.loadingAnimatedObj);
        this.loadingAnimatedObj.position.set(
            0,
            1.4,
            this.CENTERPANELZDISTANCE + 0.2
        );
        this.loadingAnimatedObj.scale.set(0.1, 0.1, 0.1);
        this.loadingAnimatedObj.visible = false;

        // Buttons

        // Left
        this.buttonLeft = new Block(this.bigButtonAttributes);
        this.buttonLeft.tooltip = "Previous page";

        this.loader.load(LeftIcon, (texture) => {
            this.buttonLeft.add(
                new InlineBlock(
                    this.bigButtonAttributesTextureAttributes(texture)
                )
            );
        });

        this.buttonLeft.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.PreviousPage();
            },
        });
        this.buttonLeft.setupState(this.hoveredState);
        this.buttonLeft.setupState(this.idleState);

        // Right
        this.buttonRight = new Block(this.bigButtonAttributes);
        this.buttonRight.tooltip = "Next page";

        this.loader.load(RightIcon, (texture) => {
            this.buttonRight.add(
                new InlineBlock(
                    this.bigButtonAttributesTextureAttributes(texture)
                )
            );
        });

        this.buttonRight.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.NextPage();
            },
        });
        this.buttonRight.setupState(this.hoveredState);
        this.buttonRight.setupState(this.idleState);

        //////////////////////////////////////////////////

        this.fileBrowserContainer = new Block({
            justifyContent: "center",
            contentDirection: "row",
            fontFamily: FontJSON,
            fontTexture: FontImage,
            fontSize: 0.07,
            padding: 0.02,
            borderRadius: 0,
            backgroundOpacity: 1,
            backgroundColor: new Color(0x292929),
            width: this.PANELMAXWIDTH + 0.3 + this.BUTTONWIDTHHEIGHT * 2,
            // The grid's height plus the padding, or the grid overflows it.
            height: this.PANELMAXHEIGHT + 0.04,
        });

        MAIN.scene.add(this.fileBrowserContainer);

        this.thumbsContainer = new Block(this.thumbsContainerAttributes);

        this.foldersContainer = new Block(this.foldersContainerAttributes);
        if (this.VIDEOS.length > 0) {
            this.generateFoldersButtons();
        }
        MAIN.scene.add(this.foldersContainer);
        this.foldersContainer.position.set(-3.8, 1.4, this.SIDEPANELZDISTANCE);
        this.foldersContainer.rotation.y = 0.5;

        //////////////////////////////////////////////////////////////////////
        // Top row: search on the left; sorting and leaving VR on the right.

        this.search = new SearchBar({
            onSearch: (phrase) => {
                this.searchPhrase = phrase;
                this.refreshList();
            },
            onTargetsChange: () => this.registerTargets(),
        });
        // ScreenManager finds panels by these property names.
        this.searchBar = this.search.bar;
        this.keyboard = this.search.keyboard;
        this.searchBar.position.set(-1.77, 3.2, this.CENTERPANELZDISTANCE);
        this.keyboard.position.set(0, 2, this.KEYBOARDZDISTANCE);
        MAIN.scene.add(this.searchBar, this.keyboard);

        this.sortButton = iconButton({
            icon: SortIcon,
            tooltip: "Sort",
            size: 0.26,
            onSelect: () => this.openLibraryWindow(this.sortWindow),
        });
        this.sortButton.position.set(2.5, 3.2, this.CENTERPANELZDISTANCE);

        this.leaveVRButton = iconButton({
            icon: PowerIcon,
            tooltip: "Leave VR",
            size: 0.26,
            onSelect: () => MAIN.leaveVR(),
        });
        this.leaveVRButton.position.set(2.82, 3.2, this.CENTERPANELZDISTANCE);
        MAIN.scene.add(this.sortButton, this.leaveVRButton);

        // The sort menu opens under its button.
        const sortMenu = buildSortMenu({
            onChoose: (sortId) => {
                this.sort = sortId;
                sortMenu.setCurrent(sortId);
                this.closeLibraryWindow();
                this.refreshList();
            },
        });
        sortMenu.setCurrent(this.sort);
        this.sortMenu = sortMenu.block;
        this.sortWindow = sortMenu;
        this.sortMenu.position.set(2.47, 2.52, this.CENTERPANELZDISTANCE + 0.15);
        MAIN.scene.add(this.sortMenu);

        ///////////////////////////
        // Add to main container

        this.fileBrowserContainer.add(this.buttonLeft);

        this.fileBrowserContainer.add(this.thumbsContainer);

        this.fileBrowserContainer.add(this.buttonRight);

        this.fileBrowserContainer.position.set(
            0,
            1.4,
            this.CENTERPANELZDISTANCE
        );

        this.draggingBox = new Block({
            justifyContent: "center",
            contentDirection: "row",
            padding: 0.02,
            borderRadius: 0.12,
            backgroundOpacity: 1,
            backgroundColor: new Color(0x5c5c5c),
            width: this.PANELMAXWIDTH / 2,
            height: 0.2,
        });

        MAIN.scene.add(this.draggingBox);
        this.draggingBox.position.set(0, -0.35, this.CENTERPANELZDISTANCE);
        this.draggingBox.tooltip = "Move the library";
        this.draggingBox.setupState({
            state: "selected",
            onSet: () => {
                ScreenManager.startDrag("files");
            },
        });

        this.draggingBox.setupState({
            state: "hovered",
            attributes: {
                backgroundColor: new Color(0xffff00),
                backgroundOpacity: 1,
            },
            onSet: () => {
                ScreenManager.stopDrag("files");
            },
        });
        this.draggingBox.setupState({
            state: "idle",
            attributes: {
                backgroundColor: new Color(0x5c5c5c),
                backgroundOpacity: 1,
            },
            onSet: () => {
                ScreenManager.stopDrag("files");
            },
        });

        // The controls help, left of the bar, opens over the library.
        this.controlsButton = textButton({
            label: Helpers.getWordFromLang("controls"),
            tooltip: "What the controller buttons do",
            width: 0.7,
            fontSize: 0.08,
            onSelect: () => this.openLibraryWindow(this.controlsWindow),
        });
        this.controlsButton.position.set(-1.75, -0.35, this.CENTERPANELZDISTANCE);
        MAIN.scene.add(this.controlsButton);

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
                row(
                    [
                        label("Left controller: X and Y instead of A and B.", {
                            width: 3.0,
                            height: 0.2,
                            fontSize: 0.06,
                            color: 0xaaaaaa,
                        }),
                        label(`v${playerVersion}`, {
                            width: 0.7,
                            height: 0.2,
                            fontSize: 0.05,
                            align: "right",
                            color: 0x777777,
                        }),
                    ],
                    { width: 3.7, height: 0.2, justify: "space-between" }
                ),
            ],
            { width: 3.9, height: 1.5, padding: 0.08, justify: "space-between" }
        );
        this.controlsHelp.position.set(0, 1.4, this.CENTERPANELZDISTANCE + 0.3);
        this.controlsHelp.scale.setScalar(1.35);
        this.controlsHelp.visible = false;
        MAIN.scene.add(this.controlsHelp);
        this.controlsWindow = { block: this.controlsHelp, targets: [] };

        this.defaultObjsToTest.push(
            this.buttonLeft,
            this.buttonRight,
            this.draggingBox,
            this.controlsButton,
            this.sortButton,
            this.leaveVRButton
        );

        //////////////////////////////////////////////////////////////////////
        // Everything above moves with the library, and goes back in place
        // when it resets.

        for (const name of [
            "draggingBox",
            "searchBar",
            "keyboard",
            "foldersContainer",
            "fileBrowserContainer",
            "sortButton",
            "sortMenu",
            "loadingAnimatedObj",
            "loadingAnimatedObjBackground",
            "controlsButton",
            "leaveVRButton",
            "controlsHelp",
        ]) {
            ScreenManager.registerPanel(this[name], "fileBrowserPanel", name, name);
            ScreenManager.registerObjectToDrag(this[name], "files", "fileBrowserPanel");
        }

        if (this.FILES.length > 0 && this.defaultVideoThumbnail !== undefined) {
            this.generateView();
        }
    }

    // The catalogue entry of a source URL, in any folder, or null.
    fileForSource(source) {
        for (const folder of this.VIDEOS) {
            const file = folder.list.find((entry) => entry.src === source);
            if (file) {
                return file;
            }
        }
        return null;
    }

    adjacentFile(offset) {
        return adjacentVideo(this.FILES, MAIN.video.getAttribute("src"), offset);
    }

    // The current folder's videos, searched and sorted, from the first page.
    refreshList() {
        this.CURRENT_PAGE = 0;
        this.FILES = listFiles(this.VIDEOS[this.FOLDER].list, {
            phrase: this.searchPhrase,
            sort: this.sort,
        });
        this.TOTAL_PAGES =
            Math.ceil(this.FILES.length / (this.FILES_PER_ROW * this.FILES_ROWS)) - 1;
        this.regenerateFileBrowser();
    }

    // A window over the library, such as the sort menu: while it is open,
    // only its buttons count, and a click outside it closes it.
    openLibraryWindow(window) {
        this.closeLibraryWindow();
        if (this.search.isTyping) {
            this.search.stopTyping();
        }
        this.openWindow = window;
        window.block.visible = true;
        UI.setOutsideClick(() => this.closeLibraryWindow());
        this.registerTargets();
    }

    closeLibraryWindow() {
        if (!this.openWindow) {
            return;
        }
        this.openWindow.block.visible = false;
        this.openWindow = null;
        UI.setOutsideClick(null);
        this.registerTargets();
    }

    // Everything clickable in the library when nothing is open over it.
    libraryTargets() {
        return [
            ...this.defaultObjsToTest,
            ...this.search.targets(),
            ...this.foldersButtons,
            ...this.thumbTargets,
        ];
    }

    // Registers what can be clicked now: an open window's buttons, the
    // keyboard while typing, or the whole library.
    registerTargets() {
        if (this.openWindow) {
            UI.registerNewObjectsToTest([
                ...this.openWindow.targets,
                this.openWindow.block,
                MAIN.hiddenSphere,
            ]);
        } else if (this.search.isTyping) {
            UI.registerNewObjectsToTest([...this.search.targets(), this.draggingBox]);
        } else {
            UI.registerNewObjectsToTest(this.libraryTargets());
        }
    }

    generateView() {
        let endOfFiles = false;
        this.thumbnailViewGeneration++;
        this.viewGeneratorThumbs = [];
        this.thumbTargets = [];
        this.listOfVideoThumbnailTextures = [];
        this.viewGeneratorThumbsIterator = 0;
        this.viewGeneratorPending = 0;
        let iterate =
            this.CURRENT_PAGE > 0
                ? this.FILES_PER_ROW * this.FILES_ROWS * this.CURRENT_PAGE
                : 0;
        for (let index = 0; index < this.FILES_ROWS; index++) {
            const thumbsContainerButtonsRow = new Block(
                this.thumbRowContainerAttributes
            );
            let addedThumbs = 0;
            for (let index = 0; index < this.FILES_PER_ROW; index++) {
                if (!this.FILES[iterate]) {
                    endOfFiles = true;
                    break;
                }

                const thumb = new ThumbnailBlock(this.FILES[iterate], {
                    cellWidth: this.CELL_WIDTH,
                    cellHeight: this.CELL_HEIGHT,
                    margin: this.TILE_MARGIN,
                });

                thumbsContainerButtonsRow.add(thumb);
                this.thumbTargets.push(thumb);
                this.viewGeneratorThumbs.push(thumb);
                iterate++;
                addedThumbs++;
            }
            if (addedThumbs > 0) {
                this.thumbsContainer.add(thumbsContainerButtonsRow);
            }
            if (endOfFiles) {
                break;
            }
        }
        this.viewGeneratorFinished = false;
    }

    generateThumbnails() {
        if (this.viewGeneratorFinished) {
            return;
        }

        while (
            this.viewGeneratorPending < this.THUMBNAIL_LOAD_CONCURRENCY &&
            this.viewGeneratorThumbsIterator < this.viewGeneratorThumbs.length
        ) {
            const thumbnailBlock =
                this.viewGeneratorThumbs[this.viewGeneratorThumbsIterator++];
            const thumbnailUrl = thumbnailBlock.thumbnailUrl;
            const viewGeneration = this.thumbnailViewGeneration;
            this.viewGeneratorPending++;

            this.loader
                .loadAsync(thumbnailUrl, undefined)
                .then((image) => {
                    if (viewGeneration !== this.thumbnailViewGeneration) {
                        image.dispose();
                        return;
                    }

                    this.addThumbnailToBlock(thumbnailBlock, image, true);
                })
                .catch(() => {
                    if (viewGeneration !== this.thumbnailViewGeneration) {
                        return;
                    }

                    console.error("Failed to load thumbnail:", thumbnailUrl);
                    this.addThumbnailToBlock(
                        thumbnailBlock,
                        this.defaultVideoThumbnail,
                        false
                    );
                })
                .finally(() => {
                    if (viewGeneration !== this.thumbnailViewGeneration) {
                        return;
                    }

                    this.viewGeneratorPending--;
                    if (
                        this.viewGeneratorThumbsIterator ===
                            this.viewGeneratorThumbs.length &&
                        this.viewGeneratorPending === 0
                    ) {
                        this.viewGeneratorFinished = true;
                    }
                });
        }
    }

    addThumbnailToBlock(thumbnailBlock, texture, shouldDisposeTexture) {
        if (shouldDisposeTexture) {
            this.listOfVideoThumbnailTextures.push(texture);
        }
        thumbnailBlock.setImage(texture);
    }

    regenerateFileBrowser() {
        this.thumbnailViewGeneration++;
        this.viewGeneratorFinished = true;
        clearUiChildren(this.thumbsContainer);
        this.listOfVideoThumbnailTextures.forEach((texture) => {
            texture.dispose();
        });
        this.thumbsContainer.set(this.thumbsContainerAttributes);

        this.generateView();

        this.registerTargets();
    }

    PreviousPage() {
        if (this.CURRENT_PAGE > 0) {
            this.CURRENT_PAGE--;
            this.regenerateFileBrowser();
        }
    }

    NextPage() {
        if (this.CURRENT_PAGE < this.TOTAL_PAGES) {
            this.CURRENT_PAGE++;
            this.regenerateFileBrowser();
        }
    }

    generateFoldersButtons() {
        let folderIndex = this.folderPageIndex;
        // for (let index = 0; index < this.VIDEOS.length; index++) {
        let index = 0;
        while (index < this.MAXFOLDERSPERPAGE) {
            if (folderIndex !== 0 && index === 0) {
                const folderButton = this.createFolderButton(
                    index++,
                    0,
                    true,
                    Helpers.getWordFromLang("previous_page"),
                    "prev"
                );
                this.foldersContainer.add(folderButton);
                this.foldersButtons.push(folderButton);
            }
            const folderButton = this.createFolderButton(
                index++,
                folderIndex++
            );
            this.foldersContainer.add(folderButton);
            this.foldersButtons.push(folderButton);
            if (folderIndex >= this.VIDEOS.length) {
                break;
            }
        }
        if (folderIndex < this.VIDEOS.length) {
            const folderButton = this.createFolderButton(
                index,
                folderIndex,
                true,
                Helpers.getWordFromLang("next_page"),
                "next"
            );
            this.foldersContainer.add(folderButton);
            this.foldersButtons.push(folderButton);
        }
        this.foldersButtonsIdleState();
    }

    createFolderButton(
        id,
        index,
        isPageSwitcher = false,
        pageText = "",
        pageDirection = ""
    ) {
        const folderButton = new Block({
            justifyContent: "center",
            contentDirection: "row",
            height: 0.2,
            offset: 0.05,
            margin: 0.02,
            bestFit: "shrink",
            width: this.PANELMAXWIDTH / 3 - 0.1,
            backgroundOpacity: 1,
        }).add(
            new Text({
                content: sanitizeFontText(
                    isPageSwitcher ? pageText : this.VIDEOS[index].name
                ),
            })
        );
        folderButton.folderId = id;
        folderButton.folderIndex = index;
        if (isPageSwitcher) {
            folderButton.setupState({
                state: "selected",
                attributes: this.selectedAttributes,
                onSet: () => {
                    switch (pageDirection) {
                        case "prev":
                            this.folderPageIndex =
                                this.folderPageIndex - this.MAXFOLDERSPERPAGE;
                            break;

                        default:
                        case "next":
                            this.folderPageIndex =
                                this.folderPageIndex + this.MAXFOLDERSPERPAGE;
                            break;
                    }
                    this.regenerateFoldersButtons();
                },
            });
        } else {
            folderButton.setupState({
                state: "selected",
                attributes: this.selectedAttributes,
                onSet: () => {
                    if (
                        this.ACTIVEFOLDER !== id ||
                        this.currentFolderPageIndex !== this.folderPageIndex
                    ) {
                        this.FOLDER = index;
                        this.ACTIVEFOLDER = id;
                        this.currentFolderPageIndex = this.folderPageIndex;
                        this.foldersButtonsIdleState();
                        this.refreshList();
                    }
                },
            });
        }
        folderButton.setupState(this.hoveredState);
        return folderButton;
    }

    regenerateFoldersButtons() {
        clearUiChildren(this.foldersContainer);
        this.foldersContainer.set(this.foldersContainerAttributes);
        this.foldersButtons = [];
        this.generateFoldersButtons();
        this.registerTargets();
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Hide / Show Menu

    showFileMenuPanel() {
        MAIN.cancelVideoPlaybackRequest();
        UI.showMenu(
            [
                this.fileBrowserContainer,
                this.foldersContainer,
                this.draggingBox,
                this.searchBar,
                this.sortButton,
                this.controlsButton,
                this.leaveVRButton,
            ],
            this.libraryTargets(),
            true
        );
        MAIN.playbackChange(false);
    }

    hideFileMenuPanel(screen_type = null) {
        this.closeLibraryWindow();
        this.search.stopTyping();
        UI.hideMenu(
            [
                this.fileBrowserContainer,
                this.foldersContainer,
                this.draggingBox,
                this.searchBar,
                this.keyboard,
                this.sortButton,
                this.controlsButton,
                this.leaveVRButton,
            ],
            [],
            true
        );
        MAIN.playbackChange(true, screen_type);
    }

    foldersButtonsIdleState() {
        this.foldersButtons.forEach((folder) => {
            const state =
                folder.folderIndex === this.FOLDER
                    ? this.folderActiveIdleState
                    : this.idleState;
            folder.setupState(state);
            folder.set(state.attributes);
        });
    }

    // True until the catalogue has loaded, to show the spinner meanwhile.
    libraryLoading = true;

    loadingAnimation() {
        if (this.viewGeneratorFinished === false || this.libraryLoading) {
            this.loadingAnimatedObj.visible = true;
            this.loadingAnimatedObjBackground.visible = true;
            this.loadingAnimatedObj.rotation.z =
                this.loadingAnimatedObj.rotation.z - 0.2;
        } else {
            this.loadingAnimatedObj.visible = false;
            this.loadingAnimatedObjBackground.visible = false;
        }
    }

    // A new catalogue: back to its first folder, keeping the search and sort.
    rebuildFiles(files) {
        if (!files.videos) {
            return;
        }
        this.VIDEOS = files.videos;
        this.FOLDER = 0;
        this.ACTIVEFOLDER = 0;
        this.folderPageIndex = 0;
        this.currentFolderPageIndex = 0;
        this.CURRENT_PAGE = 0;
        this.FILES = listFiles(this.VIDEOS[0].list, {
            phrase: this.searchPhrase,
            sort: this.sort,
        });
        this.TOTAL_PAGES =
            Math.ceil(this.FILES.length / (this.FILES_PER_ROW * this.FILES_ROWS)) - 1;
    }
}
