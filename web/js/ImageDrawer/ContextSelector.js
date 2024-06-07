import { $el } from "/scripts/ui.js";

import * as Contexts from "./Contexts.js";

import { imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

let ContextSelector;

let lastSelectedContextOption;

export function getCurrentContextName() {
	return ContextSelector.value;
}

export function getCurrentContextObject() {
	return Contexts.getContextObjectFromName(ContextSelector.value);
}

export function getCacheForContext(contextName) {
	return Contexts.getContextObjectFromName(contextName)?.cache;
}

export function setOptionSelected(option) {
	ContextSelector.value = option;
	onOptionSelected(option);
}

export async function onOptionSelected(selectedValue) {
	//		console.log("ContextSelector selectedValue:" + selectedValue);

	const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");

	// Create cache for previously selected option
	if (lastSelectedContextOption) {

		const lastContextObject = Contexts.getContextObjectFromName(lastSelectedContextOption);
		if (lastContextObject) {
			lastContextObject.makeCache();
		}
	}

	const NewContext = Contexts.getContextObjectFromName(selectedValue);
	await NewContext.switchToContext();

	// Set up lastSelectedContextOption to accommodate future context switching
	lastSelectedContextOption = selectedValue;

	// Setup sorting
	const imageDrawerListSortingInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerListSorting");
	imageDrawerListSortingInstance.setSortingOptionsFromSortTypeArray(NewContext.getSupportedSortTypes());

	const sortType = NewContext.getDesiredSortType();
	if (sortType && typeof sortType === 'object') {
		imageDrawerListSortingInstance.setOptionSelectedFromSortType(sortType.type, sortType.bIsAscending);
	} else if (sortType && typeof sortType === 'string') {
		imageDrawerListSortingInstance.setOptionSelectedFromOptionName(sortType);
	}

	const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
	batchSelectionManagerInstance.updateWidget();

	// Automatically focus search bar and select text to save user a click
	imageDrawerSearchInstance.focusAndSelectSearchText();
}

export function createContextSelector() {

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
	ContextSelector.addEventListener("change", async function () {
		const selectedValue = ContextSelector.value;
		onOptionSelected(selectedValue);
		// await api.fetchApi(
		// 	'/jnodes_request_task_cancellation', { method: "POST"}); // Cancel any outstanding python task
	});

	// Initialize
	setOptionSelected(lastSelectedContextOption);

	return ContextSelector;
};
