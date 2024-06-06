import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

class ImageDrawerSearch extends ImageDrawerComponent {

	constructor(args) {

		super(args);

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

	createSearchRandomizeButton() {

		return $el("button.JNodes-search-randomize-btn", {
			textContent: "🎲",
			title: "Random Suggestion",
			onclick: async () => {

				// Basically, we get a child element from the current list randomly
				// Then if it has searchTerms, which all items should, we parse them out into an array
				// Then we get a random term, clean it up a little, and if it's valid we execute search with it
				const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
				const children = imageDrawerListInstance.getImageListChildren();

				if (children.length > 1) {
					let selectedChildElement = null;

					do {
						const randomIndex = Math.floor(Math.random() * children.length);
						selectedChildElement = children[randomIndex];
					} while (!selectedChildElement || !selectedChildElement.searchTerms);

					if (selectedChildElement?.searchTerms) {

						const splitTerms = selectedChildElement.searchTerms.split(" ");
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
		return this.searchFieldElement.value;
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

		// Loop through items and check for a match
		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		const children = imageDrawerListInstance.getImageListChildren();
		for (let i = 0; i < children.length; i++) {

			const itemsSearchTerms = children[i]?.searchTerms?.toLowerCase().trim();

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
			utilitiesInstance.setElementVisible(children[i], bShouldEvaluateSearch ? bDoesItemTextIncludeSearchTerm : true);
		}

		const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
		batchSelectionManagerInstance.updateWidget();
	}

	// Function to execute search using the term entered in the SearchBar
	executeSearchWithEnteredSearchText() {
		// Get input value
		let searchTerm = this.searchFieldElement?.value;

		this.executeSearch(searchTerm);
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerSearch);
