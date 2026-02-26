import { $el } from "/scripts/ui.js";

import * as pngInfo from "/scripts/pnginfo.js";

import { getElementUnderPointer } from "../../common/EventManager.js";

import { setting_bKeyListAllowDenyToggle, setting_bMetadataTooltipToggle, setting_KeyList, createFlyoutHandle } from "../../common/SettingsManager.js";

import ExifReader from '../../common/ExifReader-main/src/exif-reader.js';

import { utilitiesInstance } from "../../common/Utilities.js";
import { isPointerDown } from "../../common/EventManager.js";

import { setting_FontSize, setting_FontFamily } from "../../TextareaFontControl.js"

import { getVideoMetadata, isVideoFile } from "../../nodes/MediaMetadata.js";
import { findFirstImageDrawerInstanceWithGivenContext } from "../Core/ImageDrawerModule.js";

const toolTipOffsetX = 10; // Adjust the offset from the mouse pointer
const toolTipOffsetY = 10;

const bUseWideTooltip = true;

let toolTip;
export let toolButtonContainer;

let currentMousedOverImageElement = null;

export function createToolTip(imageElement) {

    const zIndex = imageElement ? utilitiesInstance.getMaxZIndex(imageElement) : 1001;
    const fontSize = setting_FontSize.value;

    toolTip = $el("div", {
        style: {
            position: "fixed",
            fontSize: fontSize.toString() + '%',
            fontFamily: setting_FontFamily.value,
            lineHeight: "20px",
            padding: "5px",
            background: "#444",
            border: "1px solid #222",
            visibility: "hidden",
            opacity: "0",
            boxShadow: "-2px 2px 5px rgba(0, 0, 0, 0.2)",
            transition: "opacity 0.3s, visibility 0s",
            color: "white",
            maxWidth: bUseWideTooltip ? "40vw" : "20vw",
            pointerEvents: 'none',
            zIndex: zIndex > 0 ? zIndex + 1 : 1002,
        }
    });
    toolTip.classList.add('tooltip');

    const x = imageElement && imageElement.hasAttribute('tip-left') ? 'calc(-100% - 5px)' : '16px';
    const y = imageElement && imageElement.hasAttribute('tip-top') ? '-100%' : '0';
    toolTip.style.transform = `translate(${x}, ${y})`;

    document.body.appendChild(toolTip);

    return toolTip;
}

function updateTooltip(newTooltipWidget, imageElement) {
    if (!newTooltipWidget) { return false; }

    if (!toolTip) {
        createToolTip(imageElement);
    }

    toolTip.replaceChildren(newTooltipWidget);

    return true;
}

export function updateAndShowTooltip(newTooltipWidget, imageElement) {
    if (setting_bMetadataTooltipToggle.value) {
        const bTooltipUpdated = updateTooltip(newTooltipWidget, imageElement);
        if (bTooltipUpdated && toolTip) {
            toolTip.style.visibility = "visible";
            toolTip.style.opacity = "1";
        }
    }
}

export function hideToolTip() {
    if (toolTip) {
        toolTip.style.visibility = "hidden";
        toolTip.style.opacity = "0";
    }
}

export function imageElementMouseOverEvent(event, imageElement) {
    if (!event) { return; }

    // If mouseOver was called without the previous imageElement having mouseOut called on it, manually call it
    if (currentMousedOverImageElement && currentMousedOverImageElement != imageElement) {

        imageElementMouseLeaveEvent(event, currentMousedOverImageElement);
    }

    // Only show tooltip if a mouse button is not being held
    if (!isPointerDown() && !toolButtonContainer?.contains(event.target)) {

        currentMousedOverImageElement = imageElement;
        addCheckboxSelectorToImageElement(imageElement);
        addToolButtonToImageElement(imageElement);
        updateAndShowTooltip(imageElement.tooltipWidget, imageElement);
        imageElement.img.style.pointerEvents = "auto";
    }
}

export function imageElementMouseLeaveEvent(event, imageElement) {
    if (!event) { return; }

    hideToolTip();

    removeAndHideToolButtonFromImageElement(imageElement);
    hideImageElementCheckboxSelector(imageElement);
    currentMousedOverImageElement = null;
    imageElement.img.style.pointerEvents = "none";
}

