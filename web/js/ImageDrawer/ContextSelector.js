import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ImageElements from "./ImageElements.js"
import {
	getImageListChildren, replaceImageListChildren, clearImageListChildren, 
	addElementToImageList, getImageListScrollLevel, setImageListScrollLevel,
	getSearchText
} from "./imageDrawer.js"

import { decodeReadableStream } from "../common/utils.js"

let ContextSelector;

// Context selection constants
export const contextSelectorOptionNames = {
	feed: { name: "feed", description: "The latest generations from this web session (cleared on page refresh)" },
	temp: { name: "temp/history", description: "The generations you've created since the last comfyUI server restart" },
	//	input: { name: "input", description: "Images and videos found in your input folder"},
	output: { name: "output", description: "Images and videos found in your output folder" },
	lora: { name: "Lora/Lycoris", description: "Lora and Lycoris models found in your Lora directory" },
	//	embeddings: { name: "Embeddings", description: "Embedding/textual inversion models found in your embeddings directory"},
	//	pngInfo: { name: "Image Info", description: "Read and display metadata from an image or video"},
	//	compare: { name: "Compare", description: "Compare generations sent to this context via menu"},
	//	resources: { name: "Resources", description: "For things like poses, depth images, etc"},
};

class ContextState {
	constructor(scrollLevel, searchBarText, childElements) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.childElements = childElements;
	}
};

let lastSelectedContextOption = contextSelectorOptionNames.feed.name;
let contextCache = new Map();

export function getCurrentContext() {
	return ContextSelector.value;
}

export function getContextKeys() {
	return Object.keys(contextCache);
}

export function getCacheForKey(key) {
	return contextCache.get(key);
}

export function reverseItemsInCache() {
	const contextKeys = ContextSelector.getContextKeys();
	for (const key in contextKeys) {
		contextCache[key].replaceChildren(contextCache[key].reverse());
	}
}

async function loadLoras() {
	clearImageListChildren();
	addElementToImageList($el("label", { textContent: "Loading loras..." }));
	let loraDicts = await ExtraNetworks.getLoras();
	clearImageListChildren(); // Remove loading indicator
	//console.log("loraDicts: " + JSON.stringify(loraDicts));
	const loraKeys = Object.keys(loraDicts);
	if (loraKeys.length > 0) {
		let count = 0;
		let maxCount = 0;
		for (const lora of loraKeys) {
			if (maxCount > 0 && count > maxCount) { break; }
			let element = await ExtraNetworks.createExtraNetworkCard(lora, loraDicts[lora]);
			if (element == undefined) {
				console.log("Attempting to add undefined element for lora named: " + lora + " with dict: " + JSON.stringify(loraDicts[lora]));
			}
			addElementToImageList(element);
			count++;
		}
	}
	else {
		addElementToImageList($el("label", { textContent: "No loras or locons were found." }));
	}
}

async function loadHistory() {
	clearImageListChildren();
	addElementToImageList($el("label", { textContent: "Loading history..." }));
	const allHistory = await api.getHistory(100000)
	clearImageListChildren(); // Remove loading indicator
	for (const history of allHistory.History) {
		if (!history.outputs) { continue; }

		const keys = Object.keys(history.outputs);
		if (keys.length > 0) {
			for (const key of keys) {
				//							console.debug(key)
				if (!history.outputs[key].images) { continue; }
				for (const src of history.outputs[key].images) {
					//									console.debug(im)
					let element = await ImageElements.createImageElementFromImgSrc(src);
					if (element == undefined) { console.log(`Attempting to add undefined image element in {selectedValue}`); }
					addElementToImageList(element);
				}
			}
		}
	}
}

async function loadOutput() {
	clearImageListChildren();
	addElementToImageList($el("label", { textContent: "Loading output folder..." }));
	const allOutputItems = await api.fetchApi("/jnodes_output_items") //jnodes_output_items

	// Decode into a string
	const decodedString = await decodeReadableStream(allOutputItems.body);

	const asJson = JSON.parse(decodedString);

	clearImageListChildren(); // Remove loading indicator
	//for (const folder of allOutputItems) {
	//if (!folder.files) { continue; }
	if (asJson.files.length > 0) {
		for (const file of asJson.files) {
			let element = await ImageElements.createImageElementFromImgSrc({ filename: file, type: 'output', subfolder: asJson.folder_path });
			if (element == undefined) { console.log(`Attempting to add undefined image element in {selectedValue}`); }
			addElementToImageList(element);
		}
	}
	//}
}

export const createContextSelector = () => {

	function checkContextCache(selectedValue) {
		const bHasCache = contextCache.has(selectedValue);
		if (bHasCache) {
			const cachedContent = contextCache.get(selectedValue);
			// Replace children
			replaceImageListChildren(...cachedContent.childElements); // Spread the array 
			// Execute Search
			setSearchTextAndExecute(cachedContent.searchBarText);
			// Restore scroll level
			setImageListScrollLevel(cachedContent.scrollLevel);
		}
		return bHasCache;
	}

	ContextSelector = $el("select");

	for (const optionLabel in contextSelectorOptionNames) {
		if (contextSelectorOptionNames.hasOwnProperty(optionLabel)) {
			const option = document.createElement("option");
			option.value = contextSelectorOptionNames[optionLabel].name;
			option.textContent = contextSelectorOptionNames[optionLabel].name;
			option.title = contextSelectorOptionNames[optionLabel].description;
			ContextSelector.appendChild(option);
		}
	}

	// Add an event listener for the "change" event
	ContextSelector.addEventListener("change", async function() {
		const selectedValue = ContextSelector.value;
		// Call your custom function or perform actions based on the selected value
		console.log("ContextSelector selectedValue:" + selectedValue);

		// Create cache for previously selected option
		if (lastSelectedContextOption) {
			const childNodesArray = Array.from(getImageListChildren());
			contextCache.set(lastSelectedContextOption, new ContextState(getImageListScrollLevel(), getSearchText(), childNodesArray));
			console.log("contextCache: " + JSON.stringify(contextCache));
		}

		// Replace imageList with appropriate elements
		if (selectedValue == contextSelectorOptionNames.feed.name) {
			if (!checkContextCache(selectedValue)) {
				clearImageListChildren();
			}
			const imageListLength = getImageListChildren().length;
			if (imageListLength < feedImages.length) {
				for (let imageIndex = imageListLength; imageIndex < feedImages.length; imageIndex++) {
					const src = feedImages[imageIndex];
					let element = await ImageElements.createImageElementFromImgSrc(src);
					if (element == undefined) { console.log(`Attempting to add undefined image element in {selectedValue}`); }
					addElementToImageList(element);
				}
			}
		}
		else if (selectedValue == contextSelectorOptionNames.lora.name) {
			if (!checkContextCache(selectedValue)) {
				await loadLoras();
			}
		}
		else if (selectedValue == contextSelectorOptionNames.temp.name) {
			if (!checkContextCache(selectedValue)) {
				await loadHistory();
			}
		}
		else if (selectedValue == contextSelectorOptionNames.output.name) {
			if (!checkContextCache(selectedValue)) {
				await loadOutput();
			}
		}

		// Set up lastSelectedContextOption to accommodate future context switching
		lastSelectedContextOption = selectedValue;

		// Automatically focus search bar and select text to save user a click
		focusAndSelectSearchText();
	});

	return ContextSelector;
};
