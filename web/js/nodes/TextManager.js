import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";
import { utilitiesInstance } from "../common/Utilities.js";
import { SearchBar } from "../common/SearchBar.js";
import {$el} from "/scripts/ui.js";

// Node that loads and saves texts with concatenation, favorites, and live edits

const outputTextMinHeight = 50;
const outputTextMaxHeight = 300;
const outputTextAutoHeightPercentage = 0.15;

const maxContainerTextAreaHeight = 300;

const changedColor = "#5f2573ff";
const unchangedColor = "#222";
const dynamicOnColor = "#4a9eff"; // pleasant blue for dynamic toggle

const longPressDuration = 700; // ms
const longPressCTA = `Hold the button for ${longPressDuration}ms to affect only visible items.`;

const priorityMin = -99;
const priorityMax = 100;

function getChangedUnchangedColor(bIsChanged) {
    return bIsChanged ? changedColor : unchangedColor;
}

function tintButton(button, color) {
    button.style.backgroundColor = color;
}

function clearTint(button) {
    button.style.backgroundColor = button.origBackgroundColor || "";
}

// Sanitize string for filename 
function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);
}

async function saveText(path, text) {
    // Save backup
    {
        // Load the previous file (because I don't want to write a new api hook to copy)
        const resp = await api.fetchApi(
            '/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }), cache: "no-store" });
        const asJson = await resp?.json();

        // Try to save a backup as .bak but don't worry about verifying it
        if (asJson?.payload) {
            const resp = await api.fetchApi(
                '/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path + ".bak", "text": asJson.payload }), cache: "no-store" });
        }
    }

    // Then save the new text
    const resp = await api.fetchApi(
        '/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path, "text": text }), cache: "no-store" });
    const asJson = await resp?.json();
    return asJson?.success;
}

async function loadText(path) {
    const resp = await api.fetchApi(
        '/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }), cache: "no-store" });
    const asJson = await resp?.json();

    return asJson?.success ? asJson.payload : null;
}

async function deleteText(path) {
    const resp = await api.fetchApi(
        '/jnodes_delete_item', { method: "DELETE", body: JSON.stringify({ "path": path }), cache: "no-store" });
    const asJson = await resp?.json();

    return { 
        bWasSuccessful: asJson?.success, 
        bIsValidFile: !asJson.message.includes("is not a valid file")
    };
}

async function getSavedTextFiles(path, recursive = false, extensionFilter = "json") {
    
    const resp = await api.fetchApi(
        '/jnodes_find_files', { 
            method: "POST", body: JSON.stringify({
                 "path": path, "recursive": recursive, "extension": extensionFilter
            }), cache: "no-store" 
        });
    const asJson = await resp?.json();
    return asJson?.success ? asJson.files : [];
}

function createToolButtonsGrid(container, params) {

    if (!container) {
        container = $el("div", {
            style: {
                position: "absolute",
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                border: "1px solid #888",
                backgroundColor: "rgba(0,0,0,0.5)",
                overflow: "hidden",
                borderRadius: "4px",
                fontFamily: "Arial, sans-serif",
                color: "white",
            }
        });
    }

    container.toggleCollapseAllButton = $el("button", {
        textContent: "Toggle Collapsed All",
        title: params.toggleCollapseAllButton.title,
        onpointerdown: params.toggleCollapseAllButton.onpointerdown,
        onpointerup: params.toggleCollapseAllButton.onpointerup,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    container.toggleEnableAllButton = $el("button", {
        textContent: "Toggle Enabled All",
        title: params.toggleEnableAllButton.title,
        onpointerdown: params.toggleEnableAllButton.onpointerdown,
        onpointerup: params.toggleEnableAllButton.onpointerup,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    container.toggleDynamicAllButton = $el("button", {
        textContent: "Toggle Dynamic All",
        title: params.toggleDynamicAllButton.title,
        onpointerdown: params.toggleDynamicAllButton.onpointerdown,
        onpointerup: params.toggleDynamicAllButton.onpointerup,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    container.saveAllButton = $el("button", {
        textContent: "Save All",
        title: params.saveAllButton.title,
        onpointerdown: params.saveAllButton.onpointerdown,
        onpointerup: params.saveAllButton.onpointerup,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    container.saveAllButton.origBackgroundColor = container.saveAllButton.style.backgroundColor;
    container.reloadButton = $el("button", {
        textContent: "Reload All",
        title: params.reloadButton.title,
        onclick: params.reloadButton.onclick,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });

    // Set Group All compound element (button + numerical spinner)
    container.setGroupAllCompound = $el("div", {
        style: {
            display: "flex",
            alignItems: "center",
            gap: "2px",
        }
    });

    container.setGroupAllButton = $el("button", {
        textContent: "Set Group All",
        title: params.setGroupAllButton.title,
        onpointerdown: params.setGroupAllButton.onpointerdown,
        onpointerup: params.setGroupAllButton.onpointerup,
        style: {
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontSize: "10px",
        }
    });

    const groupAllSpinner = utilitiesInstance.createNumericalSpinner(
        "",
        "Group value to apply to all text containers",
        (e) => { /* placeholder - function TBD */ },
        0, 100, 1, 0, 6.5
    );
    container.setGroupAllInput = groupAllSpinner.input;

    container.setGroupAllCompound.appendChild(container.setGroupAllButton);
    container.setGroupAllCompound.appendChild(groupAllSpinner.container);

    function buildShowWidget() {
        const properties = [
            { name: "enabled", emoji: "✅" },
            { name: "changed", emoji: "✏️" },
            { name: "favorite", emoji: "⭐" },
            { name: "dynamic", emoji: "÷" },
        ];

        // Create flex container
        const showContainer = $el("div");
        showContainer.style.display = "flex";
        showContainer.style.alignItems = "center";
        showContainer.style.gap = "2px"

        // Add "Show:" label
        const label = $el("label");
        label.textContent = "Show: ";
        label.style.fontSize = "10px";
        showContainer.appendChild(label);

        container.showButtons = [];
        // Create buttons for each property
        properties.forEach(prop => {
            const btn = $el("button");
            btn.textContent = prop.emoji;
            btn.title = `Toggle search for ${prop.name}==true${params.showWidget.titleAppendage}`;
            btn.style.cursor = "pointer";
            btn.style.fontSize = "10px";

            btn.addEventListener("click", 
                () => params.showWidget.toggleShowProperty(prop.name));
            container.showButtons.push(btn);

            showContainer.appendChild(btn);
        });

        return showContainer;
    }

    const toolButtonsGrid = $el("div", {
        style: {
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "2px",
            rowGap: "2px",
        }
    }, [
        container.toggleCollapseAllButton,
        container.toggleEnableAllButton,
        container.toggleDynamicAllButton,
        container.saveAllButton,
        container.reloadButton,
        container.setGroupAllCompound,
        buildShowWidget()
    ]);

    return toolButtonsGrid;
}

class TextContainer {
    constructor(args) {
        this.node = null;

        this.container = null;
        this.titleInput = null;
        this.textInput = null;
        this.contentArea = null;

        this.enabledSwitch = null;

        this.collapseBtn = null;
        this.bIsCollapsed = false;

        this.favoriteButton = null;
        this.bIsFavorite = false;

        this.priorityInput = null;

        this.makeDynamicSwitch = null;
        this.frequencyInput = null;
        this.groupInput = null;

        this.filename = "";
        this.referenceText = "";

        this.defaultTitle = "New Text";

        this.jsonFieldMap = {
            title: 'titleInput.value',
            text: 'textInput.value',
            bIsFavorite: 'bIsFavorite',
            priorityValue: 'priorityInput.value',
        };

    }

    updateContainerColor(bUpdateSaveAllButton = true) {
        const bHasChanged = this.hasChanged();
        this.container.style.backgroundColor = 
            getChangedUnchangedColor(bHasChanged);

        if (bUpdateSaveAllButton) {
            // Force the save all button into a changed state if this
            // text container is considered changed. Otherwise, let the
            // save all button figure it out for itself
            this.node.textListWidget.updateSaveAllButtonBackgroundColor(
                bHasChanged ? true : null
            );
        }
    }

    isVisible() {
        return this.container.style.display !== "none";
    }

    hasChanged() {
        // If no filename, it's a new container
        return !this.filename || this._makeReferenceText() !== this.referenceText;
    }

    _makeReferenceText() {
        return `${this.titleInput.value} ${this.textInput.value}`;
    }

    updateReferenceText(bUpdateSaveAllButton = true) {
        this.referenceText = this._makeReferenceText();

        this.updateContainerColor(bUpdateSaveAllButton);
    }

    _setPropertyByPath(path, value) {
        const parts = path.split('.');
        let obj = this;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
            if (!obj) return;
        }
        obj[parts[parts.length - 1]] = value;
    }

    async reloadText(bUpdateConfig = true) {
        const relativePath = utilitiesInstance.joinPaths(
            [this.node.saved_texts_path_widget.value, this.filename]
        );

        let loadedText;
        try {
            loadedText = await loadText(relativePath);
        } catch (err) {
            console.warn("Could not load text:", err);
            return false;
        }

        if (!loadedText) return false;

        let asJson;
        try {
            asJson = JSON.parse(loadedText);
        } catch (err) {
            console.warn("Failed to parse JSON:", err);
            return false;
        }

        // Iterate over the map
        for (const [key, propPath] of Object.entries(this.jsonFieldMap)) {
            if (asJson.hasOwnProperty(key)) {
                this._setPropertyByPath(propPath, asJson[key]);
            }
        }

        if (this.textInput) {
            utilitiesInstance.autoResizeTextArea(this.textInput, maxContainerTextAreaHeight);
        }

        this.updateReferenceText();
        this.updateFavoriteButtonColor();

        if (bUpdateConfig) {
            this.node.scheduleUpdate();
        }

        return true;
    }

    async updateJsonFields(fieldsToUpdate = {}) {
        if (!fieldsToUpdate || Object.keys(fieldsToUpdate).length === 0) {
            return false;
        }

        const relativePath = utilitiesInstance.joinPaths(
            [this.node.saved_texts_path_widget.value, this.filename]
        );

        let currentData = {};

        // Attempt to load existing JSON
        try {
            const loadedText = await loadText(relativePath);
            if (loadedText) {
                currentData = JSON.parse(loadedText);
            }
        } catch (err) {
            console.warn("No existing JSON found or failed to parse. Will remain transient.");
            this.updateReferenceText();
            this.node.scheduleUpdate();
            return;
        }

        // Merge/update only the specified fields
        Object.assign(currentData, fieldsToUpdate);

        // Save back to file
        const bSuccess = await saveText(relativePath, JSON.stringify(currentData, null, 2));

        if (bSuccess) {
            this.updateReferenceText();
            this.node.scheduleUpdate();
        }

        return bSuccess;
    }

    generateTitleAndFilenameIfNeeded() {

        // Generate a title if needed with auto capitalization, 
        // first 40 characters only, don't cut off words
        if (!this.titleInput.value || this.titleInput.value === this.defaultTitle) {
            const text = this.textInput.value.trim();

            if (text) {
                const MAX = 40;

                const sliced = text.slice(0, MAX);
                const cutoff = sliced.lastIndexOf(" ");

                this.titleInput.value =
                    (cutoff > 20 ? sliced.slice(0, cutoff) : sliced)[0].toUpperCase() +
                    (cutoff > 20 ? sliced.slice(0, cutoff) : sliced).slice(1);
            }
        }

        // If we don't have a filename, generate one
        if (!this.filename) {

            const generatedId =
                crypto.randomUUID
                    ? crypto.randomUUID().slice(0, 8)
                    : Math.random().toString(36).slice(2, 10);

            // If no title, use default. Then slugify + generatedId.
            this.filename = 
                `${slugify(this.titleInput.value.trim() || this.defaultTitle)}__${generatedId}.json`;
        }
    }

    _getPropertyByPath(path) {
        const parts = path.split('.');
        let obj = this;
        for (let part of parts) {
            if (!obj) return undefined;
            obj = obj[part];
        }
        return obj;
    }

    gatherConfigData() {
        const data = {};

        for (const [key, propPath] of Object.entries(this.jsonFieldMap)) {
            data[key] = this._getPropertyByPath(propPath);
        }

        return data;
    }

    serialize() {
        const data = this.gatherConfigData();

        return JSON.stringify(data, null, 2);
    }

    async serializeToFile() {

        const serializedString = this.serialize();

        if (!serializedString) { return; }

        let relativePath = this.node.saved_texts_path_widget.value;

        this.generateTitleAndFilenameIfNeeded();

        relativePath = utilitiesInstance.joinPaths([relativePath, this.filename]);

        const bSuccess = await saveText(relativePath, serializedString);

        if (bSuccess) {
            this.updateReferenceText();
            
            // Update node config with current state
            this.node.updateConfigValue(this.filename, {
                bIsEnabled: this.getEnabled(),
                bIsDynamicEnabled: this.getDynamic()
            });
            
            // Also save frequency and group values to node config if they have values
            if (this.frequencyInput && this.frequencyInput.value !== "") {
                const freqValue = Number(this.frequencyInput.value);
                if (!isNaN(freqValue)) {
                    this.node.updateConfigValue(this.filename, { frequencyValue: freqValue });
                }
            }
            
            if (this.groupInput && this.groupInput.value !== "") {
                const groupValue = Number(this.groupInput.value);
                if (!isNaN(groupValue)) {
                    this.node.updateConfigValue(this.filename, { groupValue: groupValue });
                }
            }
        }

        return bSuccess;
    }

    duplicateContainer() {
        let params = this.getDefaultContainerParams();

        params.bStartCollpased = false;
        params.title = this.titleInput.value;
        params.text = this.textInput.value;
        
        // Copy enabled state
        params.bIsEnabled = this.getEnabled();
        
        // Copy favorite state
        if (this.bIsFavorite) {
            params.bIsFavorite = true;
        }
        
        // Copy priority value
        if (this.priorityInput && this.priorityInput.value !== "") {
            params.priorityValue = Number(this.priorityInput.value);
        }
        
        // Copy dynamic state
        if (this.getDynamic()) {
            params.bIsDynamicEnabled = true;
        }
        
        // Always copy frequency value if set, regardless of dynamic state
        if (this.frequencyInput && this.frequencyInput.value !== "") {
            params.frequencyValue = Number(this.frequencyInput.value);
        }
        
        // Always copy group value if set, regardless of dynamic state
        if (this.groupInput && this.groupInput.value !== "") {
            params.groupValue = Number(this.groupInput.value);
        }

        const insertAt = 
            Array.from(this.container.parentNode.children).indexOf(this.container);

        const textContainerInstance = new TextContainer();
        const newContainer = textContainerInstance.createTextContainer(this.node, params);
        
        this.node.textListWidget.addChildWidget(newContainer, insertAt);
    }

    updateFavoriteButtonColor() {

        if (this.bIsFavorite) {
            tintButton(this.favoriteButton, 
                getChangedUnchangedColor(this.bIsFavorite)
            );
        } else {
            clearTint(this.favoriteButton);
        }
    }

    toggleFavoriteContainer() {
        this.bIsFavorite = !this.bIsFavorite;

        this.updateJsonFields({bIsFavorite: this.bIsFavorite});
        this.updateFavoriteButtonColor();
    }

    async deleteContainer() {
        
        let bRemoveContainer = true;

        // Try to delete the text file from disk
        if (this.filename) {
            const relativePath = utilitiesInstance.joinPaths(
                [this.node.saved_texts_path_widget.value, this.filename]);

            const result = await deleteText(relativePath);

            // Widget can be removed if the file was removed or never existed
            bRemoveContainer = result.bWasSuccessful || !result.bIsValidFile;
        }

        // Remove widget
        if (bRemoveContainer) {

            this.setEnabled(false); // Disable first

            // Update save all button highlight next frame
            const textListWidget = this.node.textListWidget;

            // Remove widget
            this.node.textListWidget.removeChildWidget(this.container); 

            // Force layout
            void this.node.textListWidget.scrollArea.offsetHeight;

            setTimeout(() => {
                textListWidget.updateSaveAllButtonBackgroundColor();
            }, 100);

        }
    }

    setPriorityValue(newValue) {
        this.priorityInput.value = utilitiesInstance.clamp(newValue, priorityMin, priorityMax);

        this.updateJsonFields({ priorityValue: this.priorityInput.value });

        // Rebind to re-order
        if (this.node.isTextContainerBound(this)) {
            this.node.unbindTextContainer(this);
            this.node.bindTextContainer(this);
        }
    }

    setFrequencyValue(newValue, bUpdateConfig = true) {
        this.frequencyInput.value = utilitiesInstance.clamp(newValue, priorityMin, priorityMax);

        if (bUpdateConfig) {
            this.node.updateConfigValue(this.filename, { frequencyValue: this.frequencyInput.value });
        }
    }

    setGroupValue(newValue, bUpdateConfig = true) {
        this.groupInput.value = utilitiesInstance.clamp(newValue, priorityMin, priorityMax);

        if (bUpdateConfig) {
            this.node.updateConfigValue(this.filename, { groupValue: this.groupInput.value });
        }
    }

    getDefaultContainerParams() {
        return {
            title: this.defaultTitle, 
            text: "", 
            bStartCollpased: true, 
            filename: null,
            bUpdateSaveAllButton: true
        }
    }

    createTextContainer(node, containerParams = this.getDefaultContainerParams()) {

        const containerParamsToUse = this.getDefaultContainerParams();

        Object.assign(containerParamsToUse, containerParams);

        this.node = node;

        if (containerParamsToUse.filename)
        {
            this.filename = containerParamsToUse.filename;
        }

        // Outer container
        this.container = $el("div", {
            style: {
                padding: "4px",
                border: "1px solid #444",
                borderRadius: "3px",
                backgroundColor: this.unchangedColor,
                display: "flex",
                flexDirection: "column",
                gap: "4px"
            }
        });
        this.container.data = this;
        this.container.getSearchTerms = function() {
            return this.data.getSearchTerms();
        };

        const buildToolbar = () => {

            const toolbar = $el("div", {
                style: {
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "2px",
                    rowGap: "2px",
                }
            });

            // Left side tools
            const leftSideTools = $el("div", {
                style: {
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    flexWrap: "wrap",
                    rowGap: "2px",
                }
            });

            // Enable switch
            const enableToggleStruct = utilitiesInstance.createSliderToggle(
                () => {

                    this.generateTitleAndFilenameIfNeeded();
                    node.bindTextContainer(this);
                },
                () => {

                    node.unbindTextContainer(this);
                },
                { vertical: true, height: 30, width: 15, padding: "0px 4px", offset: 3 }
            );
            this.enabledSwitch = enableToggleStruct.switch;
            leftSideTools.appendChild(enableToggleStruct.container);
            
            // Save button
            leftSideTools.appendChild($el("button", {
                onclick: () => {

                    this.serializeToFile();
                },
                textContent: "💾",
                title: "Save Text"
            }));
            // Reload button
            leftSideTools.appendChild($el("button", {
                onclick: async () => {

                    await this.reloadText();
                },
                textContent: "↻",
                title: "Reload Text"
            }));
            // Duplicate button
            leftSideTools.appendChild($el("button", {
                onclick: async () => {

                    await this.duplicateContainer();
                },
                textContent: "🗐",
                title: "Duplicate Text Container"
            }));
            // Favorite button
            this.favoriteButton = $el("button", {
                onclick: async () => {

                    await this.toggleFavoriteContainer();
                },
                textContent: "⭐",
                title: "Favorite Text Container"
            });
            this.favoriteButton.origBackgroundColor = this.favoriteButton.style.backgroundColor;
            leftSideTools.appendChild(this.favoriteButton);
            // Delete button
            const deleteButton = $el("button", {
                onclick: async () => {

                    if (!deleteButton.bConfirmDelete) {
                        deleteButton.bConfirmDelete = true;
                        deleteButton.textContent = "❓";
                        deleteButton.title = "Click again to confirm delete";
                    } else {
                        await this.deleteContainer();
                    }
                }
            });
            deleteButton.resetTextAndTitle = function () {
                deleteButton.textContent = "❌";
                deleteButton.title = "Delete Text Container";
            };
            deleteButton.bConfirmDelete = false;
            deleteButton.resetTextAndTitle();
            leftSideTools.appendChild(deleteButton);

            toolbar.appendChild(leftSideTools);

            // Right side tools
            const rightSideTools = $el("div", {
                style: {
                    display: "flex",
                    alignItems: "center",
                    marginLeft: "auto",
                    flexWrap: "wrap",
                    gap: "2px",
                    rowGap: "2px",
                }
            });

            // Priority
            const prioritySpinner = utilitiesInstance.createNumericalSpinner(
                "P: ", 
                "Set a priority index for this container. " +
                "Higher valued containers are sorted first.",
                (e) => {
                    this.setPriorityValue(e.target.value);
                },
                priorityMin, priorityMax, 1, 0
            );
            this.priorityInput = prioritySpinner.input;
            rightSideTools.appendChild(prioritySpinner.container);

            const dynamicPromptTools = $el("div", {
                style: {
                    display: "none",
                    alignItems: "center",
                    marginLeft: "auto",
                    flexWrap: "wrap",
                    gap: "2px",
                    rowGap: "2px",
                }
            });

            // Dynamic Prompt Frequency
            const frequencySpinner = utilitiesInstance.createNumericalSpinner(
                "F: ", 
                "Set a dynamic prompt frequency for this container. " +
                "If you're using JNodes ParseDynamicPrompts, " +
                "these frequencies will cause the prompt to be more likely to be selected.",
                (e) => {
                    this.setFrequencyValue(e.target.value);
                },
                0.0, 10.0, 0.05, 1.0, 7 // width
            );
            this.frequencyInput = frequencySpinner.input;
            dynamicPromptTools.appendChild(frequencySpinner.container);

            // Dynamic Prompt Group
            const groupSpinner = utilitiesInstance.createNumericalSpinner(
                "G: ", 
                "Set a dynamic prompt group for this container. " +
                "All text containers in the same group will be added " +
                "to a dynamic prompt group. " +
                "Higher valued groups are sorted first.",
                (e) => {
                    this.setGroupValue(e.target.value);
                },
                0, 100, 1, 0, 6.5
            );
            this.groupInput = groupSpinner.input;
            dynamicPromptTools.appendChild(groupSpinner.container);

            rightSideTools.appendChild(dynamicPromptTools);

            // Make Dynamic switch
            const makeDynamicToggleStruct = utilitiesInstance.createSliderToggle(
                () => { 
                    dynamicPromptTools.style.display = "flex"; 
                    node.updateConfigValue(this.filename, { bIsDynamicEnabled: true});
                },
                () => { 
                    dynamicPromptTools.style.display = "none";
                    node.updateConfigValue(this.filename, { bIsDynamicEnabled: false}); 
                },
                { 
                    vertical: true, height: 30, width: 15, 
                    padding: "0px 4px", offset: 3, onColor: dynamicOnColor
                }
            );
            this.makeDynamicSwitch = makeDynamicToggleStruct.switch;
            makeDynamicToggleStruct.container.title = 
                "Enable to create a dynamic prompt group using this text " +
                "and any other text in the same dynamic prompt group whose " +
                "dynamic switch is also enabled.";
            rightSideTools.appendChild(makeDynamicToggleStruct.container);

            toolbar.appendChild(rightSideTools);

            return toolbar;
        };

        this.toolbar = buildToolbar();

        this.container.appendChild(this.toolbar);

        const header = $el("div", {
            style: {
                display: "flex",
                alignItems: "center",
                gap: "4px"
            }
        });

        // Title input
        this.titleInput = $el("input", {
            id: "TextManagerTitleInput",
            value: containerParamsToUse.title,
            style: {
                flex: "1",
                padding: "4px",
                borderRadius: "3px",
                border: "1px solid #555",
                outline: "none",
                fontSize: "12px",
                background: "#111",
                color: "#eee",
            }
        });

        this.titleInput.addEventListener('focus', () => {
            node.setLastFocusedTextContainer(this);
        });

        // Collapse button
        this.collapseBtn = $el("button", {
            textContent: "▼", // will rotate when collapsed
            title: "Collapse / Expand",
            onclick: () => this.toggleCollapse(),
            style: {
                cursor: "pointer",
                border: "1px solid #555",
                background: "#333",
                color: "#eee",
                borderRadius: "3px",
                padding: "2px 6px",
                fontSize: "12px",
            }
        });

        header.appendChild(this.titleInput);
        header.appendChild(this.collapseBtn);

        this.contentArea = $el("div", {
            style: {
                display: "flex",
                flexDirection: "column"
            }
        });

        // Text Input
        this.textInput = $el("textarea", {
            value: containerParamsToUse.text,
            style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "4px",
                borderRadius: "3px",
                border: "1px solid #555",
                outline: "none",
                resize: "none",
                background: "#111",
                color: "#eee",
                fontSize: "12px"
            }
        });

        // Resize the new container's text area to match its content on next frame
        requestAnimationFrame(() => {
            if (this.textInput) {
                utilitiesInstance.autoResizeTextArea(
                    this.textInput, maxContainerTextAreaHeight);
            }
        });

        // On title focused or changed
        this.titleInput.addEventListener('focus', () => {
            node.setLastFocusedTextContainer(this);
        });
        this.titleInput.addEventListener("input", () => {

            this.updateContainerColor();
        });

        // On text focused or changed
        this.textInput.addEventListener('focus', () => {
            node.setLastFocusedTextContainer(this);
        });
        this.textInput.addEventListener("input", () => {

            if (this.node.isTextContainerBound(this)) {
                this.node.updateOutputText();
            }

            this.updateContainerColor();
            utilitiesInstance.autoResizeTextArea(
                this.textInput, maxContainerTextAreaHeight);
        });

        this.contentArea.appendChild(this.textInput);

        // Add to main container
        this.container.appendChild(header);
        this.container.appendChild(this.contentArea);

        this.container.data = this;

        if (containerParamsToUse.bStartCollpased && !this.bIsCollapsed)
        {
            this.toggleCollapse();
        }
        
        this.updateReferenceText(containerParams.bUpdateSaveAllButton);

        if (containerParams.bIsFavorite) {
            this.toggleFavoriteContainer();
        }
        
        // Apply priority value if provided (no config update - container has no filename yet)
        if (containerParams.priorityValue !== undefined && containerParams.priorityValue !== null) {
            this.setPriorityValue(containerParams.priorityValue);
        }
        
        // Apply dynamic state if provided
        if (containerParams.bIsDynamicEnabled === true) {
            this.setDynamic(true);
        }
        
        // Always apply frequency value if set, regardless of dynamic state
        if (containerParams.frequencyValue !== undefined && containerParams.frequencyValue !== null) {
            this.setFrequencyValue(containerParams.frequencyValue, false);
        }
        
        // Always apply group value if set, regardless of dynamic state
        if (containerParams.groupValue !== undefined && containerParams.groupValue !== null) {
            this.setGroupValue(containerParams.groupValue, false);
        }
        
        // Apply enabled state if provided
        if (containerParams.bIsEnabled !== undefined) {
            this.setEnabled(containerParams.bIsEnabled);
        }

        return this.container;
    }

    setEnabled(bNewState) {
        
        if (this.getEnabled() != bNewState) {
            this.enabledSwitch.click();
        }
    }

    getEnabled() {

        return this.enabledSwitch.bIsOn;
    }

    setDynamic(bNewState) {
        
        if (this.getDynamic() != bNewState) {
            this.makeDynamicSwitch.click();
        }
    }

    getDynamic() {

        return this.makeDynamicSwitch.bIsOn;
    }

    // Required for search
    getSearchTerms() {
        const frequencyValue = this.frequencyInput && this.frequencyInput.value !== "" 
            ? Number(this.frequencyInput.value) : null;
        const groupValue = this.groupInput && this.groupInput.value !== "" 
            ? Number(this.groupInput.value) : null;
        
        return `${this.titleInput.value} ${this.textInput.value}` +
            ` enabled==${this.getEnabled()}` +
            ` changed==${this.hasChanged()}` +
            ` favorite==${this.bIsFavorite}` +
            ` dynamic==${this.getDynamic()}` +
            ` priority==${Number(this.priorityInput.value)}` +
            (frequencyValue !== null ? ` frequency==${frequencyValue}` : "") +
            (groupValue !== null ? ` group==${groupValue}` : "");
    }

    toggleCollapse() {
        this.setIsCollapsed(!this.bIsCollapsed);
    }

    setIsCollapsed(bNewState) {

        this.bIsCollapsed = bNewState;

        if (bNewState) {
            this.contentArea.style.display = "none";
            this.collapseBtn.textContent = "▶"; // collapsed arrow
        } else {
            this.contentArea.style.display = "flex";
            this.collapseBtn.textContent = "▼"; // expanded arrow

            requestAnimationFrame(() => {
                utilitiesInstance.autoResizeTextArea(
                    this.textInput, maxContainerTextAreaHeight);
            });
        }
    }
}

function createTextListWidget(node) {
    // Create container DOM
    const container = $el("div", {
        style: {
            position: "absolute",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            border: "1px solid #888",
            backgroundColor: "rgba(0,0,0,0.5)",
            overflow: "hidden",
            borderRadius: "4px",
            fontFamily: "Arial, sans-serif",
            color: "white",
        }
    });

    container.showLoadingScreen = function(bShouldShow) {

        if (bShouldShow) {
            container.loadingScreen = $el("div", {
                textContent: "Loading...",
                style: {
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0,0,0,0.9)",

                    display: "flex",
                    justifyContent: "center",   // horizontal
                    alignItems: "center",       // vertical

                    color: "white",
                    fontSize: "20px"
                }
            });

            container.appendChild(container.loadingScreen);
        } else {
            if (container.loadingScreen) {
                container.removeChild(container.loadingScreen);
                container.loadingScreen = null;
            }
        }
    };

    // Declaring this up here for the functionn immediately below
    const searchInstance = new SearchBar(node);
    container.searchInstance = searchInstance;

    // Add functions
    container.setAllTextContainersCollapsed = function (
        bNewState, withFilename = null, bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (withFilename && textContainer.filename !== withFilename) { continue; }

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }
            
            textContainer.setIsCollapsed(bNewState);
            
            if (withFilename) { break; } // If withFilename matches, break early
        }
    };
    container.doesContainerExist = function(containerFilename) {

        if (!containerFilename) { return false; }

        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (containerFilename && textContainer.filename === containerFilename) { 
                return true; 
            }
        }

        return false;
    };
    container.hasAnyExpandedTextContainers = function() {
        let bShouldCollapse = false;
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (!textContainer.bIsCollapsed) { 
                bShouldCollapse = true; 
                break;
            }
        }

        return bShouldCollapse;
    };
    container.toggleAllTextContainersCollapsed = function(withFilename = null, bOnlyVisible = false) {

        // First determine whether we need to expand or collapse all
        let bShouldCollapse = container.hasAnyExpandedTextContainers();

        // Then execute
        container.setAllTextContainersCollapsed(bShouldCollapse, withFilename, bOnlyVisible);
    }
    container.setAllTextContainersEnabledState = function (
        bNewState, withFilename = null, bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (withFilename && textContainer.filename !== withFilename) { continue; }

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }
            
            textContainer.setEnabled(bNewState);
            
            if (withFilename) { break; } // If withFilename matches, break early
        }
    };
    container.hasAnyEnabledTextContainers = function(bOnlyVisible = false) {
        // First determine whether we need to enable or disable all
        let bHasAnyEnabled = false;
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }

            if (textContainer.getEnabled()) { 
                bHasAnyEnabled = true; 
                break;
            }
        }

        return bHasAnyEnabled;
    };
    container.toggleAllTextContainersEnabledState = function(withFilename = null, bOnlyVisible = false) {
 
        // First determine whether we need to enable or disable all
        let bShouldDisable = container.hasAnyEnabledTextContainers(bOnlyVisible);
 
        // Then execute
        container.setAllTextContainersEnabledState(!bShouldDisable, withFilename, bOnlyVisible);
    }
    container.setAllTextContainersDynamicState = function (
        bNewState, withFilename = null, bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (withFilename && textContainer.filename !== withFilename) { continue; }

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }
            
            textContainer.setDynamic(bNewState);
            
            if (withFilename) { break; } // If withFilename matches, break early
        }
    };
    container.hasAnyDynamicTextContainers = function(bOnlyVisible = false) {
        // First determine whether we need to enable or disable all
        let bHasAnyDynamic = false;
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }

            if (textContainer.getDynamic()) { 
                bHasAnyDynamic = true; 
                break;
            }
        }

        return bHasAnyDynamic;
    };
    container.toggleAllTextContainersDynamicState = function(withFilename = null, bOnlyVisible = false) {
 
        // First determine whether we need to enable or disable all
        let bShouldDisable = container.hasAnyDynamicTextContainers(bOnlyVisible);
 
        // Then execute
        container.setAllTextContainersDynamicState(!bShouldDisable, withFilename, bOnlyVisible);
    }
    container.setAllTextContainersGroupValue = function(newGroupValue, bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }

            textContainer.setGroupValue(newGroupValue);
        }
    };
    container.saveAllChangedTextContainers = function (bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }
            
            if (textContainer.hasChanged()) {
                textContainer.serializeToFile();
            }
        }
        // Force Unchanged State
        container.updateSaveAllButtonBackgroundColor(false);
    };
    container.areAnyTextContainersChanged = function (bOnlyVisible = false) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (bOnlyVisible && !textContainer.isVisible()) { continue; }
            
            if (textContainer.hasChanged()) {
                return true;
            }
        }
        return false;
    };
    container.updateSaveAllButtonBackgroundColor = function (bForceChangedState = null) {

        // We can force the button to be in a specified changed state
        // If no state is specified, we evaluate all text containers
        const bShouldTint = 
            bForceChangedState ? bForceChangedState : 
                container.areAnyTextContainersChanged();

        if (bShouldTint) {
            tintButton(container.saveAllButton, 
                getChangedUnchangedColor(bShouldTint));
        } else {
            clearTint(container.saveAllButton);
        }
    };
    container.isPropertyFilterOn = (propertyName) => {
        return searchInstance.getSearchText().includes(`${propertyName}==`);
    };

    function createToolbar() {

        const addTextButton = $el("button", {
            textContent: "+ Add Text",
            title: "Click to add a new text widget (unsaved)",
            onclick: () => { 
                const lastFocusedTextContainer = node.lastFocusedTextContainer;
                const insertAt = lastFocusedTextContainer ? 
                    Array.from(lastFocusedTextContainer.container.parentNode.children)
                    .indexOf(lastFocusedTextContainer.container) 
                    : 0;
                container.addChildWidget(container.makeNewTextContainer(), insertAt);
            },
            style: {
                color: "#63e563",
                cursor: "pointer",
                whiteSpace: "nowrap", 
                fontSize: "10px",
            }
        });

        container.toolbarGridParams = {
            toggleCollapseAllButton: {
                title: "Collapse or expand all text containers. " +
                "If any are expanded, all will collapse. " +
                "If all are collapsed, all will expand." + " " + longPressCTA,
                onpointerdown: () => { container.toggleCollapseAllButton.pressStartTime = Date.now(); },
                onpointerup: () => { 
                    let bOnlyVisible = false;

                    if (container.toggleCollapseAllButton.pressStartTime) {
                        const duration = Date.now() - container.toggleCollapseAllButton.pressStartTime;
                        if (duration > longPressDuration) { bOnlyVisible = true; }
                    }
                    container.toggleAllTextContainersCollapsed(null, bOnlyVisible);
                },
            },
            toggleEnableAllButton: {
                title: "Enable or disable all text containers." +
                "If any are enabled, all will disabled. " +
                "If all are disabled, all will enabled." + " " + longPressCTA,
                onpointerdown: () => { container.toggleEnableAllButton.pressStartTime = Date.now(); },
                onpointerup: () => { 
                    let bOnlyVisible = false;

                    if (container.toggleEnableAllButton.pressStartTime) {
                        const duration = Date.now() - container.toggleEnableAllButton.pressStartTime;
                        if (duration > longPressDuration) { bOnlyVisible = true; }
                    }
                    container.toggleAllTextContainersEnabledState(null, bOnlyVisible);
                },
            },
            toggleDynamicAllButton: {
                title: "Toggle dynamic state for all text containers." +
                "If any are dynamic, all will become non-dynamic. " +
                "If all are non-dynamic, all will become dynamic." + " " + longPressCTA,
                onpointerdown: () => { container.toggleDynamicAllButton.pressStartTime = Date.now(); },
                onpointerup: () => { 
                    let bOnlyVisible = false;

                    if (container.toggleDynamicAllButton.pressStartTime) {
                        const duration = Date.now() - container.toggleDynamicAllButton.pressStartTime;
                        if (duration > longPressDuration) { bOnlyVisible = true; }
                    }
                    container.toggleAllTextContainersDynamicState(null, bOnlyVisible);
                },
            },
            saveAllButton: {
                title: "Save all changed text containers." + " " + longPressCTA,
                onpointerdown: () => { container.saveAllButton.pressStartTime = Date.now(); },
                onpointerup: () => { 
                    let bOnlyVisible = false;

                    if (container.saveAllButton.pressStartTime) {
                        const duration = Date.now() - container.saveAllButton.pressStartTime;
                        if (duration > longPressDuration) { bOnlyVisible = true; }
                    }
                    container.saveAllChangedTextContainers(bOnlyVisible);
                },
            },
            reloadButton: {
                title: "Reload all text containers",
                onclick: () => { 
                    node.reloadTexts();
                },
            },
            setGroupAllButton: {
                title: "Set group value for all text containers." + " " + longPressCTA,
                onpointerdown: () => { container.setGroupAllButton.pressStartTime = Date.now(); },
                onpointerup: () => {
                    let bOnlyVisible = false;

                    if (container.setGroupAllButton.pressStartTime) {
                        const duration = Date.now() - container.setGroupAllButton.pressStartTime;
                        if (duration > longPressDuration) { bOnlyVisible = true; }
                    }

                    const newGroupValue = Number(container.setGroupAllInput.value);
                    container.setAllTextContainersGroupValue(newGroupValue, bOnlyVisible);
                },
            },
            showWidget: {
                toggleShowProperty: function(propertyName) {
                    const regex = new RegExp(`${propertyName}==\\S*`);
                    let currentSearchText = searchInstance.getSearchText();

                    if (regex.test(currentSearchText)) {
                        // Remove property filter even if nothing comes after ==
                        currentSearchText = currentSearchText
                            .replace(regex, "")
                            .replace(/\s{2,}/g, " ")
                            .trim();
                    } else {
                        currentSearchText = currentSearchText + ` ${propertyName}==true`;
                    }

                    searchInstance.setSearchTextAndExecute(currentSearchText);
                },
                titleAppendage: "",
            }
        };

        const toolButtonsContainer = $el("div", {
            style: {
                display: "flex",
                justifyContent: "flex-end",
                gap: "2px",
                padding: "4px",
            }
        }, [
            createToolButtonsGrid(container, container.toolbarGridParams), addTextButton
        ]);

        return toolButtonsContainer;
    }
    container.appendChild(createToolbar());

    // Scrollable content area
    const scrollArea = $el("div", {
        style: {
            flex: "1",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
        }
    });
    container.scrollArea = scrollArea;

    const searchInput = searchInstance.createSearchBar(container.scrollArea);
    searchInput.addEventListener("searchexecuted", (event) => {
        node.onSearchExecuted(event.detail.searchText);
    });

    container.appendChild(searchInput);
    container.appendChild(scrollArea);

    document.body.appendChild(container);

    // Array of child widgets
    searchInstance.childWidgets = [];

    // Add functions
    function addChildWidget(childWidget, insertAt = null) {

        if (!childWidget) { return; }

        if (insertAt > -1 && insertAt < scrollArea.childNodes.length) {
            const referenceNode = container.scrollArea.childNodes[insertAt];
            container.scrollArea.insertBefore(childWidget, referenceNode); 
        } else {
            container.scrollArea.appendChild(childWidget);
        }
        searchInstance.childWidgets.push(childWidget);

    }
    container.addChildWidget = addChildWidget;

    function sortTextContainers(sortType = "title") {

        function sortWidgetChildrenByTitle() {
            const children = Array.from(container.scrollArea.children);

            children.sort((a, b) => {
                const titleA = a.data?.titleInput?.value ?? "";
                const titleB = b.data?.titleInput?.value ?? "";
                return titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
            });

            const bShouldClearSearchInstanceChildren = false;
            container.clearWidgets(bShouldClearSearchInstanceChildren);
 
            children.forEach(child => container.scrollArea.appendChild(child));
        }


        if (sortType == "title") {
            sortWidgetChildrenByTitle();
        }

    }
    container.sortTextContainers = sortTextContainers;

    function removeChildWidget(childWidget) {

        container.scrollArea.removeChild(childWidget);
        const index = searchInstance.childWidgets.indexOf(childWidget);
        if (index !== -1) {
            searchInstance.childWidgets.splice(index, 1);
        }
    }
    container.removeChildWidget = removeChildWidget;

    function makeNewTextContainer() {

        const textContainerInstance = new TextContainer();
        return textContainerInstance.createTextContainer(node);
    }
    container.makeNewTextContainer = makeNewTextContainer;

    function clearWidgets(bShouldClearSearchInstanceChildren = true) {
 
        container.scrollArea.replaceChildren();
        if (bShouldClearSearchInstanceChildren) {
            searchInstance.childWidgets = [];
        }
    }
    container.clearWidgets = clearWidgets;

    function setIsVisible(bNewSetting) {
        container.style.opacity = bNewSetting ? "1" : "0";
        container.style.pointerEvents = bNewSetting ? "auto" : "none";
    }
    container.setIsVisible = setIsVisible;

    function cleanupNode() {

        if (container) {
            container.remove();
        }
    }
    container.cleanupNode = cleanupNode;

    return container;
};

