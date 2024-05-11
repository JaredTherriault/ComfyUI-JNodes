import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

class ImageDrawerSearch extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.searchBarElement;
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

		// Loop through items and check for a match
		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		const children = imageDrawerListInstance.getImageListChildren();
		for (let i = 0; i < children.length; i++) {
			let itemText = children[i]?.searchTerms?.toLowerCase().trim();
			//console.log(itemText + " matched against " + searchTerm + ": " + itemText.includes(searchTerm));

			utilitiesInstance.setElementVisible(children[i], itemText ? itemText.includes(sanitizedSearchTerm) : true)
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
