import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";
import { utilitiesInstance } from "../common/Utilities.js";
import {$el} from "/scripts/ui.js";

// Node that loads and saves texts with concatenation, favorites, and live edits

const containerHeightPercentage = 0.75;

const changedColor = "#5f2573ff";
const unchangedColor = "#222";

const longPressDuration = 700; // ms
const longPressCTA = `Hold the button for ${longPressDuration}ms to affect only visible items.`;

const priorityMin = -99;
const priorityMax = 100;

function getChangedUnchangedColor(bIsChanged) {
    return bIsChanged ? changedColor : unchangedColor;
}

function tintButton(button, color) {
    button.style.boxShadow = `inset 0 0 0 9999px ${color}`;
}

function clearTint(button) {
    button.style.boxShadow = button.origShadow || "";
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
    container.saveAllButton.origShadow = container.saveAllButton.style.boxShadow;
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

    function buildShowWidget() {
        const properties = [
            { name: "enabled", emoji: "✅" },
            { name: "changed", emoji: "✏️" },
            { name: "favorite", emoji: "⭐" },
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
        container.saveAllButton,
        container.reloadButton,
        buildShowWidget()
    ]);

    return toolButtonsGrid;
}


class TextManagerSearch {

    constructor(node) {

        this.node = node;
        this.searchFieldElement;
        this.bMatchAny = false; // Whether to return results with any of the given tokens or only results that match all tokens
        this.matchButtonElement;
    }

    createSearchBar() {
        return $el("div", {
            style: {
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
            }
        }, [
            this.createSearchField(), this.createSearchBarClearButton(), this.createSearchBarMatchButton(), this.createSearchRandomizeButton()
        ]);
    }

    createSearchField() {

        this.searchFieldElement = $el("input", {
            type: "text",
            id: "SearchInput",
            placeholder: "Type here to search",
            autocomplete: "off",
            style: {
                width: '100%',
            }
        });

        // Attach the handleSearch function to the input's 'input' event
        this.searchFieldElement?.addEventListener('input', () => { this.executeSearchWithEnteredSearchText(); });

        return this.searchFieldElement;
    }

    createSearchBarClearButton() {

        return $el("button.JNodes-search-bar-clear-btn", {
            textContent: "❌",
            title: "Clear Search",
            onclick: () => { this.clearAndExecuteSearch(); }
        });
    }

    createSearchBarMatchButton() {

        this.matchButtonElement = $el("button.JNodes-search-bar-match-btn", {
            title: "Toggle Match Any / Match All",
            onclick: () => {
                this.bMatchAny = !this.bMatchAny;
                this.updateMatchButtonVisual();
                this.executeSearchWithEnteredSearchText();
            },
            style: {
                color: "red",
                fontWeight: "bolder"
            }
        });

        this.updateMatchButtonVisual();

        return this.matchButtonElement;
    }

    async randomizeSearch() {

        if (this.childWidgets.length > 1) {
			let selectedChildElement = null;

			do {
				const randomIndex = Math.floor(Math.random() * this.childWidgets.length);
				selectedChildElement = this.childWidgets[randomIndex];
			} while (!selectedChildElement || !selectedChildElement.data.getSearchText);

            const searchTerms = selectedChildElement?.data?.getSearchText() || null;
			if (searchTerms) {

				const splitTerms = searchTerms.split(" ");
				let chosenTerm = "";
				do {
					// New random
					const randomIndex = Math.floor(Math.random() * splitTerms.length);
					chosenTerm = splitTerms[randomIndex];

					// Clean up the string
					while (chosenTerm.includes(",")) {
						chosenTerm = chosenTerm.replace(",", " ");
					}

				} while (!chosenTerm.trim());

				this.setSearchTextAndExecute(chosenTerm);
			}
		}
    }

    createSearchRandomizeButton() {

        return $el("button.JNodes-search-randomize-btn", {
            textContent: "🎲",
            title: "Random Suggestion",
            onclick: () => this.randomizeSearch()
        });
    }

    updateMatchButtonVisual() {

        if (this.matchButtonElement) {
            this.matchButtonElement.textContent = this.bMatchAny ? "ANY" : "ALL";
        }
    }

    clearSearch() {
        if (!this.searchFieldElement) { return; }
        this.searchFieldElement.value = "";
    }

    getSearchText() {

        if (this.searchFieldElement) {
            return this.searchFieldElement.value;
        } else {
            return "";
        }
    }