export function getOrCreateToolButton(imageElementToUse) {

    function createButtons(flyout) {
        if (!flyout) { return; }

        function createButton(foregroundElement, tooltipText, onClickFunction, dragText) {
            const buttonElement = $el("button", {
                title: tooltipText,
                style: {
                    background: "none",
                    border: "none",
                    padding: 0,
                    width: "100%",
                    display: "block",
                    cursor: "pointer",
                }
            }, [
                $el("div", {
                        style: {
                            width: "max-content"
                        }
                    }, [
                        foregroundElement
                    ]
                )
            ]);

            foregroundElement.style.pointerEvents = "none";
            buttonElement.style.pointerEvents = "all";

            if (onClickFunction) {
                buttonElement.addEventListener('click', onClickFunction);
            }

            if (dragText) {
                buttonElement.draggable = true;
                buttonElement.addEventListener("dragstart", function (event) {
                    // Set data to be transferred during drag
                    event.dataTransfer.setData('text/plain', dragText);
                });
            }

            buttonElement.classList.add("JNodes-interactive-container"); // Creates highlighting and mouse down color changes for feedback

            return $el("tr", [
                $el("td", [
                    buttonElement
                ])
            ]);
        }

        function createOptionsMenu() {

            if (!imageElementToUse) {
                return;
            }

            // Filename / ID
            {
                let toolTipText = `${imageElementToUse.subdirectory ? imageElementToUse.subdirectory + "/" : ""}${imageElementToUse.filename}`;

                if (imageElementToUse.displayData) {
                    toolTipText += `\n${utilitiesInstance.stringifyDisplayData(imageElementToUse.displayData)}`;
                }

                flyout.menu.appendChild($el("label", {
                    textContent: `📝 ${imageElementToUse.filename}`,
                    title: toolTipText,
                }));
            }

            // Delete button
            {
                const baseLabelText = "♻️ Delete From Disk";
                const confirmLabelText = "♻️ Confirm?";
                flyout.menu.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
                            style: {
                                color: "rgb(250,25,25)",
                            }
                        }),
                        "Delete this item from disk. If send2trash is available, it will be sent to the OS's Recycle Bin or Trash. Otherwise it will be deleted directly.",
                        function (e) {
                            const labelElement = e.target.querySelector("label");
                            if (labelElement.textContent == baseLabelText) {
                                labelElement.textContent = confirmLabelText;
                            } else if (labelElement.textContent == confirmLabelText) {

                                const imageDrawerContextSelectorInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
                                const currentContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();
                                if (currentContextObject) {
                                    currentContextObject.onRequestSingleDeletion(imageElementToUse);
                                }
                            }
                        }
                    )
                );
            }

            // Remove button
            {
                const baseLabelText = "❌ Remove From List";
                const confirmLabelText = "❌ Confirm?";
                flyout.menu.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
                            style: {
                                color: "rgb(200, 150, 15)",
                            }
                        }),
                        "Remove this item from the current list. The item will not be deleted from disk. Upon reloading this context's list, the item may reappear.",
                        function (e) {
                            const labelElement = e.target.querySelector("label");
                            if (labelElement.textContent == baseLabelText) {
                                labelElement.textContent = confirmLabelText;
                            } else if (labelElement.textContent == confirmLabelText) {

                                const imageDrawerContextSelectorInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
                                const currentContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();
                                if (currentContextObject) {
                                    currentContextObject.onRequestSingleRemoval(imageElementToUse);
                                }
                            }
                        }
                    )
                );
            }

            // Favourite button
            {
                const baseLabelText = "⭐ Copy to Favourites";
                const confirmLabelText = "⭐ Confirm?";
                flyout.menu.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
                            style: {
                                color: 'rgb(250,250,250)',
                            }
                        }),
                        "Copy this item to the favourites folder defined in Settings > JNodes Settings.",
                        function (e) {
                            const labelElement = e.target.querySelector("label");
                            if (labelElement.textContent == baseLabelText) {
                                labelElement.textContent = confirmLabelText;
                            } else if (labelElement.textContent == confirmLabelText) {

                                const imageDrawerContextSelectorInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
                                const currentContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();
                                if (currentContextObject) {
                                    currentContextObject.onRequestSingleFavourite(imageElementToUse);
                                }

                                labelElement.textContent = baseLabelText;
                            }
                        }
                    )
                );
            }

            // Open in file manager
            {
                const baseLabelText = "📂 Show in File Manager";
                flyout.menu.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
                            style: {
                                color: 'rgb(250,250,250)',
                            }
                        }),
                        "Open this file's containing directory in your OS's default file manager.",
                        function (e) {
                            const imageDrawerContextSelectorInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
                            const currentContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();
                            if (currentContextObject) {
                                currentContextObject.onRequestShowInFileManager(imageElementToUse);
                            }
                        }
                    )
                );
            }

            // ✉️ Send to metadata viewer
            {
                const baseLabelText = "✉️ Send to Metadata Viewer";
                flyout.menu.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
                            style: {
                                color: 'rgb(240,240,255)',
                            }
                        }),
                        "Send this to any drawer instance with the 'Metadata Viewer' context currently selected. If it's in a sidebar, you may have to switch manually. " +
                        "If no drawer instance is using the 'Metadata Viewer' context, the current instance will change to it. " +
                        "Note that not all items will have metadata to show, so when switching it may seem that nothing has happened.",
                        async function (e) {

                            const metaDataContextName = "Metadata Viewer";
                            let metadataViewerInstance = findFirstImageDrawerInstanceWithGivenContext(metaDataContextName);
                            
                            if (!metadataViewerInstance) { // Need to switch to it

                                const imageDrawerContextSelectorInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
                                imageDrawerContextSelectorInstance.setOptionSelected(metaDataContextName);
                                metadataViewerInstance = imageElementToUse.imageDrawerInstance;
                            }

                            if (metadataViewerInstance) {

                                const imageDrawerContextSelectorInstance = metadataViewerInstance.getComponentByName("ImageDrawerContextSelector");
                                const metadataViewerContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();

                                const response = await fetch(imageElementToUse.fileInfo.imageHref);
                                let blob = await response.blob();

                                if (blob.type === "application/octet-stream" && imageElementToUse.filename && imageElementToUse.fileInfo.file?.format) {
                                    blob = new Blob([blob], { name: imageElementToUse.filename, type: imageElementToUse.fileInfo.file.format });
                                }

                                metadataViewerContextObject.setImageOrVideo(blob, true);
                            }
                        }
                    )
                );
            }

            if (imageElementToUse?.promptMetadata && Object.keys(imageElementToUse.promptMetadata).length > 0) {

                let positivePrompt = getPositivePromptInMetadata(imageElementToUse.promptMetadata);
                if (positivePrompt) {
                    flyout.menu.appendChild(
                        createButton(
                            $el("label", {
                                textContent: "📋 Copy Positive Prompt",
                                style: {
                                    color: 'rgb(250,250,250)',
                                }
                            }),
                            'Copy positive prompt',
                            function (e) {
                                if (positivePrompt.startsWith('"')) { positivePrompt = positivePrompt.slice(1); }
                                if (positivePrompt.endsWith('"')) { positivePrompt = positivePrompt.slice(0, positivePrompt.length - 1); }
                                positivePrompt = utilitiesInstance.unescapeString(positivePrompt);
                                utilitiesInstance.copyToClipboard(positivePrompt);
                                // removeOptionsMenu();
                                e.preventDefault();
                            }
                        )
                    );
                }

                let metadataKeys = Object.keys(imageElementToUse.promptMetadata);
                metadataKeys.sort();
                for (const key of metadataKeys) {
                    if (isPositivePromptKey(key)) {
                        continue;
                    }

                    let data = imageElementToUse.promptMetadata[key];

                    flyout.menu.appendChild(
                        createButton(
                            $el("label", {
                                textContent: `📋 Copy ${key}`,
                                style: {
                                    color: 'rgb(250,250,250)',
                                }
                            }),
                            `Copy ${key}`,
                            function (e) {
                                if (!data) { return; }
                                if (data.startsWith('"')) { data = data.slice(1); }
                                if (data.endsWith('"')) { data = data.slice(0, data.length - 1); }

                                // Unescape characters in prompts unless key is workflow or prompt server prompt
                                const bIsWorkflowOrServerPrompt = key == "workflow" || key == "prompt";
                                if (!bIsWorkflowOrServerPrompt) {
                                    data = utilitiesInstance.unescapeString(data);
                                }
                                utilitiesInstance.copyToClipboard(data, !bIsWorkflowOrServerPrompt);
                                // removeOptionsMenu();
                                e.preventDefault();
                            }
                        )
                    );
                }
            }
        }

        createOptionsMenu();
    }

    const handleClassSuffix = 'imageElement-flyout-handle';
    const handleText = "⋮";

    if (!toolButtonContainer) {
        toolButtonContainer = utilitiesInstance.createDarkContainer("imageToolsButton", "0%");
        toolButtonContainer.style.top = '2%';
        toolButtonContainer.style.right = '2%';

        // Placeholder handle
        let handle = $el(`section.flyout-handle.${handleClassSuffix}`, [
            $el("label.flyout-handle-label", { textContent: handleText })
        ]);
        toolButtonContainer.appendChild(handle);
    }    

    const onPointerEnter = () => {
        const menuClassSuffix = 'imageElement-flyout-menu';
        const imageDrawerListInstance = imageElementToUse.imageDrawerInstance.getComponentByName("ImageDrawerList");
        const parentElement = imageDrawerListInstance.getImageListElement();
        const flyout = createFlyoutHandle(handleText, handleClassSuffix, menuClassSuffix, parentElement);

        toolButtonContainer.replaceChildren(flyout.handle);

        createButtons(flyout);

        toolButtonContainer.flyout = flyout;
        toolButtonContainer.flyout.handle.determineTransformLayout();
    };

    // onPointerEnter();

    // toolButtonContainer.addEventListener("pointerenter", () => {
        requestAnimationFrame(onPointerEnter);
    // }, {once: true});

    return toolButtonContainer;
}

