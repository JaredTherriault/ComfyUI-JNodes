// A script governing savable user settings and the creation of user interfaces for those settings

import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";

import { info_VideoPlaybackOptions, options_VideoPlayback } from "../common/VideoOptions.js";
import { utilitiesInstance } from "./Utilities.js";

export const defaultKeyList = "prompt, workflow, parameters";

var underButtonContent;

let settingsCache = {};

// A class that saves and loads its given value via localStorage automatically. 
// Use it for any setting that should have its data saved.
export class ConfigSetting {
    constructor(settingName, defaultValue) {
        this._settingName = settingName;
        this._defaultValue = defaultValue;
        this._onChange = () => { }; // Default callback function
    }

    // Getter method
    get value() {
        return this._getValue(this._settingName, this._defaultValue);
    }

    // Setter method
    set value(newValue) {
        this._setValue(this._settingName, newValue);
        this._onChange(newValue); // Call the callback function when value changes
    }

    // Method to set the callback function
    setOnChange(callback) {
        this._onChange = callback;
    }

    getDefaultValue() {
        return this._defaultValue;
    }

    // localStorage
    _getValue(name, defaultValue) {

        const id = "JNodes.Settings." + name;

        let val = null;

        try {

            // val = app.ui.settings.getSettingValue(id);
            val = settingsCache[id];
            //console.log(`comfy.settings: ${id}: ${val}`);

        } catch {

        }

        if (val === null || val == undefined) {

            val = localStorage.getItem(id); // Backup solution
            // console.log(`localstorage: ${id}: ${val}`);


            if (val === null || val === undefined || val === "undefined") {

                //console.log("return defaultValue");
                return defaultValue;
            }
        }

        try { // Try to parse the value automatically, and if we can"t then just return the string
            const loadedValue = JSON.parse(val);
            if (typeof loadedValue === "object") { // If it's an object, get the default first then assign loaded values on top
                let fullValue = defaultValue;
                Object.assign(fullValue, loadedValue);
                return fullValue;
            } else { return loadedValue; } // If not, just return the parsed value
        } catch (error) {
            return val;
        }
    };

    async _setValue(name, val) {

        const id = "JNodes.Settings." + name;
        const asString = JSON.stringify(val);

        settingsCache[id] = asString;
        localStorage.setItem(id, asString); // Backup solution
        await api.fetchApi("/jnodes_post_all_settings", { method: "POST", body: JSON.stringify({settings: settingsCache})}); // Not necessary to stringify beforehand
    };

    // Usage Example

    // Create an instance of the Observable class
    //   const mySetting = new ConfigSetting();

    // Set the onChange callback function
    //   mySetting.setOnChange((newValue) => {
    //     console.log(`Value changed to: ${newValue}`);
    //   });

    // Change the value, which triggers the callback function
    //   mySetting.value = 10;
}

export class ImageDrawerConfigSetting extends ConfigSetting {
    constructor(settingName, defaultValue) {
        super("ImageDrawer." + settingName, defaultValue);
    }
}

export let setting_bEnabled = new ImageDrawerConfigSetting("bEnabled", true);
export let setting_ImageDrawerInstanceCount = new ImageDrawerConfigSetting("ImageDrawerInstanceCount", 1);
export let setting_bMasterVisibility = new ImageDrawerConfigSetting("bMasterVisibility", true);
export let setting_DrawerAnchor = new ImageDrawerConfigSetting("DrawerAnchor", "top-left");
export let setting_SidebarSplitterHandleSize = new ImageDrawerConfigSetting("Drawer.Sidebar.Splitter.Width", 0);

export let setting_KeyList = new ImageDrawerConfigSetting("ImageVideo.KeyList", defaultKeyList);
export let setting_bKeyListAllowDenyToggle = new ImageDrawerConfigSetting("ImageVideo.bKeyListAllowDenyToggle", false);
export let setting_bMetadataTooltipToggle = new ImageDrawerConfigSetting("ImageVideo.bMetadataTooltipToggle", true);

export let setting_FavouritesDirectory = new ImageDrawerConfigSetting("Directories.Favourites", "output/Favourites");
export let setting_CopyLoraTextPattern = new ImageDrawerConfigSetting("Models.CopyLoraTextPattern", "<lora:{{modelName}}:{{strengthModel}}:{{strengthClip}}>");
export let setting_CopyModelTrainedWordsEndCharacter = new ImageDrawerConfigSetting("Models.CopyLoraTrainedWordsEndCharacter", ", ");