    setSearchText(newText) {
        if (!this.searchFieldElement) { return; }
        this.searchFieldElement.value = newText;
    }

    setSearchTextAndExecute(newText) {
        if (!this.searchFieldElement) { return; }
        this.searchFieldElement.value = newText;
        this.executeSearchWithEnteredSearchText();
    }

    clearAndExecuteSearch() {
        this.clearSearch();
        this.executeSearchWithEnteredSearchText();
    }

    focusSearch() {
        this.searchFieldElement.focus();
    }

    focusAndSelectSearchText() {
        this.searchFieldElement.select(); // Select focuses already
    }

    // Function to execute seach with an explicit searchTerm
    executeSearch(searchTerm) {
        
        // Provision search string
		const sanitizedSearchTerm = searchTerm.toLowerCase().trim();

		// Split into multiple terms on space
		const splitSearchTerms = sanitizedSearchTerm.split(" ");
		const bSearchTermsGiven = splitSearchTerms.length > 0;

		for (let i = 0; i < this.childWidgets.length; i++) {

            const child = this.childWidgets[i];

            if (!child) { continue; }

            const rawText = child.data.getSearchText();

            if (!rawText) { continue; }

			const itemsSearchTerms = rawText.toLowerCase().trim();

			const bShouldEvaluateSearch = bSearchTermsGiven && itemsSearchTerms;

			let bDoesItemTextIncludeSearchTerm = false;
			if (bShouldEvaluateSearch) {
				//console.log(itemText + " matched against " + searchTerm + ": " + itemText.includes(searchTerm));

				if (this.bMatchAny) {

					bDoesItemTextIncludeSearchTerm = splitSearchTerms.some(term => itemsSearchTerms.includes(term));

				} else { // Match All terms

					bDoesItemTextIncludeSearchTerm = splitSearchTerms.every(term => itemsSearchTerms.includes(term));

				}
			}

			// If we don't want to evaluate search, just return true
            const bMatches = bShouldEvaluateSearch ? bDoesItemTextIncludeSearchTerm : true;
			this.childWidgets[i].style.display = bMatches ? "flex" : "none";

            this.node.onSearchExecuted(searchTerm);
		}
    };

    // Function to execute search using the term entered in the SearchBar
    executeSearchWithEnteredSearchText() {
        // Get input value
        let searchTerm = this.searchFieldElement?.value;

        this.executeSearch(searchTerm);
    }
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
            [this.node.starting_path_widget.value, this.filename]
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

        this.updateReferenceText();
        this.updateFavoriteButtonColor();

        if (bUpdateConfig) {
            this.node.updateConfig();
            this.node.updateOutputText();
        }

