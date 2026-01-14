import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "./Utilities.js";

/**
 * A class representing a searchable dropdown UI component.
 */
export class SearchableDropDown {
    constructor() {
        // Initialize instance variables
        this._container = null;
        this._mainButton = null;
        this._buttonText = null;
        this._dropDownContent = null;
        this._searchInput = null;
        this._clearSearchButton = null;
        this._labelPanel = null;
        this._selectedOption = "";
        this._bIsContentShown = false;
        this._lastScrollAmount = 0;
        this._availableOptions = [];

        // Events
        this._ON_SELECT_EVENT_NAME = "selectoption";
    }

    /**
     * Creates the searchable dropdown structure and adds it to the DOM.
     */
    createSearchableDropDown() {

        this._container = $el("div", {
            className: "dropdown",
        });
        this._container.data = this;

        // Dropdown button setup
        this._mainButton = $el("button", {
            className: "dropbtn",
            onclick: () => {
                this.toggleContent();
            }
        });
        this._container.appendChild(this._mainButton);

        this._buttonText = $el("label");

        const buttonInnerContainer = $el("div", {
            className: "dropbtn-inner"
        }, [
            this._buttonText,
            $el("label", { textContent: "▼" })
        ]);
        this._mainButton.appendChild(buttonInnerContainer);

        // Dropdown content setup
        this._dropDownContent = $el("div", {
            className: "dropdown-content",
            style: {
                zIndex: utilitiesInstance.getMaxZIndex(this._container) + 1,
            }
        });
        this._container.appendChild(this._dropDownContent);

        // Add search input to the dropdown
        this._addSearchInput();

        this._labelPanel = $el("div", {
            className: "option-panel",
        }); // Holds the label children
        this._dropDownContent.appendChild(this._labelPanel);

        // Close when clicking off this widget stack
        document.addEventListener('click', (event) => { // For when any widget in this stack loses focus

            if (this._bIsContentShown && !this._container.contains(event.target)) {
                this.closeContent();
            }
        });

        // Append the dropdown style rules to the document body
        this._appendStyleRules();

        return this._container;
    }

    /**
     * Adds a new option to the dropdown's available options. 
     * Execute search separately to see it in the list.
     * @param {string} optionName - The display text of the option.
     * @param {string} [optionTooltip=""] - Optional tooltip for the option.
     * @param {string} [optionValue=""] - Optional value associated with the option.
     */
    addOption(optionName, optionValue, optionTooltip = "") {

        if (!this._labelPanel) { return; }

        const option = document.createElement("label");
        option.textContent = optionName;
        option.value = optionValue;
        option.title = optionTooltip || optionName;
        option.addEventListener("click", () => {
            const bInvokeCallbacks = true;
            this._selectOption(optionName, bInvokeCallbacks);
            this.closeContent();
        });
        this._availableOptions.push(option);

        if (this.getOptionElements().length == 1) {
            this.setOptionSelected(optionName);
        }
    }

    /**
     * Adds a unique option to the dropdown (avoids duplicate entries). 
     * Execute search separately to see it in the list.
     * @param {string} optionName - The display text of the option.
     * @param {string} [optionTooltip=""] - Optional tooltip for the option.
     * @param {string} [optionValue=""] - Optional value associated with the option.
     */
    addOptionUnique(optionName, optionValue, optionTooltip = "") {

        if (!this.hasOption(optionName)) {
            this.addOption(optionName, optionValue, optionTooltip);
        }
    }

    /**
     * Removes an option from the dropdown by its display text. 
     * Execute search separately to see it removed from the list.
     * @param {string} optionName - The display text of the option to remove.
     */
    removeOption(optionName) {

        const options = this.getOptionElements();
        for (let labelChildIndex = options.length - 1; labelChildIndex >= 0; labelChildIndex--) {
            if (options[labelChildIndex].textContent === optionName) {
                this._availableOptions.splice(options[labelChildIndex], 1);

                if (this._selectedOption == optionName) {
                    this._selectOption("");
                }
                break;
            }
        }
    }

    /**
     * Checks if an option with the specified display text exists in the dropdown.
     * @param {string} optionName - The display text of the option to check.
     * @returns {boolean} True if the option exists, otherwise false.
     */
    hasOption(optionName) {

        const options = this.getOptionElements();
        for (let labelChildIndex = options.length - 1; labelChildIndex >= 0; labelChildIndex--) {
            if (options[labelChildIndex].textContent === optionName) {
                return true;
            }
        }
        return false;
    }

    getSelectedOptionName() {

        return this._selectedOption;
    }

    getSelectedOptionValue() {

        return this.getOptionValue(this.getSelectedOptionName());
    }

    getSelectedOptionElement() {

        return this.getOptionElement(this.getSelectedOptionName());
    }

    /**
     * Clears all options from the dropdown. 
     * Execute search separately to see it removed from the list.
     */
    clearOptions() {

        this._availableOptions = [];
        this._selectOption("");
    }

    getOptionNames() {

        let outNames = [];
        const options = this.getOptionElements();
        for (let labelChildIndex = 0; labelChildIndex < options.length; labelChildIndex++) {
            outNames.push(options[labelChildIndex].textContent);
        }

        return outNames;
    }

    getOptionElements() {

        return this._availableOptions;
    }

    getOptionValue(optionName) {

        const option = this.getOptionElement(optionName);
        return option ? option.value : "";
    }

    getOptionElement(optionName) {

        const options = this.getOptionElements();
        for (let labelChildIndex = options.length - 1; labelChildIndex >= 0; labelChildIndex--) {
            if (options[labelChildIndex].textContent === optionName) {
                return options[labelChildIndex];
            }
        }
    }

    setOptionSelected(optionName, bInvokeCallbacks = false) {
        this._selectOption(optionName, bInvokeCallbacks);
    }

