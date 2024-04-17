import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";

import * as Contexts from "./Contexts.js";
import * as Sorting from "./Sorting.js";
import {
	getColumnCount, getDrawerHeight, getDrawerWidth
} from "./ImageDrawer.js"

import {
	focusAndSelectSearchText, getSearchText, getImageListChildren, getImageListScrollLevel
} from "./ImageListAndSearch.js"

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

	const bSkipRestore = true;
	getCurrentContextObject()?.switchToContext(bSkipRestore);
}

export function setOptionSelected(option) {
	ContextSelector.value = option;
	onOptionSelected(option);
}

export async function onOptionSelected(selectedValue) {
	//		console.log("ContextSelector selectedValue:" + selectedValue);

	// Create cache for previously selected option
	if (lastSelectedContextOption) {
		const childNodesArray = Array.from(getImageListChildren());
		const newCache =
			new Contexts.ImageDrawerContextCache(
				getImageListScrollLevel(), getSearchText(), 
				getColumnCount(), getDrawerWidth(), getDrawerHeight(), 
				childNodesArray, Sorting.getCurrentSortTypeName());
		Contexts.getContextObjectFromName(lastSelectedContextOption)?.setCache(newCache);
	}

	const NewContext = Contexts.getContextObjectFromName(selectedValue);
	await NewContext.switchToContext();

	// Set up lastSelectedContextOption to accommodate future context switching
	lastSelectedContextOption = selectedValue;

	// Setup sorting
	Sorting.setSortingOptionsFromSortTypeArray(NewContext.getSupportedSortTypes());
	
	const sortType = NewContext.getDesiredSortType();
	if (sortType && typeof sortType === 'object') {
		Sorting.setOptionSelectedFromSortType(sortType.type, sortType.bIsAscending);
	} else if (sortType && typeof sortType === 'string') {
		Sorting.setOptionSelectedFromOptionName(sortType);
	}

	// Automatically focus search bar and select text to save user a click
	focusAndSelectSearchText();
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
		option.title = context.tooltip;
		ContextSelector.appendChild(option);
	}

	// Add an event listener for the "change" event
	ContextSelector.addEventListener("change", async function() {
		const selectedValue = ContextSelector.value;
		onOptionSelected(selectedValue);
		// await api.fetchApi(
		// 	'/jnodes_request_task_cancellation', { method: "POST"}); // Cancel any outstanding python task
	});

	// Initialize
	setOptionSelected(lastSelectedContextOption);

	return ContextSelector;
};