export let setting_ModelCardAspectRatio = new ImageDrawerConfigSetting("Models.AspectRatio", 0.67);

export let setting_VideoPlaybackOptions = new ImageDrawerConfigSetting("Video.VideoOptions", new options_VideoPlayback());

export let setting_bQueueTimerEnabled = new ImageDrawerConfigSetting("bQueueTimerEnabled", false);

// Button setup

export const setupUiSettings = async (onImageDrawerInstanceCountChanged) => {

    let response = await api.fetchApi("/jnodes_get_all_settings", { method: "GET", cache: "no-store" });

    const decodedString = await utilitiesInstance.decodeReadableStream(response.body);
    const jsonResponse = JSON.parse(decodedString)

    if (jsonResponse?.success && jsonResponse?.payload) {
        settingsCache = JSON.parse(jsonResponse.payload);
    }

    // Enable/disable
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Enabled:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bEnabled.value,
                oninput: (e) => {
                    setting_bEnabled.value = e.target.checked;
                },
            },
        );

        const tooltip = "Whether or not the image drawer is initialized (requires page reload)";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }
    // Number of Instances
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Instance Count:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "number",
                value: setting_ImageDrawerInstanceCount.value,
                min: 1,
                step: 1,
                oninput: (e) => {
                    setting_ImageDrawerInstanceCount.value = e.target.value;
                    onImageDrawerInstanceCountChanged(e);
                },
            },
        );

        const tooltip = "How many image drawer instances to have onscreen at once.";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }
    // Default Drawer location
    {
        const labelWidget = $el("label", {
            textContent: "Default Image Drawer Anchor:",
        });

        const settingWidget = createDrawerSelectionWidget(setting_DrawerAnchor.value, null);

        const tooltip = "To which part of the screen new drawer instances should be docked";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Sidebar Splitter Handle Size
    {
        const labelWidget = $el("label", {
            textContent: "Sidebar Splitter Handle Size:",
        });

        const settingWidget = $el("input", {
            type: "number",
            value: setting_SidebarSplitterHandleSize.value,
            min: 0,
            step: 1,
            oninput: (e) => {
                setting_SidebarSplitterHandleSize.value = e.target.value;
            },
        });

        const tooltip = "Overrides the size of the splitter handle for JNodes Image Drawer docked in a sidebar tab. " +
            "Note that this only applies to Image Drawer tabs and does not apply to any other tabs. " +
            "Set to 0 to use the default Comfy-set size. Size is in pixels. Close and re-open sidebar tab.";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    

    // Mouse over image/video key allow/deny list
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Image & Video Key List:",
        });

        const settingWidget = $el(
            "input",
            {
                defaultValue: setting_KeyList.value,
                oninput: (e) => {
                    setting_KeyList.value = e.target.value;
                },
            },
        );

        const tooltip = "A set of comma-separated names to include or exclude " +
            "from the tooltips applied to images in the drawer";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Mouse over image/video key allow/deny list toggle
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Image & Video Key List Allow/Deny Toggle:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bKeyListAllowDenyToggle.value,
                oninput: (e) => {
                    setting_bKeyListAllowDenyToggle.value = e.target.checked;
                },
            },
        );

        const tooltip = `Whether the terms listed in the Key List should be 
		denied or allowed, excluding everything else.
		True = Allow list, False = Deny list.`;
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Mouse over image/video to show tooltips
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Image & Video Metadata Tooltip Toggle:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bMetadataTooltipToggle.value,
                oninput: (e) => {
                    setting_bMetadataTooltipToggle.value = e.target.checked;
                },
            },
        );

        const tooltip = `Whether to show a tooltip with metadata when hovering images and videos in the drawer.`;
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Favourites directory
    {
        const labelWidget = $el("label", {
            textContent: "Favourites directory:",
        });

        const settingWidget = $el(
            "input",
            {
                defaultValue: setting_FavouritesDirectory.value,
                oninput: (e) => {
                    setting_FavouritesDirectory.value = e.target.value;
                },
            },
        );

        const tooltip = "A directory to which all images marked as a favourite in image overflow menus will be copied. " +
            "The directory can be relative to the comfy folder ('output/Favourites') or absolute (i.e. 'C:/Favourites' or '/home/Pictures/Favourites') " +
            "assuming the user and comfy process have sufficient permissions to access these directories.";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Copy Lora Text pattern
    {
        const labelWidget = $el("label", {
            textContent: "'Copy Lora as Text' pattern:",
        });

        const settingWidget = $el(
            "input",
            {
                defaultValue: setting_CopyLoraTextPattern.value,
                oninput: (e) => {
                    setting_CopyLoraTextPattern.value = e.target.value;
                },
            },
        );

        const tooltip = "Define the way text loras are constructed when copied to the clipboard. " +
            "put variable names in double braces '{{}}'. Variables are 'modelName', 'strengthModel', and 'strengthClip'. " +
            `For example, '${setting_CopyLoraTextPattern.getDefaultValue()}'`;
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Copy Model Trained Words End Character
    {
        const labelWidget = $el("label", {
            textContent: "'Copy Model Trained Words' end character:",
        });

        const settingWidget = $el(
            "input",
            {
                defaultValue: setting_CopyModelTrainedWordsEndCharacter.value,
                oninput: (e) => {
                    setting_CopyModelTrainedWordsEndCharacter.value = e.target.value;
                },
            },
        );

        const tooltip = "Define the text appended to the end of the trained words when copying " +
            "a model's trained words or full text.";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Enable/disable queue timer
    {
        const labelWidget = $el("label", {
            textContent: "Queue Timer Enabled (experimental):",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bQueueTimerEnabled.value,
                oninput: (e) => {
                    setting_bQueueTimerEnabled.value = e.target.checked;
                },
            },
        );

        const tooltip = "Whether to show the Queue Timer widget which can be long-clicked to automatically " +
            "send prompt queues at a set interval (requires page reload, requires old UI)";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Video Playback Settings
    // {
    //     const labelWidget = $el("label", {
    //         textContent: "Video Playback Settings:",
    //     });

    //     const settingWidget = $el("div");
    //     createVideoPlaybackOptionsMenuWidgets(settingWidget);

    //     const tooltip = `Change various settings concerning video playback for videos in the drawer 
    //     (note: useWheelSeek and invertWheelSeek apply to all videos in the ComfyUI window)`;
    //     addJNodesSetting(labelWidget, settingWidget, tooltip);
    // }
};

export function createDrawerSelectionWidget(defaultValue, onInput, isSelected = null) {

    const options = ["top-left", "top-right", "bottom-left", "bottom-right", "sidebar"];

    const widget = $el("select", {
        oninput: onInput,
    },
        options.map((m) =>
            $el("option", {
                value: m,
                textContent: m,
                selected: isSelected ? isSelected(m) : setting_DrawerAnchor.value === m,
            })
        )
    );

    widget.value = options.includes(defaultValue) ? defaultValue : widget.value;

    return widget;
}

function createExpandableSettingsArea() {

    const nameWidget = $el("label", {
        textContent: "JNodes Settings ",
    });

    const toggleButton = document.createElement("button");
    toggleButton.textContent = "▶";
    toggleButton.classList.add("toggle-btn");

    underButtonContent = $el("div", {
        style: {
            id: "under-button-content",
            textAlign: "center",
            margin: "auto",
            width: "100%",
            display: "table",
            visibility: "collapse"
        }
    });

    // Add click event listener to toggle button
    toggleButton.addEventListener("click", function () {
        const bIsCurrentlyCollapsed = underButtonContent.style.visibility === "collapse";

        // Toggle content display
        underButtonContent.style.visibility =
            bIsCurrentlyCollapsed ? "visible" : "collapse";

        // Toggle button arrow orientation
        toggleButton.textContent = bIsCurrentlyCollapsed ? "▼" : "▶";
    });

    app.ui.settings.addSetting({
        id: "JNodes.SettingsContainer",
        name: "JNodes Settings Container",
        type: () => {
            return $el("tr", {
                style: {
                    width: "100%",
                }
            }, [
                $el("td", {
                    colSpan: "2",
                }, [
                    $el("div", {
                        style: {
                            textAlign: "center",
                            margin: "auto",
                            width: "100%",
                        },
                    }, [nameWidget, toggleButton]), underButtonContent
                ]),
            ]);
        },
    });
}

export function addJNodesSetting(nameWidget, settingWidget, tooltip, bUseExpandableArea = false) {

    if (!bUseExpandableArea){
        app.ui.settings.addSetting({
            id: `JNodes.SettingsContainer.${nameWidget.textContent.replace(" ","")}`,
            name: nameWidget.textContent,
            type: () => { return settingWidget} 
        });
    } else {
        if (!underButtonContent) {
            createExpandableSettingsArea();
        }

        function sortTable() {
            const rows = Array.from(underButtonContent.children);

            // Sort the rows based on the text in the left cell
            rows.sort((a, b) => {
                const textA = a.children[0].textContent.trim().toLowerCase();
                const textB = b.children[0].textContent.trim().toLowerCase();
                return textA.localeCompare(textB);
            });

            underButtonContent.innerHTML = "";

            // Update the table with the sorted rows
            rows.forEach(row => underButtonContent.appendChild(row));
        }

        let title = tooltip ? tooltip.toString() : "";
        nameWidget.title = nameWidget.title ? nameWidget.title : title;
        settingWidget.title = settingWidget.title ? settingWidget.title : title;

        underButtonContent.appendChild(
            $el("tr", [
                $el("td", {
                    style: {
                        verticalAlign: "middle",
                    }
                }, [
                    nameWidget ? nameWidget : $el("div")
                ]),
                $el("td", {
                    style: {
                        verticalAlign: "middle",
                        textAlign: "left",
                    }
                }, [
                    settingWidget ? settingWidget : $el("div")
                ])
            ])
        );

        sortTable();
    }
}

export function createFlyoutHandle(handleText, handleClassSuffix = "", menuClassSuffix = "", parentRect = window, forcedAnchor = "") {
    let handle = $el(`section.flyout-handle.${handleClassSuffix}`, [
        $el("label.flyout-handle-label", { textContent: handleText })
    ]);

    let menu = $el(`div.flyout-menu.${menuClassSuffix}`);

    handle.appendChild(menu);

    handle.determineTransformLayout = function () {

        const handleRect = handle.getBoundingClientRect();

        let transformOriginX = "0%";
        let transformOriginY = "0%";

        const halfHeight = (parentRect.innerHeight || parentRect.height) / 2;

        const bIsHandleInTopHalf = (handleRect.top < halfHeight || forcedAnchor.includes("n")) && !forcedAnchor.includes("s");
        if (bIsHandleInTopHalf) {
            // Menu is in the top half of the viewport
            menu.style.top = "0";
            menu.style.bottom = "auto";
            menu.style.maxHeight = `${parentRect.bottom - handleRect.top - 50}px`;
        } else {
            // Menu is in the bottom half of the viewport
            transformOriginY = "100%";
            menu.style.bottom = "0";
            menu.style.top = "auto";
            menu.style.maxHeight = `${handleRect.top - parentRect.top - 50}px`;
        }

        const halfWidth = (parentRect.innerWidth || parentRect.width) / 2;

        const bIsHandleInLeftHalf = (handleRect.left < halfWidth || forcedAnchor.includes("e")) && !forcedAnchor.includes("w");
        if (bIsHandleInLeftHalf) {
            // Menu is in the left half of the viewport
            menu.style.left = "0";
            menu.style.right = "auto";
            menu.style.maxWidth = `${parentRect.right - handleRect.left - 50}px`;
        } else {
            // Menu is in the right half of the viewport
            transformOriginX = "100%";
            menu.style.right = "0";
            menu.style.left = "auto";
            menu.style.maxWidth = `${handleRect.left - parentRect.left - 50}px`;
        }

        menu.style.transformOrigin = `${transformOriginX} ${transformOriginY}`;
    };

    handle.addEventListener("mouseover", handle.determineTransformLayout);

    return { handle: handle, menu: menu };
}

export function createVideoPlaybackOptionsMenuWidgets(menu, imageDrawerListInstance) {

    const infos = new info_VideoPlaybackOptions();

    async function callForEachCallbackOnEachElementInImageList(propertyName, propertyValue, info) {
        for (let child of imageDrawerListInstance.getImageListChildren()) {
            for (let element of utilitiesInstance.getVideoElements(child)) {
                info.forEachElement(element, propertyName, propertyValue);
            }
        }
    }

    function oninput(propertyName, newValue) {
        let videoOptionsCopy = { ...setting_VideoPlaybackOptions.value }; // Spread to make shallow copy
        videoOptionsCopy[propertyName] = newValue; // set value of property directly
        setting_VideoPlaybackOptions.value = videoOptionsCopy; // then replace the config setting value in order to serialize it properly

        // If requested, set similarly named properties on image list
        const info = infos[propertyName];
        if (info.forEachElement) {
            callForEachCallbackOnEachElementInImageList(propertyName, newValue, info, imageDrawerListInstance);
        }
    }

    // Iterate over properties found in the default options
    Object.entries(new options_VideoPlayback()).forEach(([propertyName, propertyValue]) => {
        // In case we're using an old serialization, use the serialized value or default
        const propertyValueToUse = propertyName in setting_VideoPlaybackOptions.value ? setting_VideoPlaybackOptions.value[propertyName] : propertyValue;
        const info = infos[propertyName];
        let widget;
        if (info.widgetType === "checkbox") {
            let options = new options_LabeledCheckboxToggle();
            options.id = `VideoPlaybackOptions.${propertyName}`
            options.checked = propertyValueToUse;
            options.labelTextContent = propertyName;
            options.oninput = (e) => {
                // This config setting is a class instance, so we need to take a few extra steps to serialize it
                const newValue = e.target.checked;
                oninput(propertyName, newValue);
            }
            widget = createLabeledCheckboxToggle(options);
        } else if (info.widgetType === "range") {
            let options = new options_LabeledSliderRange();
            options.id = `VideoPlaybackOptions.${propertyName}`
            options.value = propertyValueToUse;
            options.labelTextContent = propertyName;
            options.bIncludeValueLabel = false;
            options.min = info?.min ? info.min : options.min;
            options.max = info?.max ? info.max : options.max;
            options.step = info?.step ? info.step : options.step;
            options.oninput = (e) => {
                // This config setting is a class instance, so we need to take a few extra steps to serialize it
                const newValue = e.target.valueAsNumber;
                oninput(propertyName, newValue);
            }
            widget = createLabeledSliderRange(options);
        } else if (info.widgetType === "number") {
            let options = new options_LabeledNumberInput();
            options.id = `VideoPlaybackOptions.${propertyName}`
            options.value = propertyValueToUse;
            options.labelTextContent = propertyName;
            options.min = info?.min ? info.min : options.min;
            options.max = info?.max ? info.max : options.max;
            options.step = info?.step ? info.step : options.step;
            options.onchange = (e) => { // Use onchange here because the user can type a value in, onchange requires commit
                // This config setting is a class instance, so we need to take a few extra steps to serialize it
                const newValue = e.target.valueAsNumber;
                oninput(propertyName, newValue);
            }
            widget = createLabeledNumberInput(options);
        }
        widget.title = infos[propertyName]?.tooltip || "";
        menu.appendChild(widget);
    });
}

export function createVideoPlaybackOptionsFlyout(imageDrawerListInstance) {
    const handleClassSuffix = "video-handle";
    const menuClassSuffix = "video-menu";
    let flyout = createFlyoutHandle("📽️", handleClassSuffix, menuClassSuffix);

    createVideoPlaybackOptionsMenuWidgets(flyout.menu, imageDrawerListInstance);

    return flyout;
}

class options_BaseLabeledWidget {
    id = "labeledWidget";
    labelTextContent = undefined;
    oninput = undefined;
    onchange = undefined;
    bPlaceLabelAfterMainElement = false;

    bindEvents(widget) {
        if (this.oninput) {
            widget.oninput = this.oninput;
        }

        if (this.onchange) {
            widget.onchange = this.onchange;
        }

        return widget;
    }
}

export class options_LabeledSliderRange extends options_BaseLabeledWidget {
    bIncludeValueLabel = true;
    bPrependValueLabel = false;
    valueLabelFractionalDigits = 0;
    value = 0;
    min = 0;
    max = 100
    step = 1;
}

export function createLabeledSliderRange(options = null) {

    if (!options) {
        options = new options_LabeledSliderRange();
    }

    let valueLabelElement;

    let OuterElement = $el("div", {
        style: {
            display: "flex",
            alignItems: "center",
            gap: "5%"
        }
    });

    if (options.bIncludeValueLabel) {
        valueLabelElement = $el("label", {
            textContent: options.value?.toFixed(options.valueLabelFractionalDigits) || 0
        });

        // Save the original oninput callback from options
        const originalOnInput = options.oninput;

        // Update the options.oninput callback
        options.oninput = (e) => {
            // Call the original oninput callback if available
            if (originalOnInput && typeof originalOnInput === "function") {
                originalOnInput(e);
            }

            OuterElement.setLabelTextContent(e.target.value);
        };
    }

    let MainElement = $el("input", {
        id: options.id,
        type: "range",
        value: options.value,
        min: options.min,
        max: options.max,
        step: options.step
    });

    options.bindEvents(MainElement);

    const LabelWidget = $el("label", { textContent: options.labelTextContent });

    if (!options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    if (options.bPrependValueLabel && valueLabelElement) {
        OuterElement.appendChild(valueLabelElement);
    }
    OuterElement.appendChild(MainElement);

    if (!options.bPrependValueLabel && valueLabelElement) { //append otherwise
        OuterElement.appendChild(valueLabelElement);
    }

    if (options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    OuterElement.getMainElement = function () {
        return MainElement;
    };

    OuterElement.setValueDirectly = function (value, bClamp = true) {
        if (bClamp) {
            value = utilitiesInstance.clamp(value, options.min, options.max);
        }
        MainElement.value = value;
        OuterElement.setLabelTextContent(value);
    }

    OuterElement.setLabelTextContent = function (value) {

        // Get the input value and round it to 2 decimal places
        const inputValue = parseFloat(value); // Convert input value to number
        const roundedValue = isNaN(inputValue) ? 0.00 : inputValue.toFixed(options.valueLabelFractionalDigits);

        // Update the labelElement text content with the rounded value
        valueLabelElement.textContent = roundedValue;
    }

    return OuterElement;
}

export class options_LabeledNumberInput extends options_BaseLabeledWidget {
    value = 0;
    min = 0;
    max = 100
    step = 1;
}

export function createLabeledNumberInput(options = null) {

    if (!options) {
        options = new options_LabeledNumberInput();
    }

    let MainElement = $el("input", {
        id: options.id,
        type: "number",
        value: options.value,
        min: options.min,
        max: options.max,
        step: options.step
    });


    // Save the original oninput callback from options
    const originalOnInput = options.oninput;

    // Update the options.oninput callback
    options.oninput = (e) => {

        // Get the input value and round it to 2 decimal places
        const inputValue = parseFloat(e.target.value); // Convert input value to number
        if (isNaN(inputValue)) {
            e.target.value = MainElement.lastValue ? MainElement.lastValue : 1.00;
            e.target.select();
        }

        // Update the labelElement text content with the rounded value

        MainElement.lastValue = e.target.value;

        // Call the original oninput callback if available
        if (originalOnInput && typeof originalOnInput === "function") {
            originalOnInput(e);
        }
    };

    options.bindEvents(MainElement);

    let OuterElement = $el("div", {
        style: {
            display: "flex",
            alignItems: "center",
            gap: "5%"
        }
    });

    const LabelWidget = $el("label", { textContent: options.labelTextContent });

    if (!options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    OuterElement.appendChild(MainElement);

    if (options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    OuterElement.getMainElement = function () {
        return MainElement;
    };

    return OuterElement;
}

export class options_LabeledCheckboxToggle extends options_BaseLabeledWidget {
    checked = false;
}

export function createLabeledCheckboxToggle(options = null) {

    if (!options) {
        options = new options_LabeledCheckboxToggle();
    }

    let MainElement = $el("input", {
        id: options.id,
        type: "checkbox",
        checked: options.checked
    });

    options.bindEvents(MainElement);

    let OuterElement = $el("div", {
        style: {
            display: "flex",
            alignItems: "center"
        }
    });

    const LabelWidget = $el("label", { textContent: options.labelTextContent });

    if (!options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    OuterElement.appendChild(MainElement);

    if (options.bPlaceLabelAfterMainElement) {

        OuterElement.appendChild(LabelWidget);
    }

    OuterElement.getMainElement = function () {
        return MainElement;
    };

    return OuterElement;
}