export function addToolButtonToImageElement(imageElementToUse) {

    if (!imageElementToUse) {
        return;
    }

    const toolButton = getOrCreateToolButton(imageElementToUse);

    imageElementToUse.appendChild(toolButton);
    toolButton.style.visibility = "visible";
}

export function removeAndHideToolButtonFromImageElement(imageElementToUse) {
    if (toolButtonContainer?.parentElement == imageElementToUse) {
        document.body.appendChild(toolButtonContainer);
        toolButtonContainer.style.visibility = "hidden";
    }
}

export function addCheckboxSelectorToImageElement(imageElementToUse) {

    if (!imageElementToUse) {
        return;
    }

    if (!imageElementToUse.checkboxSelector) {

        imageElementToUse.bIsCheckboxSelectorChecked = false;

        imageElementToUse.checkboxSelector = $el("input", {
            type: "checkbox",
            checked: false,
            oninput: (e) => {
                imageElementToUse.setSelected(e.target.checked);
            },
            style: {
                position: 'absolute',
                top: '2%',
                left: '2%',
            }
        });

        imageElementToUse.appendChild(imageElementToUse.checkboxSelector);

        imageElementToUse.setSelected = function (bNewCheckedState, bUpdateBatchSelectionWidget) {
            imageElementToUse.bIsCheckboxSelectorChecked = bNewCheckedState;
            if (imageElementToUse.checkboxSelector) {
                imageElementToUse.checkboxSelector.checked = bNewCheckedState;
            }
            imageElementToUse.onSelectionChanged(bUpdateBatchSelectionWidget);
        };

        imageElementToUse.onSelectionChanged = async function (bUpdateBatchSelectionWidget = true) {

            if (imageElementToUse && imageElementToUse.img) {
                imageElementToUse.img.style.transform = imageElementToUse.bIsCheckboxSelectorChecked ? "scale(0.85)" : "";
                imageElementToUse.style.backgroundImage = imageElementToUse.bIsCheckboxSelectorChecked ?
                    "linear-gradient(to bottom right, red, steelblue)" : "linear-gradient(to bottom right, rgba(0,0,0,0), rgba(0,0,0,0))";
            }

            if (bUpdateBatchSelectionWidget) {
                const batchSelectionManagerInstance = imageElementToUse.imageDrawerInstance.getComponentByName("BatchSelectionManager");
                batchSelectionManagerInstance.updateWidget();
            }
        }
    }

    imageElementToUse.checkboxSelector.style.visibility = "visible";
}