        return true;
    }

    async updateJsonFields(fieldsToUpdate = {}) {
        if (!fieldsToUpdate || Object.keys(fieldsToUpdate).length === 0) {
            return false;
        }

        const relativePath = utilitiesInstance.joinPaths(
            [this.node.starting_path_widget.value, this.filename]
        );

        let currentData = {};

        // Attempt to load existing JSON
        try {
            const loadedText = await loadText(relativePath);
            if (loadedText) {
                currentData = JSON.parse(loadedText);
            }
        } catch (err) {
            console.warn("No existing JSON found or failed to parse. Will create new.");
            currentData = this.gatherConfigData();
        }

        // Merge/update only the specified fields
        Object.assign(currentData, fieldsToUpdate);

        // Save back to file
        const bSuccess = saveText(relativePath, JSON.stringify(currentData, null, 2));

        if (bSuccess) {
            // Optional: update any references/UI
            this.updateReferenceText();
            this.node.updateConfig();
            this.node.updateOutputText();
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

            const generatedId = crypto.randomUUID().slice(0, 8); // short, readable

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

    serializeToFile() {

        const serializedString = this.serialize();

        if (!serializedString) { return; }

        let relativePath = this.node.starting_path_widget.value;

        this.generateTitleAndFilenameIfNeeded();

        relativePath = utilitiesInstance.joinPaths([relativePath, this.filename]);

        const bSuccess = saveText(relativePath, serializedString);

        if (bSuccess) {

            this.updateReferenceText();
        }

        return bSuccess;
    }

    duplicateContainer() {
        let params = this.getDefaultContainerParams();

        params.bStartCollpased = false;
        params.title = this.titleInput.value;
        params.text = this.textInput.value;

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
                [this.node.starting_path_widget.value, this.filename]);

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

        if (this.node.isTextContainerBound(this)) {
            this.node.unbindTextContainer(this);
            this.node.bindTextContainer(this);
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

        const buildToolbar = () => {

            const toolbar = $el("div", {
                style: {
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                }
            });

            // Left side tools
            const leftSideTools = $el("div", {
                style: {
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "flex-start"
                }
            });

            // Enable switch
            const toggleStruct = utilitiesInstance.createSliderToggle(
                () => {

                    this.generateTitleAndFilenameIfNeeded();
                    node.bindTextContainer(this);
                },
                () => {

                    node.unbindTextContainer(this);
                }
            );
            this.enabledSwitch = toggleStruct.switch;
            leftSideTools.appendChild(toggleStruct.container);
            
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
            this.favoriteButton.origShadow = this.favoriteButton.style.boxShadow;
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
                    marginLeft: "auto"
                }
            });

            this.priorityInput = $el("input", {
                type: "number",
                value: 0,
                onchange: (e) => {
                    this.setPriorityValue(e.target.value);
                },
                style: {
                    width: "21%",
                }
            });
            const priorityContainer = $el("div", {
                title: "Set a priority index for this container. Higher valued containers are sorted first.",
                style: {
                    display: "flex",
                    justifyContent: "flex-end",
                }
            },[
                $el("label", { textContent: "P: " }),
                this.priorityInput
            ]);
            rightSideTools.appendChild(priorityContainer);

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
                fontSize: "12px",
                minHeight: "300px"
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

    // Required for search
    getSearchText() {
        return `${this.titleInput.value} ${this.textInput.value}` +
            `enabled==${this.getEnabled()}` +
            `changed==${this.hasChanged()}` +
            `favorite==${this.bIsFavorite}`;
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
    const searchInstance = new TextManagerSearch(node);
    container.searchInstance = searchInstance;

    // Add toolbars
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
    container.toggleAllTextContainersCollapsed = function(withFilename = null, bOnlyVisible = false) {

        // First determine whether we need to expand or collapse all
        let bShouldCollapse = false;
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (!textContainer.bIsCollapsed) { 
                bShouldCollapse = true; 
                break;
            }
        }

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
    container.toggleAllTextContainersEnabledState = function(withFilename = null, bOnlyVisible = false) {

        // First determine whether we need to enable or disable all
        let bShouldDisable = false;
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {

            const textContainer = searchInstance.childWidgets[i].data;

            if (textContainer.getEnabled()) { 
                bShouldDisable = true; 
                break;
            }
        }

        // Then execute
        container.setAllTextContainersEnabledState(!bShouldDisable, withFilename, bOnlyVisible);
    }
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

        const params = {
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
            showWidget: {
                toggleShowProperty: function(propertyName) {

                    const additionalSearchText = `${propertyName}==true`;
                    let currentSearchText = searchInstance.getSearchText();
                    if (currentSearchText.includes(additionalSearchText)) {
                        currentSearchText = currentSearchText.replace(additionalSearchText, "").trim();
                    } else {
                        // Add the property to search text with a space if needed
                        if (currentSearchText.length > 0) { currentSearchText += " "; }
                        currentSearchText += additionalSearchText;
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
            createToolButtonsGrid(container, params), addTextButton
        ]);

        return toolButtonsContainer;
    }
    container.appendChild(createToolbar());

    const searchInput = searchInstance.createSearchBar();

    container.appendChild(searchInput);

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
    container.appendChild(scrollArea);
    container.scrollArea = scrollArea;

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
            scrollArea.appendChild(childWidget);
        }
        searchInstance.childWidgets.push(childWidget);
        node.observer.observe(childWidget);

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

            while (container.scrollArea.firstChild) {
                container.scrollArea.removeChild(container.scrollArea.firstChild);
            }

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

    function clearWidgets() {

        while (container.scrollArea.firstChild) {
            removeChildWidget(container.scrollArea.firstChild);
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

    // Search/randomize function for search bar
    searchInput.addEventListener("input", () => {
        
        const filter = searchInstance.getSearchText();
        searchInstance.executeSearch(filter);
    });

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
                this.starting_path_widget = this.widgets[0];
				this.delimiterWidget = this.widgets[1];
				this.outputTextWidget = this.widgets[2];
				this.configWidget = this.widgets[3];

                this.outputTextWidget.inputEl.readOnly = true;
                this.configWidget.inputEl.readOnly = true;

                // Create our list widget
                this.textListWidget = createTextListWidget(node);

                const mainWidget = utilitiesInstance.addComfyNodeWidget(
                    node, this.textListWidget, "textlist", "textlist", {
                        serialize: false,
                        hideOnZoom: false,
                    });
                mainWidget.computeSize = function(width) {

                    const computedHeight = node.size[1] * containerHeightPercentage; // Percentage of node height

                    return [width, computedHeight ?? 300];
                };

                this.observer = new IntersectionObserver(
                    (entries) => {
                        for (const entry of entries) {
                            const el = entry.target;
                            if (entry.isIntersecting) {
                                el.style.visibility = "visible";
                            } else {
                                el.style.visibility = "hidden";
                            }
                        }
                    },
                    {
                        root: this.textListWidget,
                        rootMargin: "200px"
                    }
                );

                const onRemoved = node.onRemoved;
                node.onRemoved = () => {
                    if (node.textListWidget) {
                        node.textListWidget.cleanupNode();
                    }
                    return onRemoved?.();
                };

                this.starting_path_widget.callback = () => {
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
                    for (let i = 0; i < node.boundTextContainers.length; i++) {
                        const container = node.boundTextContainers[i];

                        // Only add delimiter if this isn't the last container
                        if (i == node.boundTextContainers.length - 1) {
                            this.outputTextWidget.value += `${container.textInput.value}`;
                        } else {
                            this.outputTextWidget.value += 
                                `${container.textInput.value}${delimiter}`;
                        }
                    }
                };

                node.isTextContainerBound = function(inTextContainer) {
                    return inTextContainer && node.boundTextContainers.includes(inTextContainer);
                };

                node.bindTextContainer = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (!node.isTextContainerBound(inTextContainer)) {

                        // Save the actual object ptr
                        node.boundTextContainers.push(inTextContainer);
                        node.boundTextContainers.sort((a, b) => 
                            (Number(b.priorityInput.value) || priorityMin) - 
                            (Number(a.priorityInput.value) || priorityMin)
                        );                      
                        // Save just the filename (in effect, the ID) to configParams
                        node.configParams.boundTextContainers =
                            node.boundTextContainers.map(tc => tc.filename);

                        node.updateOutputText();
                        node.updateConfig();
                    }
                };

                node.unbindTextContainer = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (node.isTextContainerBound(inTextContainer)) {

                        node.boundTextContainers = 
                            node.boundTextContainers.filter(
                                item => item !== inTextContainer);

                        node.configParams.boundTextContainers = 
                            node.configParams.boundTextContainers.filter(
                                item => item !== inTextContainer.filename);

                        node.updateOutputText();
                        node.updateConfig();
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
                    // Separate container tracking using filename (ID) only for serialization
                    boundTextContainers: [],
                    searchText: "",
                };

                node.onSearchExecuted = function(searchText) {
                    node.configParams.searchText = searchText;
                    this.updateConfig();
                };

                node.updateConfig = function() {

                    this.configWidget.value = JSON.stringify(node.configParams);
                };

                node.loadFromConfig = function() {

                    try {
                        const savedParams = JSON.parse(this.configWidget.value);
                        // Merge saved config into defaults
                        Object.keys(savedParams).forEach(key => {
                            if (key in this.configParams) {
                                this.configParams[key] = savedParams[key];
                            }
                        });

                        // Update bound text containers from config
                        const textContainersToBind = this.configParams.boundTextContainers;

                        //Reset
                        this.configParams.boundTextContainers = [];
                        this.outputTextWidget.value = "";
                        this.configWidget.value = "";

                        for (const filename of textContainersToBind) {

                            this.textListWidget.setAllTextContainersEnabledState(true, filename);
                        }

                        node.textListWidget.searchInstance.setSearchText(this.configParams.searchText);

                        node.updateConfig();
                    } catch (e) {
                        console.log(e);
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
                    this.loadFromConfig();

                    // Sort by title
                    node.textListWidget.sortTextContainers();

                    // Execute search filter
                    node.textListWidget.searchInstance.executeSearchWithEnteredSearchText();

                    // Hide loading screen
                    node.textListWidget.showLoadingScreen(false);
                };

                node.reloadTexts = async function(recursive = false, extensionFilter = "json")
                {
                    node.reloadTextsFromPath(node.starting_path_widget.value, recursive, extensionFilter);
                };

			};

            // Called after initial deserialization
            nodePrototype.onConfigure = function () {

                this.reloadTextsFromPath(this.starting_path_widget.value);
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

                const appendage = "on all matching text managers";

                const params = {
                    toggleCollapseAllButton: {
                        title: "Collapse or expand all text containers " + appendage + ". " +
                        "If any are expanded, all will collapse. " +
                        "If all are collapsed, all will expand." + " " + longPressCTA,
                        onpointerdown: () => { },//container.toggleCollapseAllButton.pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            // let bOnlyVisible = false;

                            // if (container.toggleCollapseAllButton.pressStartTime) {
                            //     const duration = Date.now() - container.toggleCollapseAllButton.pressStartTime;
                            //     if (duration > longPressDuration) { bOnlyVisible = true; }
                            // }
                            // container.toggleAllTextContainersCollapsed(null, bOnlyVisible);
                        },
                    },
                    toggleEnableAllButton: {
                        title: "Enable or disable all text containers " + appendage + ". " +
                        "If any are enabled, all will disabled. " +
                        "If all are disabled, all will enabled." + " " + longPressCTA,
                        onpointerdown: () => { },//container.toggleEnableAllButton.pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            // let bOnlyVisible = false;

                            // if (container.toggleEnableAllButton.pressStartTime) {
                            //     const duration = Date.now() - container.toggleEnableAllButton.pressStartTime;
                            //     if (duration > longPressDuration) { bOnlyVisible = true; }
                            // }
                            // container.toggleAllTextContainersEnabledState(null, bOnlyVisible);
                        },
                    },
                    saveAllButton: {
                        title: "Save all changed text containers " + appendage + ". " + longPressCTA,
                        onpointerdown: () => { },//container.saveAllButton.pressStartTime = Date.now(); },
                        onpointerup: () => { 
                            // let bOnlyVisible = false;

                            // if (container.saveAllButton.pressStartTime) {
                            //     const duration = Date.now() - container.saveAllButton.pressStartTime;
                            //     if (duration > longPressDuration) { bOnlyVisible = true; }
                            // }
                            // container.saveAllChangedTextContainers(bOnlyVisible);
                        },
                    },
                    reloadButton: {
                        title: "Reload all text containers " + appendage + ". ",
                        onclick: () => { 
                            // node.reloadTexts();
                        },
                    },
                    showWidget: {
                        toggleShowProperty: function(propertyName) {

                            // const additionalSearchText = `${propertyName}==true`;
                            // let currentSearchText = searchInstance.getSearchText();
                            // if (currentSearchText.includes(additionalSearchText)) {
                            //     currentSearchText = currentSearchText.replace(additionalSearchText, "").trim();
                            // } else {
                            //     // Add the property to search text with a space if needed
                            //     if (currentSearchText.length > 0) { currentSearchText += " "; }
                            //     currentSearchText += additionalSearchText;
                            // }

                            // searchInstance.setSearchTextAndExecute(currentSearchText);
                        },
                        titleAppendage: " " + appendage,
                    }
                };

                const mainWidget = utilitiesInstance.addComfyNodeWidget(
                    node, createToolButtonsGrid(null, params), "textlist", "textlist", {
                        serialize: false,
                        hideOnZoom: false,
                    });

				this.validateName = function(graph) {
					let widgetValue = node.widgets[0].value;
				
					if (widgetValue !== '') {
						let tries = 0;
						const existingValues = new Set();
				
						graph._nodes.forEach(otherNode => {
							if (otherNode !== this && otherNode.type === 'SetNode') {
								existingValues.add(otherNode.widgets[0].value);
							}
						});
				
						while (existingValues.has(widgetValue)) {
							widgetValue = node.widgets[0].value + "_" + tries;
							tries++;
						}
				
						node.widgets[0].value = widgetValue;
						this.update();
					}
				}

				this.clone = function () {
					const cloned = TextManagerManager.prototype.clone.apply(this);
					cloned.size = cloned.computeSize();
					return cloned;
				};


				this.findGetters = function(graph, checkForPreviousName) {
					const name = checkForPreviousName ? this.properties.previousName : this.widgets[0].value;
					return graph._nodes.filter(otherNode => otherNode.type === 'GetNode' && otherNode.widgets[0].value === name && name !== '');
				}

				
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