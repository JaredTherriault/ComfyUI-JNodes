import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

class ImageDrawerSearch extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.searchBarElement;
		this.bMatchAny = true;
	}

	createSearchBar() {

		this.searchBarElement = $el("input", {
			type: "text",
			id: "SearchInput",
			placeholder: "Type here to search",
			autocomplete: "off",
			style: {
				width: '100%',
			}
		});

		// Attach the handleSearch function to the input's 'input' event
		this.searchBarElement?.addEventListener('input', () => { this.executeSearchWithEnteredSearchText(); });

		return this.searchBarElement;
	}

	createSearchBarClearButton() {

		return $el("button.JNodes-search-bar-clear-btn", {
			textContent: "❌",
			title: "Clear Search",
			onclick: () => { this.clearAndExecuteSearch(); }
		});
	}

	createSearchRandomizeButton() {

		return $el("button.JNodes-search-randomize-btn", {
			textContent: "🎲",
			title: "Random Suggestion",
			onclick: async () => {
				let loraDicts = await ExtraNetworks.getLoras();
				const loraKeys = Object.keys(loraDicts);
				const randomIndex = Math.floor(Math.random() * loraKeys.length);
				imageDrawerSearchInstance.setSearchTextAndExecute(loraKeys[randomIndex]);
			}
		});
	}

	clearSearch() {
		if (!this.searchBarElement) { return; }
		this.searchBarElement.value = "";
	}

	getSearchText() {
		return this.searchBarElement.value;
	}

	setSearchText(newText) {
		if (!this.searchBarElement) { return; }
		this.searchBarElement.value = newText;
	}

	setSearchTextAndExecute(newText) {
		if (!this.searchBarElement) { return; }
		this.searchBarElement.value = newText;
		this.executeSearchWithEnteredSearchText();
	}

	clearAndExecuteSearch() {
		this.clearSearch();
		this.executeSearchWithEnteredSearchText();
	}

	focusSearch() {
		this.searchBarElement.focus();
	}

	focusAndSelectSearchText() {
		this.searchBarElement.select(); // Select focuses already
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
	}

	// Function to execute search using the term entered in the SearchBar
	executeSearchWithEnteredSearchText() {
		// Get input value
		let searchTerm = this.searchBarElement?.value;

		this.executeSearch(searchTerm);
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerSearch);
