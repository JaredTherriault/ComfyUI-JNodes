import { $el } from "/scripts/ui.js";

import * as Sorting from "./Sorting.js";

import { getElementUnderPointer } from "../common/EventManager.js";
import { getPngMetadata } from "/scripts/pnginfo.js";

import { setting_bKeyListAllowDenyToggle, setting_KeyList, createFlyoutHandle } from "../common/SettingsManager.js";

import ExifReader from '../common/ExifReader-main/src/exif-reader.js';

import { utilitiesInstance } from "../common/Utilities.js";
import { isPointerDown } from "../common/EventManager.js";

import { setting_FontSize, setting_FontFamily } from "../TextareaFontControl.js"

import { imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";
import { getCurrentContextObject } from "./ContextSelector.js";

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

    // Remove all children
    while (toolTip.firstChild) {
        toolTip.removeChild(toolTip.firstChild);
    }

    // And append the incoming one
    toolTip.appendChild(newTooltipWidget);

    return true;
}

export function updateAndShowTooltip(newTooltipWidget, imageElement) {
    const bTooltipUpdated = updateTooltip(newTooltipWidget, imageElement);
    if (bTooltipUpdated && toolTip) {
        toolTip.style.visibility = "visible";
        toolTip.style.opacity = "1";
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

        imageElementMouseOutEvent(event, currentMousedOverImageElement);
    }

    // Only show tooltip if a mouse button is not being held
    if (!isPointerDown() && !toolButtonContainer?.contains(event.target)) {

        currentMousedOverImageElement = imageElement;
        addCheckboxSelectorToImageElement(imageElement);
        addToolButtonToImageElement(imageElement);
        updateAndShowTooltip(imageElement.tooltipWidget, imageElement);
    }
}

