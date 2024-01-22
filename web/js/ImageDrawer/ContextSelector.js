import { $el } from "/scripts/ui.js";

import * as Contexts from "./Contexts.js";
import {
	getImageListChildren, getImageListScrollLevel, getSearchText, 
	focusAndSelectSearchText, getColumnCount, getDrawerSize
} from "./imageDrawer.js"

let ContextSelector;

let lastSelectedContextOption;

export function getCurrentContextName() {
	return ContextSelector.value;
}

export function getCurrentContextObject() {
	return Contexts.getContextObjectFromName(ContextSelector.value);
}

export function getCacheForContext(contextName) {
	return Contexts.getContextObjectFromName(contextName).cache;
}

export function reverseItemsInCaches() {
	for (const context in Contexts.getContexts()) {
		Contexts.getContexts()[context]?.reverseItemsInCache();
	}

	getCurrentContextObject()?.switchToContext();
}

export const createContextSelector = () => {

	ContextSelector = $el("select");
	
	Contexts.initializeContexts();

	lastSelectedContextOption = Contexts.getContexts().feed.name;

	for (const contextKey in Contexts.getContexts()) {
		const context = Contexts.getContexts()[contextKey];
		const option = document.createElement("option");
		option.value = context.name;
		option.textContent = context.name;
		option.title = context.description;
		ContextSelector.appendChild(option);
	}

	// Add an event listener for the "change" event
	ContextSelector.addEventListener("change", async function() {
		const selectedValue = ContextSelector.value;
		// Call your custom function or perform actions based on the selected value
//		console.log("ContextSelector selectedValue:" + selectedValue);

		// Create cache for previously selected option
		if (lastSelectedContextOption) {
			const childNodesArray = Array.from(getImageListChildren());
			const newCache = 
				new Contexts.ImageDrawerContextCache(
					getImageListScrollLevel(), getSearchText(), getColumnCount(), getDrawerSize(), childNodesArray);
			Contexts.getContextObjectFromName(lastSelectedContextOption)?.setCache(newCache);
		}
		
		const NewContext = Contexts.getContextObjectFromName(selectedValue);
		await NewContext.switchToContext();

		// Set up lastSelectedContextOption to accommodate future context switching
		lastSelectedContextOption = selectedValue;

		// Automatically focus search bar and select text to save user a click
		focusAndSelectSearchText();
	});

	return ContextSelector;
};
