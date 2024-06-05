import { $el } from "/scripts/ui.js";
import { app } from "../../../../scripts/app.js";
import { addJNodesSetting, createLabeledCheckboxToggle, options_LabeledCheckboxToggle } from "./SettingsManager.js";

const extensionManagerName = "JNodes.ExtensionManager";
const localStorageItemName = "JNodes.Settings.ExtensionManager.Extensions";

// We have to do this stuff outside of the extension initialization to avoid any disabled extensions being initialized

function setExtensionToDummy(extensionName) {

    const dummyExtension = { name: extensionName };

    const existingExtensionIndex = app.extensions.findIndex((ext) => ext.name === extensionName);

    if (existingExtensionIndex !== -1) { // If the extension already exists, remove it from the app's list

        app.extensions[existingExtensionIndex] = dummyExtension;

    } else { // Otherwise add a dummy one with the given name to prevent the real thing from being initialized

        app.registerExtension(dummyExtension);
    }
}

// This function does not use the ConfigSetting class because it may or may not be initialized when this runs
function loadExtensionBlockList() {

    let currentBlockList = [];
    let currentListString = localStorage.getItem(localStorageItemName);
    if (currentListString) {
        currentBlockList = JSON.parse(currentListString);
    }

    return currentBlockList;
}

console.log("Pre-Init JNodes ExtensionManager");

for (const extensionName of loadExtensionBlockList()) {
    console.log("JNodes ExtensionManager: blocking " + extensionName);
    setExtensionToDummy(extensionName);
}

// This function does not use the ConfigSetting class because it may or may not be initialized when this runs
// newState == true means the extension should be enabled and therefore NOT on the block list
function onChangeExtensionEnabledState(extensionName, newState) {

    let currentBlockList = loadExtensionBlockList();

    if (!newState == true && !currentBlockList.includes(extensionName)) {
        currentBlockList.push(extensionName); // Add to block list
    } else if (newState && currentBlockList.includes(extensionName)) {
        currentBlockList.splice(extensionName, 1); // Remove from block list
    }

    localStorage.setItem(localStorageItemName, JSON.stringify(currentBlockList));
}

function createExtensionManagerWidget() {
    const container = $el("div", {
        style: {
            maxHeight: "200px",
            overflowY: "scroll",
        },
    });

    let extensionNames = [];
    for (const extension of app.extensions) {
        if (extension.name === extensionManagerName) { continue; }
        extensionNames.push(extension.name);
    }

    extensionNames.sort((a, b) => {
        return a.localeCompare(b);
    });

    let currentBlockList = loadExtensionBlockList();

    for (const name of extensionNames) {
        let options = new options_LabeledCheckboxToggle();
        options.bPlaceLabelAfterMainElement = true;
        options.checked = !currentBlockList.includes(name);
        options.labelTextContent = name;
        options.onchange = (e) => { onChangeExtensionEnabledState(name, e.target.checked); };
        container.appendChild(createLabeledCheckboxToggle(options));
    }

    return container;
}

app.registerExtension({
    name: extensionManagerName,
    async setup() {
        console.log("setup JNodes.ExtensionManager");

        // Create Settings Widget
        {
            const labelWidget = $el("label", {
                textContent: "Extension Management:",
            });

            const settingWidget = createExtensionManagerWidget();

            const tooltip = "Deselect any unwanted web extensions to disable them. Select them again to re-enable them. Refresh your browser to see changes. Be extremely careful which extensions you disable.";
            addJNodesSetting(labelWidget, settingWidget, tooltip);
        }

    }
});