app.registerExtension({
	name: "JNodes.TextManager",

	// Before undo, create cache of node texts 
	async beforeConfigureGraph(graphData, missingNodeTypes) {

		for (const node of app.graph._nodes) {
			if (node?.type == "JNodes_TextManager" && node.textWidget.value) {
				caches[node.id] = node.textWidget.value;
			}
		}
	},
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "JNodes_TextManager") {

			const nodePrototype = nodeType.prototype;

			// Create Widgets when node is created
			const onNodeCreated = nodePrototype.onNodeCreated;
			nodePrototype.onNodeCreated = async function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

                const node = this;

                // Add/assign widgets
				this.uuidWidget = this.widgets[0];
                this.node_config_path_widget = this.widgets[1];
                this.saved_texts_path_widget = this.widgets[2];
				this.delimiterWidget = this.widgets[3];
				this.outputTextWidget = this.widgets[4];

                this.outputTextWidget.inputEl.readOnly = true;
                this.outputTextWidget.computeSize = function(width) {

                    const computedHeight = node.size[1] * outputTextAutoHeightPercentage; // Percentage of node height

                    return [width, utilitiesInstance.clamp(computedHeight, outputTextMinHeight, outputTextMaxHeight)];
                };

                // Create our list widget
                this.textListWidget = createTextListWidget(node);

                utilitiesInstance.makePannableWithMiddleMouse(this.textListWidget);

                const mainWidget = utilitiesInstance.addComfyNodeWidget(
                    node, this.textListWidget, "textlist", "textlist", {
                        serialize: false,
                        hideOnZoom: false,
                    });

                const onRemoved = node.onRemoved;
                node.onRemoved = () => {
                    if (node.textListWidget) {
                        node.textListWidget.cleanupNode();
                    }
                    return onRemoved?.();
                };

                this.saved_texts_path_widget.callback = () => {
                    node.reloadTexts();
                };

                this.delimiterWidget.callback = () => {
                    node.updateOutputText();
                };

                node.setLastFocusedTextContainer = function(inTextContainer) {

                    if (!inTextContainer) { return; }

                    node.lastFocusedTextContainer = inTextContainer;
                };

                // Text Building
                node.boundTextContainers = []; // Actual object pointers to containers
                node.updateOutputText = function() {

                    this.outputTextWidget.value = "";
                    const delimiter = utilitiesInstance.unescapeString(this.delimiterWidget.value);
                    
                    // Categorize bound containers into dynamic groups and standalone
                    const dynamicGroups = {}; // groupValue -> array of containers (only those that are enabled+dynamic with same group)
                    const standaloneContainers = [];
                    
                    for (let i = 0; i < node.boundTextContainers.length; i++) {
                        const container = node.boundTextContainers[i];
                        
                        // Get live values from the container inputs
                        const bIsDynamic = container.getDynamic();
                        let groupValue = null;
                        if (container.groupInput && container.groupInput.value !== "") {
                            groupValue = Number(container.groupInput.value);
                        }
                        
                        if (bIsDynamic && groupValue !== null && !isNaN(groupValue)) {
                            // Add to dynamic group
                            if (!dynamicGroups[groupValue]) {
                                dynamicGroups[groupValue] = [];
                            }
                            dynamicGroups[groupValue].push(container);
                        } else {
                            // Standalone container (not enabled+dynamic or no group value)
                            standaloneContainers.push(container);
                        }
                    }
                    
                    // Sort groups by highest priority container within each group (descending)
                    const sortedGroupValues = Object.keys(dynamicGroups).map(Number).sort((a, b) => {
                        const groupA = dynamicGroups[a];
                        const groupB = dynamicGroups[b];
                        
                        // Find max priority in each group
                        let maxPriorityA = 0, maxPriorityB = 0;
                        for (const c of groupA) {
                            const p = Number(c.priorityInput.value);
                            if (p > maxPriorityA) maxPriorityA = p;
                        }
                        for (const c of groupB) {
                            const p = Number(c.priorityInput.value);
                            if (p > maxPriorityB) maxPriorityB = p;
                        }
                        
                        return maxPriorityB - maxPriorityA; // descending
                    });
                    
                    // Build output string
                    let result = "";
                    const pieces = [];
                    
                    // Add dynamic groups with multiple containers first
                    for (const groupValue of sortedGroupValues) {
                        const groupContainers = dynamicGroups[groupValue];
                        
                        if (groupContainers.length > 1) {
                            // Sort container text within the group by priority descending, then by name for consistency
                            groupContainers.sort((a, b) => {
                                const aPriority = Number(a.priorityInput.value);
                                const bPriority = Number(b.priorityInput.value);
                                if (bPriority !== aPriority) return bPriority - aPriority;
                                return (a.titleInput.value || "").localeCompare(b.titleInput.value || "");
                            });
                            
                            // Build brace-enclosed list with frequency weights: {text1::weight1|text2::weight2...}
                            const groupItems = groupContainers.map(c => {
                                let itemStr = c.textInput.value;
                                if (c.frequencyInput && c.frequencyInput.value !== "") {
                                    const freqValue = Number(c.frequencyInput.value);
                                    if (!isNaN(freqValue) && freqValue !== 1.0) {
                                        itemStr += "::" + freqValue;
                                    }
                                }
                                return itemStr;
                            }).join("|");
                            pieces.push(`{${groupItems}}`);
                        } else if (groupContainers.length === 1) {
                            // Single container in "dynamic group" - treat as standalone
                            standaloneContainers.push(groupContainers[0]);
                        }
                    }
                    
                    // Add standalone containers by priority descending, then name for consistency
                    standaloneContainers.sort((a, b) => {
                        const aPriority = Number(a.priorityInput.value);
                        const bPriority = Number(b.priorityInput.value);
                        if (bPriority !== aPriority) return bPriority - aPriority;
                        return (a.titleInput.value || "").localeCompare(b.titleInput.value || "");
                    });
                    
                    for (const container of standaloneContainers) {
                        pieces.push(container.textInput.value);
                    }
                    
                    // Join with delimiter
                    result = pieces.join(delimiter);
                    
                    this.outputTextWidget.value = result;
                };

                node.isTextContainerBound = function(inTextContainer) {
                    return inTextContainer && node.boundTextContainers.includes(inTextContainer);
                };

                node.updateConfigValue = function(filename, updateObject) {
                    const cfg = node.ensureContainerConfig(filename);
                    Object.assign(cfg, updateObject);

                    node.scheduleUpdate();
                };

                node.bindTextContainer = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (!node.isTextContainerBound(inTextContainer)) {

                        // In-memory binding
                        node.boundTextContainers.push(inTextContainer);

                        // Sort descending by priority
                        node.boundTextContainers.sort((a, b) => {
                            const aVal = Number(a.priorityInput.value);
                            const bVal = Number(b.priorityInput.value);

                            const aNum = isNaN(aVal) ? priorityMin : aVal;
                            const bNum = isNaN(bVal) ? priorityMin : bVal;

                            return bNum - aNum;
                        });

                        // Persist enabled state
                        node.updateConfigValue(inTextContainer.filename, {bIsEnabled: true});
                    }
                };

                node.unbindTextContainer = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (node.isTextContainerBound(inTextContainer)) {

                        node.boundTextContainers =
                            node.boundTextContainers.filter(item => item !== inTextContainer);

                        const cfg = node.ensureContainerConfig(inTextContainer.filename);
                        cfg.bIsEnabled = false;

                        node.scheduleUpdate();
                    }
                };

                node.toggleTextContainerBound = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (node.isTextContainerBound(inTextContainer)) {

                        node.unbindTextContainer(inTextContainer);
                    } else {

                        node.bindTextContainer(inTextContainer);
                    }

                };

                // Config
                node.configParams = {
                    containers: {}, // filename -> state
                    searchText: "",
                };

                node.onSearchExecuted = function(searchText) {
                    node.configParams.searchText = searchText;
                    this.updateConfig();
                };

                node._updateScheduled = false;
                node.scheduleUpdate = function() {
                    if (node._updateScheduled) return; // already scheduled

                    node._updateScheduled = true;
                    requestAnimationFrame(() => {
                        node.updateOutputText();
                        node.updateConfig();
                        node._updateScheduled = false;
                    });
                };

                node.getConfigFullPath = function () {

                    return utilitiesInstance.joinPaths(
                        [this.node_config_path_widget.value, this.uuidWidget.value]
                    ) + ".config";
                }

                node.ensureContainerConfig = function(filename) {
                    if (!node.configParams.containers) {
                        node.configParams.containers = {};
                    }

                    if (!node.configParams.containers[filename]) {
                        node.configParams.containers[filename] = {};
                    }

                    return node.configParams.containers[filename];
                };

                node.updateConfig = function() {

                    if (!utilitiesInstance.isValidUUID(this.uuidWidget.value)) {
                        this.uuidWidget.value = utilitiesInstance.generateUUID();
                    }

                    const relativePath = node.getConfigFullPath();

                    saveText(relativePath, JSON.stringify(node.configParams, null, 2));
                };

                node.loadFromConfig = async function() {

                    try {
                        const relativePath = node.getConfigFullPath();

                        const configText = await loadText(relativePath);
                        if (!configText) { return; }

                        const savedParams = JSON.parse(configText);
                        // Merge saved config into defaults
                        Object.keys(savedParams).forEach(key => {
                            if (key in this.configParams) {
                                this.configParams[key] = savedParams[key];
                            }
                        });

                        // Remove container references that no longer exist 
                        node.pruneContainerConfig();

                        // Update bound text containers from config
                        const textContainersToBind = 
                            Object.entries(this.configParams.containers)
                            .filter(([_, cfg]) => cfg.bIsEnabled === true)
                            .map(([filename]) => filename);

                        for (const [filename, cfg] of Object.entries(this.configParams.containers)) {
                            const textContainer = this.textListWidget.searchInstance.childWidgets.find(
                                wid => wid.data.filename === filename
                            ).data;

                            if (textContainer) {
                                if (cfg.bIsDynamicEnabled === true) {
                                    textContainer.setDynamic(true);
                                }
                                if (cfg.frequencyValue !== undefined) {
                                    textContainer.setFrequencyValue(cfg.frequencyValue);
                                }
                                if (cfg.groupValue !== undefined) {
                                    textContainer.setGroupValue(cfg.groupValue);
                                }
                            }
                        }

                        //Reset
                        this.outputTextWidget.value = "";

                        for (const filename of textContainersToBind) {

                            this.textListWidget.setAllTextContainersEnabledState(true, filename);
                        }

                        node.textListWidget.searchInstance.setSearchText(this.configParams.searchText);

                        node.updateConfig();
                    } catch (e) {
                        console.log(e);
                    }
                };

                node.pruneContainerConfig = function() {
                    const containers = node.configParams.containers;

                    for (const [filename, cfg] of Object.entries(containers)) {
                        if (!node.textListWidget.doesContainerExist(filename)) {
                            delete containers[filename];
                        }
                    }
                };

                // Load texts
                node.reloadTextsFromPath = async function (path, recursive = false, extensionFilter = "json")
                {
                    // Show loading screen
                    node.textListWidget.showLoadingScreen(true);

                    // Create containers for all text files
                    const files = await getSavedTextFiles(path, recursive, extensionFilter);

                    node.textListWidget.clearWidgets();

                    // Reset relevant variables
                    node.boundTextContainers = [];
                    node.configParams.boundTextContainers = [];

                    const reloadPromises = [];

                    for (const file of files) {
                        
                        const textContainerInstance = new TextContainer();
                        let params = textContainerInstance.getDefaultContainerParams();
                        params.filename = file;
                        params.bUpdateSaveAllButton = false;
                        const widgetEl = textContainerInstance.createTextContainer(node, params);

                        // Start async work, but don't await yet
                        reloadPromises.push(
                            textContainerInstance.reloadText(false) // Don't update config
                        );      

                        node.textListWidget.addChildWidget(widgetEl);
                    }

                    // Wait for all reloadText calls to finish
                    await Promise.all(reloadPromises);

                    // Re-enable containers, among other things
                    await this.loadFromConfig();

                    // Sort by title
                    node.textListWidget.sortTextContainers();

                    // Execute search filter
                    node.textListWidget.searchInstance.executeSearchWithEnteredSearchText();

                    // Hide loading screen
                    node.textListWidget.showLoadingScreen(false);
                };

                node.reloadTexts = async function(recursive = false, extensionFilter = "json")
                {
                    node.reloadTextsFromPath(node.saved_texts_path_widget.value, recursive, extensionFilter);
                };

			};

            // Called after initial deserialization
            nodePrototype.onConfigure = function () {

                this.reloadTextsFromPath(this.saved_texts_path_widget.value);
			};
		}
	}
});