export function hideImageElementCheckboxSelector(imageElementToUse) {

    if (!imageElementToUse || !imageElementToUse.checkboxSelector) {
        return;
    }

    imageElementToUse.checkboxSelector.style.visibility = "hidden";
}

export async function getNonPngImageMetadata(file) {

    let metadata = null;
    let jsonString = null;

    if (file) {

        const webpArrayBuffer = await file.arrayBuffer();

        // Use the exif library to extract Exif data
        const exifData = ExifReader.load(webpArrayBuffer);
        //console.log("exif: " + JSON.stringify(exifData));

        const exif = exifData['UserComment'];

        if (exif) {

            // Convert the byte array to a Uint16Array
            const uint16Array = new Uint16Array(exif.value);

            // Create a TextDecoder for UTF-16 little-endian
            const textDecoder = new TextDecoder('utf-16le');

            // Decode the Uint16Array to a string
            const decodedString = textDecoder.decode(uint16Array);

            // Remove null characters
            const cleanedString = decodedString.replace(/\u0000/g, '');
            jsonString = cleanedString.replace("UNICODE", "")

            try {

                metadata = JSON.parse(jsonString);

            } catch (error) {

                console.error(`${error} (${file.name})`);
            }
        }
    } else {
        console.error("getNonPngImageMetadata: file not valid!");
    }

    return { metadata: metadata, jsonString: jsonString};
}

