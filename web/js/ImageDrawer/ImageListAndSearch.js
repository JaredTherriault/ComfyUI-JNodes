import { $el } from "/scripts/ui.js";

import { observeVisualElement, unobserveVisualElement } from "../common/ImageAndVideoObserver.js";
import { getVisualElements, setElementVisibility } from "../common/Utilities.js";

const imageList = $el("div.JNodes-image-drawer-list", {
	style: {
		visibility: 'visible',
	}
});


let SearchBar;

// Helpers

export function getImageListElement() {
	return imageList;
}

// Returns all child nodes of any kind
export function getImageListChildren() {
	return imageList.childNodes;
}

export function replaceImageListChildren(newChildren) {
	clearImageListChildren();
	for (let child of newChildren) {
		addElementToImageList(child, false);
	}

	executeSearchWithEnteredSearchText();
}

export function clearImageListChildren() {
	let currentChildren = getImageListChildren();
	const childNodeCount = currentChildren.length;
	for (let childIndex = childNodeCount - 1; childIndex >= 0; childIndex--) {
		removeElementFromImageList(currentChildren[childIndex], false);
	}
};

export function removeElementFromImageList(element, bHandleSearch = true) {
	if (element != undefined) {
		//console.log("removing element: " + element);
		for (let visualElement of getVisualElements(element)) {
			unobserveVisualElement(visualElement);

			if (visualElement.tagName === 'VIDEO') {
				// Try to pause the video before unloading
				try {
					visualElement.pause();
				} catch { }

				if ('src' in visualElement) {
					visualElement.removeAttribute('src'); // Unload video
					if (visualElement.load) { visualElement.load(); } // Release memory
				}
			}
		}
		imageList.removeChild(element);
		if (bHandleSearch) {
			executeSearchWithEnteredSearchText();
		}
	} else {
		console.log("Attempted to remove undefined element");
	}
};

export async function addElementToImageList(element, bHandleSearch = true) {
	//console.log("adding element: " + element);
	if (element != undefined) {
		imageList.appendChild(element);
		for (let visualElement of getVisualElements(element)) {
			observeVisualElement(visualElement);
		}
		if (bHandleSearch) {
			executeSearchWithEnteredSearchText();
		}
	} else {
		console.log("Attempted to add undefined element");
	}
};

export function getImageListScrollLevel() {
	if (imageList) {
		return imageList.scrollTop;
	}
}

export function setImageListScrollLevel(newScrollPosition) {
	if (imageList) {
		imageList.scrollTop = newScrollPosition;
	}
}

export function createSearchBar() {
	SearchBar = $el("input", {
		type: "text",
		id: "SearchInput",
		placeholder: "Type here to search",
		autocomplete: "off",
		style: {
			width: '100%',
		}
	});

	// Attach the handleSearch function to the input's 'input' event
	SearchBar?.addEventListener('input', executeSearchWithEnteredSearchText);

	return SearchBar;
}

export function clearSearch() {
	if (!SearchBar) { return; }
	SearchBar.value = "";
}

export function getSearchText() {
	return SearchBar.value;
}

export function setSearchText(newText) {
	if (!SearchBar) { return; }
	SearchBar.value = newText;
}

export function setSearchTextAndExecute(newText) {
	if (!SearchBar) { return; }
	SearchBar.value = newText;
	executeSearchWithEnteredSearchText();
}

export function clearAndExecuteSearch() {
	clearSearch();
	executeSearchWithEnteredSearchText();
}

export function focusSearch() {
	SearchBar.focus();
}

export function focusAndSelectSearchText() {
	SearchBar.select(); // Select focuses already
}

// Function to execute seach with an explicit searchTerm
export function executeSearch(searchTerm) {

	// Provision search string
	const sanitizedSearchTerm = searchTerm.toLowerCase().trim();

	// Loop through items and check for a match
	const children = getImageListChildren();
	for (let i = 0; i < children.length; i++) {
		let itemText = children[i]?.searchTerms?.toLowerCase().trim();
		//console.log(itemText + " matched against " + searchTerm + ": " + itemText.includes(searchTerm));

		setElementVisibility(children[i], itemText ? itemText.includes(sanitizedSearchTerm) : true)
	}
}

// Function to execute search using the term entered in the SearchBar
export function executeSearchWithEnteredSearchText() {
	// Get input value
	let searchTerm = SearchBar?.value;

	executeSearch(searchTerm);
}