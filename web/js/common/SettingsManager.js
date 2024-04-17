// A script governing savable user settings and the creation of user interfaces for those settings

import { $el } from "/scripts/ui.js";
import { app } from "/scripts/app.js";

import { info_VideoPlaybackOptions, options_VideoPlayback } from "../common/VideoOptions.js";
import { getVideoElements } from "./Utilities.js";
import { getImageListChildren } from "../ImageDrawer/ImageListAndSearch.js";

export const defaultKeyList = "prompt, workflow";

var underButtonContent;

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

    // localStorage
    _getValue(name, defaultValue) {
        const val = localStorage.getItem("JNodes.Settings." + name);
        //console.log("localstorage (" + name + " : " + val + ")");
        if (val !== null) {
            try { // Try to parse the value automatically, and if we can't then just return the string
                const loadedValue = JSON.parse(val);
                if (typeof loadedValue === 'object') { // If it's an object, get the default first then assign loaded values on top
                    let fullValue = defaultValue;
                    Object.assign(fullValue, loadedValue);
                    return fullValue;
                } else { return loadedValue; } // If not, just return the parsed value
            } catch (error) {
                return val;
            }
        }
        //console.log("return defaultValue");
        return defaultValue;
    };

    _setValue(name, val) {
        localStorage.setItem("JNodes.Settings." + name, JSON.stringify(val));
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
export let setting_bMasterVisibility = new ImageDrawerConfigSetting("bMasterVisibility", true);
export let setting_DrawerAnchor = new ImageDrawerConfigSetting("DrawerAnchor", "top-left");

export let setting_KeyList = new ImageDrawerConfigSetting("ImageVideo.KeyList", defaultKeyList);
export let setting_bKeyListAllowDenyToggle = new ImageDrawerConfigSetting("ImageVideo.bKeyListAllowDenyToggle", false);

export let setting_ModelCardAspectRatio = new ImageDrawerConfigSetting("Models.AspectRatio", 0.67);

export let setting_VideoPlaybackOptions = new ImageDrawerConfigSetting("Video.VideoOptions", new options_VideoPlayback());

// Button setup

// A button shown in the comfy modal to show the drawer after it's been hidden
const showButton = $el("button.comfy-settings-btn", {
    textContent: "🖼️",
    style: {
        right: "16px",
        cursor: "pointer",
        display: "none",
    },
});
showButton.onclick = () => {
    imageDrawer.style.display = "block";
    showButton.style.display = "none";
    setting_bMasterVisibility.value = true;
};
document.querySelector(".comfy-settings-btn").after(showButton);

export const setupUiSettings = (onDrawerAnchorInput) => {
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
    // Drawer location
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Anchor:",
        });

        const settingWidget = createDrawerSelectionWidget(onDrawerAnchorInput);

        const tooltip = "To which part of the screen the drawer should be docked";
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
		True = Allow list, False = Deny list.`
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }
};

export function createDrawerSelectionWidget(onInput) {
    return $el("select", {
        oninput: onInput,
    },
        ["top-left", "top-right", "bottom-left", "bottom-right"].map((m) =>
            $el("option", {
                value: m,
                textContent: m,
                selected: setting_DrawerAnchor.value === m,
            })
        )
    );
}

function createExpandableSettingsArea() {

    const nameWidget = $el("label", {
        textContent: "JNodes Settings ",
    });

    const toggleButton = document.createElement('button');
    toggleButton.textContent = '►';
    toggleButton.classList.add('toggle-btn');

    underButtonContent = $el('div', {
        style: {
            id: 'under-button-content',
            textAlign: 'center',
            margin: 'auto',
            width: '100%',
            display: 'table',
            visibility: 'collapse'
        }
    });

    // Add click event listener to toggle button
    toggleButton.addEventListener('click', function () {
        const bIsCollapsed = underButtonContent.style.visibility === 'collapse';

        // Toggle content display
        underButtonContent.style.visibility =
            bIsCollapsed ? 'visible' : 'collapse';

        // Toggle button arrow orientation
        toggleButton.textContent = bIsCollapsed ? '▼' : '►';
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
                    colSpan: '2',
                }, [
                    $el("div", {
                        style: {
                            textAlign: 'center',
                            margin: 'auto',
                            width: '100%',
                        },
                    }, [nameWidget, toggleButton]), underButtonContent
                ]),
            ]);
        },
    });
}

export function addJNodesSetting(nameWidget, settingWidget, tooltip) {
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

        underButtonContent.innerHTML = '';

        // Update the table with the sorted rows
        rows.forEach(row => underButtonContent.appendChild(row));
    }

    let title = tooltip ? tooltip.toString() : '';
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

export function createFlyoutHandle(handleText, handleClassSuffix = '', menuClassSuffix = '') {
    let handle = $el(`section.flyout-handle${handleClassSuffix}`, [
        $el("label.flyout-handle-label", { textContent: handleText })
    ]);

    let menu = $el(`div.flyout-menu${menuClassSuffix}`);

    handle.appendChild(menu);

    return { handle: handle, menu: menu };
}

export function createVideoPlaybackOptionsMenuWidgets(menu) {

    const infos = new info_VideoPlaybackOptions();

    function setGenericSettingOnVisualElementsInImageList(propertyName, propertyValue, info) {
        for (let child of getImageListChildren()) {
            for (let element of getVideoElements(child)) {

                if (info.bPropagateOnChange) {
                    element[propertyName] = propertyValue;
                }

                if (info.forEachElement) {
                    info.forEachElement(element, propertyValue);
                }
            }
        }
    }

    function oninput(propertyName, newValue) {
        let videoOptionsCopy = { ...setting_VideoPlaybackOptions.value }; // Spread to make shallow copy
        videoOptionsCopy[propertyName] = newValue; // set value of property directly
        setting_VideoPlaybackOptions.value = videoOptionsCopy; // then replace the config setting value in order to serialize it properly

        // If requested, set similarly named properties on image list
        const info = infos[propertyName];
        if (info.bPropagateOnChange || info.forEachElement) {
            setGenericSettingOnVisualElementsInImageList(propertyName, newValue, info);
        }
    }

    // Iterate over properties found in the default options
    Object.entries(new options_VideoPlayback()).forEach(([propertyName, propertyValue]) => {
        // In case we're using an old serialization, use the serialized value or default
        const propertyValueToUse = propertyName in setting_VideoPlaybackOptions.value ? setting_VideoPlaybackOptions.value[propertyName] : propertyValue;
        let widget;
        if (typeof propertyValueToUse === 'boolean') {
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
        } else if (typeof propertyValueToUse === 'number') {
            let options = new options_LabeledSliderRange();
            options.id = `VideoPlaybackOptions.${propertyName}`
            options.value = propertyValueToUse;
            options.labelTextContent = propertyName;
            options.bIncludeValueLabel = false;
            options.oninput = (e) => {
                // This config setting is a class instance, so we need to take a few extra steps to serialize it
                const newValue = e.target.valueAsNumber;
                oninput(propertyName, newValue);
            }
            widget = createLabeledSliderRange(options);
        }
        widget.title = infos[propertyName]?.tooltip || '';
        menu.appendChild(widget);
    });
}

export function createVideoPlaybackOptionsFlyout() {
    const handleClassSuffix = '.video-handle';
    const menuClassSuffix = '.video-menu';
    let flyout = createFlyoutHandle("📽️", handleClassSuffix, menuClassSuffix);

    createVideoPlaybackOptionsMenuWidgets(flyout.menu);

    return flyout;
}

export class options_LabeledSliderRange {
    labelTextContent = undefined;
    bIncludeValueLabel = true;
    bPrependValueLabel = false;
    valueLabelFractionalDigits = 0;
    id = undefined;
    value = 0;
    min = 0;
    max = 100
    step = 1;
    oninput = undefined;
}

export function createLabeledSliderRange(options = new options_LabeledSliderRange()) {

    let valueLabelElement;

    if (options.bIncludeValueLabel) {
        valueLabelElement = $el('label', {
            textContent: options.value?.toFixed(options.valueLabelFractionalDigits) || 0
        });

        // Save the original oninput callback from options
        const originalOnInput = options.oninput;

        // Update the options.oninput callback
        options.oninput = (e) => {
            // Call the original oninput callback if available
            if (originalOnInput && typeof originalOnInput === 'function') {
                originalOnInput(e);
            }

            // Get the input value and round it to 2 decimal places
            const inputValue = parseFloat(e.target.value); // Convert input value to number
            const roundedValue = isNaN(inputValue) ? 0.00 : inputValue.toFixed(options.valueLabelFractionalDigits);

            // Update the labelElement text content with the rounded value
            valueLabelElement.textContent = roundedValue;
        };
    }

    let MainElement = $el('input', {
        id: options.id,
        type: 'range',
        value: options.value,
        min: options.min,
        max: options.max,
        step: options.step,
        oninput: options.oninput
    });

    let OuterElement = $el('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '5%'
        }
    });

    if (options.bPrependValueLabel && valueLabelElement) {
        OuterElement.appendChild(valueLabelElement);
    }

    OuterElement.appendChild($el('label', { textContent: options.labelTextContent }));
    OuterElement.appendChild(MainElement);

    if (!options.bPrependValueLabel && valueLabelElement) { //append otherwise
        OuterElement.appendChild(valueLabelElement);
    }

    return OuterElement;
}

export class options_LabeledCheckboxToggle {
    labelTextContent = undefined;
    id = undefined;
    checked = false;
    oninput = undefined;
}

export function createLabeledCheckboxToggle(options = new options_LabeledCheckboxToggle()) {

    let MainElement = $el('input', {
        id: options.id,
        type: 'checkbox',
        checked: options.checked,
        oninput: options.oninput
    });

    let OuterElement = $el('div', {
        style: {
            display: 'flex',
            alignItems: 'center'
        }
    }, [
        $el('label', { textContent: options.labelTextContent }),
        MainElement
    ]);

    return OuterElement;
}