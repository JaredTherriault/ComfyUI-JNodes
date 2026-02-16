import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

/*
 * This class is a generic implementation for searching DOM children.
 * Child elements that do not pass the search test will be set to element.style.display = "none".
 * This class avoid continuous reflow by first detaching the parent element container,
 * setting child element display settings, then re-attaching the parent element container
 * to its parent.
 * 
 * Prerequisites: The child elements you wish to search MUST have 
 * a function called "getSearchTerms" which retrns a string containing
 * whichever terms to test search against. A single string, not tokens.
 * 
 * 1. Create a class instance.
 * 2. Call createSearchBar passing in the parent container of the elements you want to search.
 * 3. Search!
 */
export class SearchBar {

	constructor(args) {

		this._elementContainer = null;
		this._searchBarContainer = null;
		this._searchFieldElement = null;
		this._bMatchAny = false; // Whether to return results with any of the given tokens or only results that match all tokens
		this._matchButtonElement = null;

        this._searchTimeout = null;
        this._searchTimeoutMs = 500;

        // Events
        this._ON_SEARCH_EVENT_NAME = "searchexecuted";
	}

	createSearchBar(elementContainer) {

		this._elementContainer = elementContainer;
		
		this._searchBarContainer = $el("div", {
			style: {
				width: '100%',
				display: 'flex',
				flexDirection: 'row',
			}
		}, [
			this.createSearchField(), 
			this.createSearchBarClearButton(), 
			this.createSearchBarMatchButton(), 
			this.createSearchRandomizeButton()
		]);

		return this._searchBarContainer;
	}

	createSearchField() {

		this._searchFieldElement = $el("input", {
			type: "text",
			id: "SearchInput",
			placeholder: "Type here to search. Start with '\\reg' to enable regex search.",
			autocomplete: "off",
			style: {
				width: '100%',
			}
		});

        // Attach the handleSearch function to the input's 'input' event
        this._searchFieldElement?.addEventListener('input', () => { 

            this.executeSearchWithEnteredSearchText(); 
        });

		return this._searchFieldElement;
	}

	createSearchBarClearButton() {

		return $el("button.JNodes-search-bar-clear-btn", {
			textContent: "❌",
			title: "Clear Search",
			onclick: () => { this.clearAndExecuteSearch(); }
		});
	}

	createSearchBarMatchButton() {

		this._matchButtonElement = $el("button.JNodes-search-bar-match-btn", {
			title: "Toggle Match Any / Match All",
			onclick: () => {
				this._bMatchAny = !this._bMatchAny;
				this.updateMatchButtonVisual();
				this.executeSearchWithEnteredSearchText();
			},
			style: {
				color: "red",
				fontWeight: "bolder"
			}
		});

		this.updateMatchButtonVisual();

		return this._matchButtonElement;
	}