    getFilterText() {

        return this._searchInput ? this._searchInput.value : "";
    }

    setFilterText(inText) {
        if (this._searchInput) {
            this._searchInput.value = inText;
        }
    }

    setFilterTextAndExecuteSearch(inText) {
        if (this._searchInput) {
            this.setFilterText(inText);
            this.filterOptions(inText);
        }
    }

    clearFilterText() {
        if (this._searchInput) {
            this.setFilterTextAndExecuteSearch("");
        }
    }

    /**
     * Filters the dropdown options based on the input text.
     * @param {string} inFilterText - The text to check against the option names
     */
    filterOptions(inFilterText) {

        const filterText = inFilterText.toUpperCase();
        const options = this.getOptionElements();

        let fragment = document.createDocumentFragment();

        for (let i = 0; i < options.length; i++) {
            const txtValue = options[i].textContent;
            if (!filterText || txtValue.toUpperCase().includes(filterText)) {
                fragment.appendChild(options[i]);
            }
        }

        this._labelPanel.replaceChildren(fragment);
    }

    toggleContent() {

        if (this._bIsContentShown) {
            this.closeContent();
        } else {
            this.openContent();
        }
    }

    openContent() {

        this._bIsContentShown = true;

        // Get button and dropdown content positions
        const buttonRect = this._mainButton.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        if (buttonRect.bottom > (viewportHeight / 2)) {
            // console.log(`Open upward: buttonRect,bottom: ${buttonRect.bottom}, viewportHeight: ${viewportHeight}, buttonRect.top: ${buttonRect.top}`);
            this._dropDownContent.style.bottom = `${buttonRect.height}px`;
            this._dropDownContent.style.top = "auto";
        } else {
            // console.log(`Open downward: buttonRect,bottom: ${buttonRect.bottom}, viewportHeight: ${viewportHeight}, buttonRect.top: ${buttonRect.top}`);
            this._dropDownContent.style.top = `${buttonRect.height}px`;
            this._dropDownContent.style.bottom = "auto";
        }

        this._dropDownContent.classList.add("dropdown-show");
        this.filterOptions(this.getFilterText());
        this._searchInput.focus();
        this._searchInput.select();

        // Restore scroll amount two frames later
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.setScrollAmount(this._lastScrollAmount);
            })
        });
    }

    closeContent() {

        this._lastScrollAmount = this.getCurrentScrollAmount();

        this._bIsContentShown = false;

        this._dropDownContent.classList.remove("dropdown-show");
    }

    getCurrentScrollAmount() {

        return this._labelPanel.scrollTop;
    }
    
    getLastScrollAmount() {

        return this._lastScrollAmount;
    }

    setScrollAmount(scrollAmount) {

        this._labelPanel.scrollTop = scrollAmount;
        this._lastScrollAmount = scrollAmount;
    }

    _selectOption(optionName, bInvokeCallbacks) {
        if (this.hasOption(optionName) && this._selectedOption != optionName) {
            this._selectedOption = optionName;
            this._buttonText.textContent = optionName;

            for (const option of this.getOptionElements()) {
                option.classList.remove("option-selected");
            }

            const optionElement = this.getOptionElement(optionName);
            optionElement.classList.add("option-selected");

            if (bInvokeCallbacks) {
                const event = new Event(this._ON_SELECT_EVENT_NAME);
                this._container.dispatchEvent(event);
            }
        }
    }

    /**
     * Adds a search input field to the dropdown content.
     */
    _addSearchInput() {

        if (!this._dropDownContent) { return; }

        const searchContainer = $el("div", {
            className: "search-controls",
            style: {
                display: "flex",
                flexDirection: "row"
            }
        });
        this._dropDownContent.appendChild(searchContainer);

        this._searchInput = $el("input", {
            placeholder: "Search...",
            onkeyup: () => { this.filterOptions(this.getFilterText()); },
            style: {
                padding: "4px 16px",
                width: "100%"
            }
        });
        searchContainer.appendChild(this._searchInput);

        // Dropdown button setup
        this._clearSearchButton = $el("button", {
            textContent: "X",
            onclick: () => {
                this.clearFilterText();
                this._searchInput.focus();
            },
            style : {
                fontWeight: "bold"
            }
        });
        searchContainer.appendChild(this._clearSearchButton);
    }

    /**
     * Appends CSS style rules for the dropdown to the document body.
     */
    _appendStyleRules() {
        $el("style", {
            textContent: `

                .dropdown {
                    position: relative;
                    display: block;
                }

                .dropbtn {
                    cursor: pointer;
                    width: 100%;
                    height: 100%;
                    padding: 4px;
                }

                .dropbtn-inner {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                
                .dropdown-content {
                    display: none;
                    position: absolute;
                    background-color: var(--fg-color);
                    width: 100%;
		            border-radius: 5px;
                    z-index: 1;
                }
                
                .search-controls {
                    box-sizing: border-box;
                    border: none;
                    border-bottom: 1px solid var(--bg-color);
		            border-radius: 5px;
                }
                
                .search-controls:focus {
                    outline: 2px solid var(--bg-color);
                }

                .option-panel {
                    background-color: var(--fg-color);
                    overflow: scroll;
                    width: 100%;
                    max-height: 60vh;
		            border-radius: 5px;
                }
                
                .option-panel label {
                    color: black;
                    padding: 4px 16px;
                    text-decoration: none;
                    display: block;
		            border-radius: 5px;
                }
                
                .option-panel label:hover {
                    background-color: aquamarine;
                }

                .option-selected {
                    background-color: lightsteelblue;
                }
                
                .dropdown-show {
                    display: block;
                }
            `,
            parent: document.body,
        });
    }
}
