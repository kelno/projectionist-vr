import { Block } from "../ui/meshUi.js";

import * as MAIN from "../index.js";

export default class ThumbnailBlock extends Block {
    fileSRC;
    fileNameButton;
    fileThumbnail;
    screen_type;
    constructor(
        options,
        fileSRC,
        fileNameButton,
        fileThumbnail,
        screen_type,
        frame_height,
        frame_width,
        selectedAttributes,
        hoveredStateAttributes,
        idleStateAttributes
    ) {
        super(options);

        this.fileSRC = fileSRC;
        this.fileNameButton = fileNameButton;
        this.fileThumbnail = fileThumbnail;
        this.screen_type = screen_type;
        this.frame_height = frame_height;
        this.frame_width = frame_width;
        this.setupState({
            state: "selected",
            attributes: selectedAttributes,
            onSet: () => {
                MAIN.playCatalogueVideo({
                    src: this.fileSRC,
                    screen_type: this.screen_type,
                    frame_width: this.frame_width,
                    frame_height: this.frame_height,
                });
            },
        });

        this.setupState({
            state: "hovered",
            attributes: hoveredStateAttributes,
        });
        this.setupState({
            state: "idle",
            attributes: idleStateAttributes,
        });
    }
}