	async randomizeSearch() {

		// Basically, we get a child element from the current list randomly
		// Then if it has searchTerms, which all items should, we parse them out into an array
		// Then we get a random term, clean it up a little, and if it's valid we execute search with it
		const children = this._elementContainer.children;

		if (children.length > 1) {
			let selectedChildElement = null;

			do {
				const randomIndex = Math.floor(Math.random() * children.length);
				selectedChildElement = children[randomIndex];
			} while (!selectedChildElement || 
				!selectedChildElement.getSearchTerms || 
				!selectedChildElement.getSearchTerms());

			const itemSearchTerms = selectedChildElement.getSearchTerms() || "";
			if (itemSearchTerms) {

				const splitTerms = utilitiesInstance.tokenizeText(itemSearchTerms);
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
	};

	createSearchRandomizeButton() {

		return $el("button.JNodes-search-randomize-btn", {
			textContent: "🎲",
			title: "Random Suggestion",
			onclick: () => { this.randomizeSearch(); }
		});
	}

	updateMatchButtonVisual() {

		if (this._matchButtonElement) {
			this._matchButtonElement.textContent = this._bMatchAny ? "ANY" : "ALL";
		}
	}

	clearSearch() {
		if (!this._searchFieldElement) { return; }
		this._searchFieldElement.value = "";
	}

	getSearchText() {

		if (this._searchFieldElement) {
			return this._searchFieldElement.value;
		} else {
			return "";
		}
	}

	setSearchText(newText) {
		if (!this._searchFieldElement) { return; }
		this._searchFieldElement.value = newText;
	}

	setSearchTextAndExecute(newText) {
		if (!this._searchFieldElement) { return; }
		this._searchFieldElement.value = newText;
		this.executeSearchWithEnteredSearchText();
	}

	clearAndExecuteSearch() {
		this.clearSearch();
		this.executeSearchWithEnteredSearchText();
	}

	focusSearch() {
		this._searchFieldElement.focus();
	}

	focusAndSelectSearchText() {
		this._searchFieldElement.select(); // Select focuses already
	}

	_parseSearch(searchText) {
		const trimmed = searchText.trim();

		if (!trimmed) {
			return { type: "empty" };
		}

		const tokens = trimmed.split(/\s+/);

		// Regex mode
		if (tokens[0].startsWith("\\reg")) {
			const flagPart = tokens[0].split(":")[1] || "i";
			const pattern = trimmed.slice(tokens[0].length).trim();

			let regex = null;
			try {
				regex = new RegExp(pattern, flagPart);
			} catch (e) {
				return { type: "invalid-regex" };
			}

			return { type: "regex", regex };
		}

		// Default substring mode
		return {
			type: "substring",
			terms: tokens.map(t => t.toLowerCase())
		};
	}

	_matchesSearch(itemText, parsed) {
		if (!itemText) return false;

		switch (parsed.type) {
			case "empty":
				return true;

			case "regex":
				return parsed.regex.test(itemText);

			case "substring": {
				const text = itemText.toLowerCase();
				return this._bMatchAny
					? parsed.terms.some(t => text.includes(t))
					: parsed.terms.every(t => text.includes(t));
			}

			case "invalid-regex":
				return false;
		}
	}

	// Function to execute search with an explicit searchTerm
	_executeSearch(searchTerm) {

		// Split into multiple terms on space
		const parsedSearch = this._parseSearch(searchTerm);
		const bSearchTermsGiven = parsedSearch.type != "empty";

		// First remove the element container from its parent
		const containerParent = this._elementContainer.parentNode;
		if (!containerParent) return;
		containerParent.removeChild(this._elementContainer);

		try {
			// Loop through items and check for a match
			const children = this._elementContainer.children;
			for (let i = 0; i < children.length; i++) {

				const itemsSearchTerms = children[i]?.getSearchTerms ? children[i].getSearchTerms() : "";

				const bShouldEvaluateSearch = bSearchTermsGiven && itemsSearchTerms;

				let bDoesItemTextIncludeSearchTerm = false;
				if (bShouldEvaluateSearch) {

					bDoesItemTextIncludeSearchTerm = this._matchesSearch(itemsSearchTerms, parsedSearch);
				}

				// If we don't want to evaluate search, just return true
				utilitiesInstance.setElementVisible(children[i], bShouldEvaluateSearch ? bDoesItemTextIncludeSearchTerm : true);
			}
		} catch (e) {
			// pass
		}

		// Return the container back to its parent to force reflow only once
		containerParent.appendChild(this._elementContainer);

		// Callback
		const event = new CustomEvent(this._ON_SEARCH_EVENT_NAME, {
			detail: { searchText: this.getSearchText() }
		});
		this._searchBarContainer.dispatchEvent(event);
	}

	// Public-facing wrapper for executeSearch that schedules a search after a short delay
	executeSearch(searchTerm) {

		if (this._searchTimeout) {
			clearTimeout(this._searchTimeout)
		}

		this._searchTimeout = setTimeout( () => {
			this._executeSearch(searchTerm); 
		}, this._searchTimeoutMs);
	}

	// Function to execute search using the term entered in the SearchBar
	executeSearchWithEnteredSearchText() {
		// Get input value
		let searchTerm = this._searchFieldElement?.value;

		this.executeSearch(searchTerm);
	}
}