export async function getMetaData(file, format) {

    let metadata = null;

    function appendA111Metadata(metadata) {

        if (metadata && "parameters" in metadata) {

            const a111Metadata = makeMetaDataFromA111(metadata.parameters);
            metadata = { ...metadata, ...a111Metadata }; // Append a111 meta
        }

        return metadata;
    }
    
    try {
        if (format === "image/png") {
            metadata = await pngInfo.getPngMetadata(file);
            metadata = appendA111Metadata(metadata);
        } else if (isVideoFile(file)) {
            metadata = await getVideoMetadata(file);
            if (!metadata) {
                const iso = await window.comfyAPI.isobmff.getFromIsobmffFile(file);
                if (Object.entries(iso).length > 0) {
                    metadata = iso;
                }
            }
            metadata = appendA111Metadata(metadata);
        } else if (format === "image/webp" || format === "image/jpeg" || format === "image/gif") {

            const metadataStruct = await getNonPngImageMetadata(file);
            metadata = metadataStruct.metadata;
            metadata = appendA111Metadata(metadata);
            
            if (!metadata) {

                // see if it's an a111 prompt at its base
                const a111Metadata = makeMetaDataFromA111(metadataStruct.jsonString);
                if (a111Metadata) {
                    metadata = a111Metadata;
                }
            }
        }

    } catch (error) {
        if (error.name != "MetadataMissingError") {
            console.log(`${error} (${file.name})`);
        }
    }

    return metadata;
}

export async function onLoadImageElement(imageElement) {
    if (imageElement.img.complete || imageElement.bIsVideoFormat) {
        if (imageElement.bComplete) {
            //console.log('Image has been completely loaded.');
            return;
        }

        const response = await fetch(imageElement.fileInfo.imageHref);
        const blob = await response.blob();

        // Hover mouse over image to show meta
        //console.log(imageElement.fileInfo.imageHref);
        

        if (!imageElement.displayData.FileSize || imageElement.displayData.FileSize < 1) {
            imageElement.displayData.FileSize = blob.size;
        }

        getMetaData(blob, imageElement.fileInfo.file.format).then(
            (metadata) => {
                imageElement.metadata = metadata;

                setMetadataAndUpdateTooltipAndSearchTerms(imageElement, metadata);

                imageElement.bComplete = true;
            }
        );


    }
    else {
        console.log('Image is still loading.');
    }
}

function getPromptKeys(type) {
    return [
        `${type}Prompt`, `${type} Prompt`, `${type}_Prompt`, 
        `${type}prompt`, `${type} prompt`, `${type}_prompt`, 
        `${type.toLowerCase()}Prompt`, `${type.toLowerCase()}prompt`, 
        `${type.toLowerCase()} prompt`, `${type.toLowerCase()}_prompt`
    ];
}