export function imageElementMouseOutEvent(event, imageElement) {
    if (!event) { return; }

    hideToolTip();

    // If the new actively moused over element is not a child of imageElement, then hide the button
    if (!imageElement.contains(event.relatedTarget)) {

        removeAndHideToolButtonFromImageElement(imageElement);
        hideImageElementCheckboxSelector(imageElement);
        currentMousedOverImageElement = null;
    }
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
                    width: "max-content",
                    cursor: "pointer",
                }
            }, [
                foregroundElement
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
                const FileDimensionStringifier = (key, value) => {
                    // Check if the key is 'FileDimensions'
                    if (key === 'FileDimensions') {
                        // Serialize the value of 'FileDimensions' as a single line string
                        return JSON.stringify(value);
                    }

                    if (typeof value == "number") {
                        return value.toFixed(3);
                    }
                    // Return the original value for other keys
                    return value;
                };

                let toolTipText = `${imageElementToUse.subdirectory ? imageElementToUse.subdirectory + "/" : ""}${imageElementToUse.filename}`;

                if (imageElementToUse.displayData) {
                    toolTipText += `\n${JSON.stringify(imageElementToUse.displayData, FileDimensionStringifier, "\t")}`;
                }

                flyout.menu.appendChild($el("label", {
                    textContent: `📝 ${imageElementToUse.filename}`,
                    title: toolTipText,
                }));
            }

            // Delete button
            {
                const baseLabelText = "♻️ Delete From Disk";
                const confirmLabelText = "♻️ Click again to confirm";
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

                                const currentContextObject = getCurrentContextObject();
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
                const confirmLabelText = "❌ Click again to confirm";
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

                                const currentContextObject = getCurrentContextObject();
                                if (currentContextObject) {
                                    currentContextObject.onRequestSingleRemoval(imageElementToUse);
                                }
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
                            const currentContextObject = getCurrentContextObject();
                            if (currentContextObject) {
                                currentContextObject.onRequestShowInFileManager(imageElementToUse);
                            }
                        }
                    )
                );
            }

            if (imageElementToUse.promptMetadata && Object.keys(imageElementToUse.promptMetadata).length > 0) {

                if (imageElementToUse?.promptMetadata?.positive_prompt) {
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
                                let positive_prompt = imageElementToUse?.promptMetadata?.positive_prompt;
                                if (positive_prompt.startsWith('"')) { positive_prompt = positive_prompt.slice(1); }
                                if (positive_prompt.endsWith('"')) { positive_prompt = positive_prompt.slice(0, positive_prompt.length - 1); }
                                utilitiesInstance.copyToClipboard(positive_prompt);
                                // removeOptionsMenu();
                                e.preventDefault();
                            }
                        )
                    );
                }

                let metadataKeys = Object.keys(imageElementToUse.promptMetadata);
                metadataKeys.sort();
                for (const key of metadataKeys) {
                    if (key == "positive_prompt") {
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
                                if (data.startsWith('"')) { data = data.slice(1); }
                                if (data.endsWith('"')) { data = data.slice(0, data.length - 1); }
                                utilitiesInstance.copyToClipboard(data);
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

    if (!toolButtonContainer) {
        toolButtonContainer = utilitiesInstance.createDarkContainer("imageToolsButton", "0%");
    }

    const handleClassSuffix = '.imageElement-flyout-handle';
    const menuClassSuffix = '.imageElement-flyout-menu';
    const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
    const parentRect = imageDrawerListInstance.getImageListElement().getBoundingClientRect();
    const flyout = createFlyoutHandle("⋮", handleClassSuffix, menuClassSuffix, parentRect);

    toolButtonContainer.style.top = '2%';
    toolButtonContainer.style.right = '2%';

    while (toolButtonContainer.firstChild) {
        toolButtonContainer.removeChild(toolButtonContainer.firstChild);
    }
    toolButtonContainer.appendChild(flyout.handle);

    createButtons(flyout);

    toolButtonContainer.flyout = flyout;

    return toolButtonContainer;
}

export function addToolButtonToImageElement(imageElementToUse) {

    if (!imageElementToUse) {
        return;
    }

    const toolButton = getOrCreateToolButton(imageElementToUse);

    imageElementToUse.appendChild(toolButton);
    toolButton.style.visibility = "visible";

    toolButton.flyout.handle.determineTransformLayout(); // Call immediately after parenting to avoid first calling being from the center
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
                const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
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

export async function onLoadImageElement(imageElement) {
    if (imageElement.img.complete || imageElement.bIsVideoFormat) {
        if (imageElement.bComplete) {
            //console.log('Image has been completely loaded.');
            return;
        }

        const response = await fetch(imageElement.fileInfo.href);
        const blob = await response.blob();

        // Hover mouse over image to show meta
        //console.log(imageElement.fileInfo.href);
        let metadata = null;
        try {
            if (imageElement.fileInfo.href.includes(".png")) {
                metadata = await getPngMetadata(blob);
            } else if (imageElement.fileInfo.href.includes(".webp")) {
                const webpArrayBuffer = await blob.arrayBuffer();

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
                    const jsonReadyString = cleanedString.replace("UNICODE", "")

                    try {
                        metadata = JSON.parse(jsonReadyString);
                    } catch (error) {
                        console.log(`${error} (${imageElement.fileInfo.href})`);
                    }
                }
            }
        } catch (error) {
            if (error.name != "MetadataMissingError") {
                console.log(`${error} (${imageElement.fileInfo.href})`);
            }
        }

        setMetadataAndUpdateTooltipAndSearchTerms(imageElement, metadata);

        imageElement.bComplete = true;

        if (imageElement.fileInfo.bShouldSort == true) {
            Sorting.sortWithCurrentType();
            imageElement.fileInfo.bShouldSort = false;
        }

        if (imageElement.fileInfo.bShouldApplySearch == true) {
            const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");
            imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
            imageElement.fileInfo.bShouldApplySearch = false;
        }
    }
    else {
        console.log('Image is still loading.');
    }
}

export function getDisplayTextFromMetadata(metadata) {

    if (!metadata) { return ''; }

    const positivePromptKey = 'positive_prompt';
    const negativePromptKey = 'negative_prompt';

    const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
    const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

    let outputString = '';

    if (metadata[positivePromptKey]) {
        outputString = metadata[positivePromptKey] + "\n";
    }

    const metaKeys = Object.keys(metadata)?.sort((a, b) => {
        // 'negative_prompt' comes first
        if (a === negativePromptKey) { return -1; }
        if (b === negativePromptKey) { return 1; }
        return a.localeCompare(b);  // Alphabetical sorting for other keys
    });

    for (const key of metaKeys) {
        if (key == positivePromptKey) { continue; }

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

    const positivePromptKey = 'positive_prompt';
    const negativePromptKey = 'negative_prompt';

    const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
    const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

    let outputWidget = $el("div", {
        style: {
            display: 'column',
        }
    });

    if (metadata[positivePromptKey]) {
        let textContent = metadata[positivePromptKey].replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("div", { textContent: textContent })
                ])
            ])
        );
    }

    if (metadata[negativePromptKey]) {
        let textContent = metadata[negativePromptKey].replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
        // Negative Prompt key and value on separate rows
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("label", { textContent: `${negativePromptKey}:` })
                ])
            ])
        );
        outputWidget.appendChild(
            $el('tr', [
                $el('td', {
                    colSpan: '2',
                }, [
                    $el("div", { textContent: textContent })
                ])
            ])
        );
    }

    const metaKeys = Object.keys(metadata)?.sort((a, b) => {
        return a.localeCompare(b);  // Alphabetical sorting for keys
    });

    for (const key of metaKeys) {
        if (key == positivePromptKey || key == negativePromptKey) { continue; }

        const bIsKeySpecified = allowDenyList?.includes(key.trim());

        // Add if no list specified or key is specified in allow list, or key not specified in deny list
        const bIncludeKey = !allowDenyList ||
            (bIsAllowList && bIsKeySpecified) || (!bIsAllowList && !bIsKeySpecified);

        if (bIncludeKey) {
            let formattedValue = metadata[key].replace(/\n/g, '').replace(/\\n/g, '');

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
    if (!imageElement.displayData.FileDimensions && imageElement.fileInfo.file?.dimensions) {
        imageElement.displayData.FileDimensions = imageElement.fileInfo.file.dimensions;
    }

    if (!imageElement.displayData.AspectRatio && imageElement.displayData.FileDimensions) {
        imageElement.displayData.AspectRatio = imageElement.displayData.FileDimensions[0] / imageElement.displayData.FileDimensions[1];
    }

    imageElement.displayData = utilitiesInstance.SortJsonObjectByKeys(imageElement.displayData);

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