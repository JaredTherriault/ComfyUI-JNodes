import { $el } from "/scripts/ui.js";

import { SearchBar } from "../common/SearchBar.js"

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

class ImageDrawerSearch extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		// Reimplemented SearchBar ctor
		this._elementContainer = null;
		this._searchFieldElement = null;
		this._bMatchAny = false; // Whether to return results with any of the given tokens or only results that match all tokens
		this._matchButtonElement = null;

        this._searchTimeout = null;
        this._searchTimeoutMs = 500;
	}

	// Function to execute seach with an explicit searchTerm
	_executeSearch(searchTerm) {

		// Call SearchBar's function
		SearchBar.prototype._executeSearch.call(this, searchTerm);

		// Update Widgets
		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		batchSelectionManagerInstance.updateWidget();
	}
}

// Apply all SearchBar methods and instance properties
utilitiesInstance.applyMixin(ImageDrawerSearch, SearchBar);

const factoryInstance = new ClassInstanceFactory(ImageDrawerSearch);