function getPromptInMetadata(metadata, type) {

    const keys = getPromptKeys(type);

    if (metadata) {
        for (const key of keys) {
            if (key in metadata) {
                return metadata[key];
            }
        }
    }

    return null;
}

export function isPositivePromptKey(key) {
    const keys = getPromptKeys("Positive");

    return keys.includes(key);
}

export function isNegativePromptKey(key) {
    const keys = getPromptKeys("Negative");

    return keys.includes(key);
}

export function getPositivePromptInMetadata(metadata) {
    return getPromptInMetadata(metadata, "Positive");
}

export function getNegativePromptInMetadata(metadata) {
    return getPromptInMetadata(metadata, "Negative");
}

export function makeMetaDataFromA111(inString) {

    const positivePromptKey = "Positive prompt";
    const negativePromptKey = "Negative prompt";

    let metadata = null;

    if (!inString) {

        return metadata;
    }

    if (inString.startsWith("\"")) {
        inString = inString.substring(1);  // Remove the leading quote
    }

    if (inString.endsWith("\"")) {
        inString = inString.substring(0, inString.length - 1);  // Remove the trailing quote
    }

    const p = inString.lastIndexOf("Steps:");
    if (p > -1) {
        let substring = inString.substring(p);
        let match = substring.match(new RegExp("\\s*([^:]+:\\s*([^\"\\{].*?|\".*?\"|\\{.*?\\}))\\s*(,|$)", "g"))
        metadata = match.reduce((p, n) => {
            const s = n.split(":");
            if (s[1].endsWith(',')) {
                s[1] = s[1].substring(0, s[1].length - 1);
            }
            p[s[0].trim()] = s[1].trim();
            return p;
        }, {});
        const p2 = inString.lastIndexOf(`${negativePromptKey}:`, p);
        if (p2 > -1) {

            metadata[positivePromptKey] = inString.substring(0, p2).trim().replace("\n", '').replace("\\n", ''); // Trim whitespace and newlines
            metadata[negativePromptKey] = inString.substring(p2 + negativePromptKey.length + 1, p).trim().replace("\n", '').replace("\\n", '');
        }

        metadata["parameters"] = inString;

    }

    return metadata;
}

export function getDisplayTextFromMetadata(metadata) {

    if (!metadata) { return ''; }

    const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
    const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

    let outputString = '';

    const positivePrompt = getPositivePromptInMetadata(metadata);
    if (positivePrompt) {
        outputString = positivePrompt + "\n";
    }

    const metaKeys = Object.keys(metadata)?.sort((a, b) => {
        // "Negative prompt" comes first
        if (isNegativePromptKey(a)) { return -1; }
        if (isNegativePromptKey(b)) { return 1; }
        return a.localeCompare(b);  // Alphabetical sorting for other keys
    });

    for (const key of metaKeys) {
        if (isPositivePromptKey(key)) { continue; }

        const bIsKeySpecified = allowDenyList?.includes(key.trim());

        // Add if no list specified or key is specified in allow list, or key not specified in deny list
        const bIncludeKey = !allowDenyList ||
            (bIsAllowList && bIsKeySpecified) || (!bIsAllowList && !bIsKeySpecified);

        if (bIncludeKey) {
            const formattedValue = metadata[key].replace(/\n/g, '').replace(/\\n/g, '');
            outputString = outputString + '\n' + `${key}: ${formattedValue}, `;
        }
    }

    // Replace all occurrences of "\n" with actual newlines
    outputString = outputString.replace(/\\n/g, '\n');

    return outputString;
}