// Frontend only manager
app.registerExtension({
	name: "JNodes.TextManager.Manager",
	registerCustomNodes() {
		class TextManagerManager extends LGraphNode {
			defaultVisibility = true;
			serialize_widgets = true;
			drawConnection = false;
			canvas = app.canvas;

			constructor() {
				super()

				const node = this;
                this.title = "Text Manager Manager";
                this.defaultSize = [250, 120];

				this.titleFilterWidget = this.addWidget(
					"text", 
					"title_filter", 
                    "",
					(s, t, u, v, x) => {
						
					}, 
					{}
				);
                this.titleFilterWidget.tooltip = 
                    "Optional: If provided, only text managers in the graph that " +
                    "match the title filter will be affected. " +
                    "Otherwise, all will be affected. Case insensitive.";

                this.onAdded = function(graph) {
					node.size = this.defaultSize;
				};

                const appendage = "on all matching text managers. " + 
                "If any managers are already filtering for this property, the filter will be removed. " +
                "If no managers are filtering for this property, the filter will be applied to all.";

                // Store references for later use
                let toggleDynamicAllButton_el = null;

                this.proxyButtonEvent = function(buttonName, eventName, nodeVerificationEventName = null, args = []) {
                    const nodes = this.findTextManagerNodes();

                    for (const node of nodes) {
                        const button = node.textListWidget.toolbarGridParams[buttonName];
                        if (button) {

                            let bShouldExecute = true;
                            if (nodeVerificationEventName && 
                                node.textListWidget[nodeVerificationEventName] &&
                                typeof node.textListWidget[nodeVerificationEventName] === "function" &&
                                !node.textListWidget[nodeVerificationEventName]()
                            ) {
                                continue;
                            }
                        
                            if (typeof button[eventName] === "function") {
                                button[eventName](...args);
                            }
                        }
                    }
                };

                const params = {
                    toggleCollapseAllButton: {
                        title: "Collapse or expand all text containers " + appendage + ". " +
                        "If any are expanded, all will collapse. " +
                        "If all are collapsed, all will expand." + " " + longPressCTA,
                        onpointerdown: () => { this.toggleCollapseAllButton_pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            let bOnlyVisible = false;

                            if (this.toggleCollapseAllButton_pressStartTime) {
                                const duration = Date.now() - this.toggleCollapseAllButton_pressStartTime;
                                if (duration > longPressDuration) { bOnlyVisible = true; }
                            }

                            const nodes = this.findTextManagerNodes();

                            let bShouldCollapse = false;
                            for (const node of nodes) {

                                if (node.textListWidget.hasAnyExpandedTextContainers()) {
                                    bShouldCollapse = true;
                                    break;
                                }
                            }
                            
                            for (const node of nodes) {
                                node.textListWidget.setAllTextContainersCollapsed(
                                    bShouldCollapse, null, bOnlyVisible);
                            }
                        }
                    },
                    toggleEnableAllButton: {
                        title: "Enable or disable all text containers " + appendage + ". " +
                        "If any are enabled, all will disabled. " +
                        "If all are disabled, all will enabled." + " " + longPressCTA,
                        onpointerdown: () => { this.toggleEnableAllButton_pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            let bOnlyVisible = false;

                            if (this.toggleEnableAllButton_pressStartTime) {
                                const duration = Date.now() - this.toggleEnableAllButton_pressStartTime;
                                if (duration > longPressDuration) { bOnlyVisible = true; }
                            }

                            const nodes = this.findTextManagerNodes();

                            let bShouldDisable = false;
                            for (const node of nodes) {

                                if (node.textListWidget.hasAnyEnabledTextContainers()) {
                                    bShouldDisable = true;
                                    break;
                                }
                            }
                            
                            for (const node of nodes) {
                                node.textListWidget.setAllTextContainersEnabledState(
                                    !bShouldDisable, null, bOnlyVisible);
                            }
                        }
                    },
                    toggleDynamicAllButton: {
                        title: "Toggle dynamic state for all text containers " + appendage + ". " +
                        "If any are dynamic, all will become non-dynamic. " +
                        "If all are non-dynamic, all will become dynamic." + " " + longPressCTA,
                        onpointerdown: () => { this.toggleDynamicAllButton_pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            let bOnlyVisible = false;

                            if (this.toggleDynamicAllButton_pressStartTime) {
                                const duration = Date.now() - this.toggleDynamicAllButton_pressStartTime;
                                if (duration > longPressDuration) { bOnlyVisible = true; }
                            }

                            const nodes = this.findTextManagerNodes();

                            let bShouldDisable = false;
                            for (const node of nodes) {

                                if (node.textListWidget.hasAnyDynamicTextContainers()) {
                                    bShouldDisable = true;
                                    break;
                                }
                            }
                            
                            for (const node of nodes) {
                                node.textListWidget.setAllTextContainersDynamicState(
                                    !bShouldDisable, null, bOnlyVisible);
                            }
                        }
                    },
                    saveAllButton: {
                        title: "Save all changed text containers " + appendage + ". " + longPressCTA,
                        onpointerdown: () => {
                            this.proxyButtonEvent("saveAllButton", "onpointerdown");
                        },

                        onpointerup: () => {
                            this.proxyButtonEvent("saveAllButton", "onpointerup");
                        },
                    },
                    reloadButton: {
                        title: "Reload all text containers " + appendage + ". ",
                        onclick: () => { 
                            this.proxyButtonEvent("reloadButton", "onclick");
                        },
                    },
                    showWidget: {
                        toggleShowProperty: (propertyName) => {

                            const nodes = this.findTextManagerNodes();

                            let bShouldShow = true;
                            for (const node of nodes) {
                                if (node.textListWidget.isPropertyFilterOn(propertyName)) {
                                    bShouldShow = false;
                                    break;
                                }
                            }
                            
                            for (const node of nodes) {
                                if (bShouldShow === node.textListWidget.isPropertyFilterOn(propertyName)) {
                                    continue;
                                }

                                node
                                .textListWidget
                                .toolbarGridParams
                                .showWidget
                                .toggleShowProperty(propertyName);
                            }
                        },
                        titleAppendage: " " + appendage,
                    }
                };

                const mainWidget = utilitiesInstance.addComfyNodeWidget(
                    node, createToolButtonsGrid(null, params), "textlist", "textlist", {
                        serialize: false,
                        hideOnZoom: false,
                    });

				this.clone = function () {
					const cloned = TextManagerManager.prototype.clone.apply(this);
					cloned.size = cloned.computeSize();
					return cloned;
				};


				this.findTextManagerNodes = function () {
                    const titleFilters = this.titleFilterWidget.value
                        .toLowerCase()
                        .split(",")
                        .map(f => f.trim())
                        .filter(Boolean); // remove empty strings

                    return node.graph._nodes.filter(otherNode =>
                        otherNode.type === "JNodes_TextManager" &&
                        (
                            titleFilters.length === 0 ||
                            titleFilters.some(filter =>
                                otherNode.title.toLowerCase().includes(filter)
                            )
                        )
                    );
                };

				
				// This node is purely frontend and does not impact the resulting prompt so should not be serialized
				this.isVirtualNode = true;
			}
		}

		LiteGraph.registerNodeType(
			"Text Manager Manager (JNodes)",
			TextManagerManager
        );

		TextManagerManager.category = "JNodes";
	},
});