import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";
import { utilitiesInstance } from "../common/Utilities.js";
import {$el} from "/scripts/ui.js";

// Node that loads and saves texts with concatenation, favorites, and live edits

const containerHeightPercentage = 0.8;

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

class TextManagerSearch {

    constructor(args) {

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
			} while (!selectedChildElement || !selectedChildElement.getSearchText);

            const searchTerms = selectedChildElement?.getSearchText() || null;
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

            const rawText = child.getSearchText();

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
        this.collapseBtn = null;
        this.bIsCollapsed = false;

        this.filename = "";
        this.referenceText = "";
    }

    serialize() {
        const data = {
            title: this.titleInput.value,
            text: this.textInput.value
        };

        return JSON.stringify(data);
    }

    serializeToFile() {

        const serializedString = this.serialize();

        if (!serializedString) { return; }

        let relativePath = this.node.starting_path_widget.value;

        // If we don't have a filename, generate one
        if (!this.filename) {

            const id = crypto.randomUUID().slice(0, 8); // short, readable
            this.filename = `${slugify(this.titleInput.value)}__${id}.json`;
        }

        relativePath = utilitiesInstance.joinPaths([relativePath, this.filename]);

        return saveText(relativePath, serializedString);
    }

    getDefaultContainerParams() {
        return {
            title: "New Text", text: "", bStartCollpased: true, filename: null
        }
    }

    createTextContainer(node, containerParams = this.getDefaultContainerParams()) {

        this.node = node;

        if (containerParams.filename)
        {
            this.filename = containerParams.filename;
        }

        // Outer container
        this.container = $el("div", {
            style: {
                padding: "4px",
                border: "1px solid #444",
                borderRadius: "3px",
                backgroundColor: "#222",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
            }
        });

        const buildToolbar = () => {

            const toolbar = $el("div", {
                style: {
                    display: "flex",
                }
            });

            this.enabledSwitch = utilitiesInstance.createSliderToggle(
                () => {

                    node.bindTextContainer(this);
                },
                () => {

                    node.unbindTextContainer(this);
                }
            );

            toolbar.appendChild(this.enabledSwitch);
            
            toolbar.appendChild($el("button", {
                onclick: () => {

                    this.serializeToFile();
                    this.referenceText = this.textInput.value;
                },
                textContent: "💾",
                title: "Save Text"
            }));

            return toolbar;
        }

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
            value: containerParams.title,
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
            value: containerParams.text,
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

        this.textInput.addEventListener('focus', () => {
            node.setLastFocusedTextContainer(this);
        });

        this.textInput.addEventListener("input", () => {

            if (this.node.isTextContainerBound(this)) {
                this.node.updateOutputText();
            }
        });

        this.contentArea.appendChild(this.textInput);

        // Add to main container
        this.container.appendChild(header);
        this.container.appendChild(this.contentArea);

        // Required for search
        this.container.getSearchText = () => {
            return `${this.titleInput.value} ${this.textInput.value}`;
        };

        this.container.data = this;

        if (containerParams.bStartCollpased && !this.bIsCollapsed)
        {
            this.toggleCollapse();
        }

        return this.container;
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

function createScrollingContainerWidget(node, title = "Container") {
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

    // Declaring this up here for the functionn immediately below
    const searchInstance = new TextManagerSearch();

    // Add toolbars
    function setAllTextContainersCollapsed(bNewState) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {
            searchInstance.childWidgets[i].data.setIsCollapsed(bNewState);
        }
    }
    function setAllTextContainersEnabledState(bNewState) {
        for (let i = 0; i < searchInstance.childWidgets.length; i++) {
            if (searchInstance.childWidgets[i].data.enabledSwitch.bIsOn != bNewState) {
                searchInstance.childWidgets[i].data.enabledSwitch.click();
            }
        }
    }
    const expandAllButton = $el("button", {
        textContent: "Expand All",
        title: "Expand all text containers",
        onclick: () => { 
            setAllTextContainersCollapsed(false);
        },
        style: {
            marginBottom: "4px",
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    const collapseAllButton = $el("button", {
        textContent: "Collapse All",
        title: "Collapse all text containers",
        onclick: () => { 
            setAllTextContainersCollapsed(true);
        },
        style: {
            marginBottom: "4px",
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    const disableAllButton = $el("button", {
        textContent: "Disable All",
        title: "Disable all text containers",
        onclick: () => { 
            setAllTextContainersEnabledState(false);
        },
        style: {
            marginBottom: "4px",
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
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
            marginBottom: "4px",
            color: "#63e563",
            cursor: "pointer",
            whiteSpace: "nowrap", 
            fontSize: "10px",
        }
    });
    const toolButtonsContainer = $el("div", {
        style: {
            display: "flex",
            justifyContent: "flex-end",
        }
    }, [
        expandAllButton, collapseAllButton, disableAllButton, addTextButton
    ]);
    container.appendChild(toolButtonsContainer);

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

    function makeNewTextContainer() {

        const textContainerInstance = new TextContainer();
        return textContainerInstance.createTextContainer(node);
    }
    container.makeNewTextContainer = makeNewTextContainer;

    function clearWidgets() {

        while (container.firstChild) {
            container.removeChild(container.firstChild);
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
				this.outputTextWidget = this.widgets[1];

                this.outputTextWidget.inputEl.readOnly = true;

                // Create our list widget
                this.scrollWidget = createScrollingContainerWidget(node, "Texts List");

                const mainWidget = utilitiesInstance.addComfyNodeWidget(
                    node, this.scrollWidget, "textlist", "textlist", {
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
                        root: this.scrollWidget,
                        rootMargin: "200px"
                    }
                );

                const onRemoved = node.onRemoved;
                node.onRemoved = () => {
                    if (node.scrollWidget) {
                        node.scrollWidget.cleanupNode();
                    }
                    return onRemoved?.();
                };

                node.setLastFocusedTextContainer = function(inTextContainer) {

                    if (!inTextContainer) { return; }

                    node.lastFocusedTextContainer = inTextContainer;
                };

                // Text Building
                node.boundTextContainers = [];
                node.updateOutputText = function() {

                    this.outputTextWidget.value = "";
                    for (const container of node.boundTextContainers) {
                        this.outputTextWidget.value += `${container.textInput.value}\n\n`
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
                        node.boundTextContainers.push(inTextContainer);

                        node.updateOutputText();
                    }
                };

                node.unbindTextContainer = function(inTextContainer) {

                    if (!inTextContainer) {
                        return;
                    }

                    if (node.isTextContainerBound(inTextContainer)) {
                        node.boundTextContainers = 
                            node.boundTextContainers.filter(item => item !== inTextContainer);

                        node.updateOutputText();
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

                node.reloadTexts = async function (path, recursive = false, extensionFilter = "json")
                {
                    // Load all text files into containers
                    const files = await getSavedTextFiles(path, recursive, extensionFilter);

                    for (const file of files) {

                        const relativePath = utilitiesInstance.joinPaths(
                            [node.starting_path_widget.value, file]);

                        const loadedText = await loadText(relativePath);

                        const asJson = JSON.parse(loadedText);

                        const title = asJson?.title ? asJson.title : "New Text";
                        const text = asJson?.text ? asJson.text : "";
                        
                        const textContainerInstance = new TextContainer();
                        let params = textContainerInstance.getDefaultContainerParams();
                        params.title = title;
                        params.text = text;
                        params.filename = file;
                        const widgetEl = textContainerInstance.createTextContainer(node, params);

                        node.scrollWidget.addChildWidget(widgetEl);
                    }
                };

			// 	this.saveButton = this.addWidget("button", "save", null, () => {
			// 		if (saveText(this.pathWidget.value, this.textWidget.value)) {
			// 			this.saveButton.name = `save (last saved at ${utilitiesInstance.getCurrentTimeAsString()})`;
			// 		}
			// 	});

			// 	this.loadButton = this.addWidget("button", "load", null, () => {
			// 		if (loadText(this.pathWidget.value, this.textWidget, true)) {
			// 			this.bWasJustLoaded = true;
			// 			this.loadButton.name = `load (last loaded at ${utilitiesInstance.getCurrentTimeAsString()})`;

			// 			// Clear the "dirty" state
			// 			if (this.saveButton.name.includes("*")) {
			// 				this.saveButton.name = this.saveButton.name.replace("*", "");
			// 			}
			// 		}
			// 	});

			// 	this.textWidget.element.addEventListener("input", async () => {
			// 		// When the textarea content changes, we want to update the save and load buttons
			// 		// as a way to 'dirty' the widget so the user knows that changes have been made
			// 		// since the last save or load. The 'justLoaded' bool only acts
			// 		// as a gate to eat the first change that may be caused by the load
			// 		// loadText > set textWidget.value > callback called > justLoaded gate

			// 		if (this.justLoaded) {

			// 			this.bWasJustLoaded = false;
			// 		} else {

			// 			if (!this.bIsCurrentlyAttemptingLoad && !this.saveButton.name.includes("*")) {
			// 				this.saveButton.name = this.saveButton.name + "*";
			// 			}
			// 		}
			// 	});

			};

            // Called after initial deserialization
            nodePrototype.onConfigure = function () {

                this.reloadTexts(this.starting_path_widget.value);
			};
		}
	}
});