export function makeTooltipWidgetFromMetadata(metadata) {
    if (utilitiesInstance.isInvalidObject(metadata)) {
        return null;
    }

    const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
    const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

    let outputWidget = $el("div", {
        style: {
            display: 'column',
        }
    });

    const positivePrompt = getPositivePromptInMetadata(metadata);
    if (positivePrompt) {
        let textContent = positivePrompt.replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("span", { style:{
                            wordBreak: 'break-word',
                        }, textContent: utilitiesInstance.decodeUnicodeForeignLanguageText(textContent) })
                ])
            ])
        );
    }

    const negativePrompt = getNegativePromptInMetadata(metadata);
    if (negativePrompt) {
        let textContent = negativePrompt.replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
        // Negative Prompt key and value on separate rows
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("label", { textContent: "Negative prompt:" })
                ])
            ])
        );
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("span", { style:{
                            wordBreak: 'break-word',
                        }, textContent: utilitiesInstance.decodeUnicodeForeignLanguageText(textContent) })
                ])
            ])
        );
    }

    const metaKeys = Object.keys(metadata)?.sort((a, b) => {
        return a.localeCompare(b);  // Alphabetical sorting for keys
    });

    for (const key of metaKeys) {
        if (isPositivePromptKey(key) || isNegativePromptKey(key)) { continue; }

        const bIsKeySpecified = allowDenyList?.includes(key.trim());

        // Add if no list specified or key is specified in allow list, or key not specified in deny list
        const bIncludeKey = !allowDenyList ||
            (bIsAllowList && bIsKeySpecified) || (!bIsAllowList && !bIsKeySpecified);

        if (bIncludeKey) {
            let formattedValue = utilitiesInstance.decodeUnicodeForeignLanguageText(metadata[key].replace(/\n/g, '').replace(/\\n/g, ''));

            const row =
                $el('tr', [
                    $el('td', {
                        style: {
                            width: bUseWideTooltip ? '25%' : '50%',
                        }
                    }, [
                        $el('label', {
                            textContent: `${key}:`,
                            style: {
                                wordBreak: bUseWideTooltip ? 'break-all' : 'none', // Break on any character to avoid overflow outside the container
                            }
                        })
                    ]),
                    $el('td', {
                        style: {
                            width: bUseWideTooltip ? '75%' : '50%',
                        }
                    }, [
                        $el('label', {
                            textContent: `${formattedValue}`,
                            style: {
                                wordBreak: bUseWideTooltip ? 'break-all' : 'none',
                            }
                        })
                    ]),
                ]);

            outputWidget.appendChild(row);
        }
    }

    return outputWidget.firstChild ? outputWidget : null; // Only return the widget if it has at least one child widget
}

export function setTooltipFromWidget(imageElement, widget) {
    if (widget) {

        imageElement.tooltipWidget = widget;

        imageElement.onpointermove = e => {
            if (toolTip?.style?.visibility === "visible") {

                // Calculate the maximum allowed positions
                const maxX = window.innerWidth - toolTip.offsetWidth - toolTipOffsetX;
                const maxY = window.innerHeight - toolTip.offsetHeight - toolTipOffsetY - 10; //extra offset to avoid link hint label

                // Calculate the adjusted positions
                const x = Math.min(e.pageX + toolTipOffsetX, maxX);
                const y = Math.min(e.pageY + toolTipOffsetY, maxY);

                toolTip.style.left = `${x}px`;
                toolTip.style.top = `${y}px`;
            }
        };
    }
}

export function setMetadataAndUpdateTooltipAndSearchTerms(imageElement, metadata) {

    imageElement.promptMetadata = metadata;

    // Set the dimensional display data in the event that it's not found in python meta sweep
    if (!imageElement?.displayData?.AspectRatio) {            
        imageElement.displayData.AspectRatio = imageElement.img.offsetWidth / imageElement.img.offsetHeight;
    } 
    imageElement.style.aspectRatio = `${imageElement.displayData.AspectRatio}`;

    if (!imageElement.displayData?.FileDimensions) {
        const width = imageElement.img.videoWidth || imageElement.img.offsetWidth;
        const height = imageElement.img.videoHeight || imageElement.img.offsetHeight;
        imageElement.displayData.FileDimensions = [width, height];
    }

    imageElement.displayData = utilitiesInstance.sortJsonObjectByKeys(imageElement.displayData);

    const toolTipWidget = makeTooltipWidgetFromMetadata(metadata);

    if (toolTipWidget) {
        setTooltipFromWidget(imageElement, toolTipWidget);
    }

    const elementUnderMouse = getElementUnderPointer();
    if (elementUnderMouse && elementUnderMouse == imageElement.img && imageElement.mouseOverEvent) {
        imageElement.mouseOverEvent();
    }

    // Finally, set search terms on the element
    const metaString = getDisplayTextFromMetadata(metadata).trim();

    if (metaString) {
        imageElement.searchTerms += " " + metaString;
    }
}