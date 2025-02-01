import { $el } from "/scripts/ui.js";

import * as Contexts from "./Contexts.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

class ImageDrawerContextSelector extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.ContextSelector;
		this.lastSelectedContextOption;
		this.contexts;
	}

	getContexts() {
		return this.contexts;
	}

	getContextObjectFromName(contextName) {
		const contextValues = Object.values(this.contexts);

		let foundContext;

		for (const context of contextValues) {
			if (context.name == contextName) {
				foundContext = context;
				break;
			}
		}

	if (foundContext) {
		return foundContext;
	} else {
		console.error(`ImageDrawerContext with name '${contextName}' not found.`);
		return null;
	}
}

	getCurrentContextName() {
		return this.ContextSelector.value;
	}

	getCurrentContextObject() {
		if (this.ContextSelector) {
			return this.getContextObjectFromName(this.ContextSelector.value);
		}

		return null;
	}

	setOptionSelected(option) {
		this.ContextSelector.value = option;
		this.onOptionSelected(option);
	}

	async onOptionSelected(selectedValue) {
		//		console.log("ContextSelector selectedValue:" + selectedValue);

		const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");

		// Create cache for previously selected option
		if (this.lastSelectedContextOption) {

			const lastContextObject = this.getContextObjectFromName(this.lastSelectedContextOption);
			if (lastContextObject) {
				lastContextObject.makeCache();
			}
		}

		const NewContext = this.getContextObjectFromName(selectedValue);
		await NewContext.switchToContext();

		// Set up lastSelectedContextOption to accommodate future context switching
		this.lastSelectedContextOption = selectedValue;

		// Setup sorting
		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		imageDrawerListSortingInstance.setSortingOptionsFromSortTypeArray(NewContext.getSupportedSortTypes());

		const sortType = NewContext.getDesiredSortType();
		if (sortType && typeof sortType === 'object') {
			imageDrawerListSortingInstance.setOptionSelectedFromSortType(sortType.type, sortType.bIsAscending);
		} else if (sortType && typeof sortType === 'string') {
			imageDrawerListSortingInstance.setOptionSelectedFromOptionName(sortType);
		}

		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		batchSelectionManagerInstance.updateWidget();

		// Automatically focus search bar and select text to save user a click
		imageDrawerSearchInstance.focusAndSelectSearchText();
	}

	createContextSelector() {

		this.ContextSelector = $el("select");

		this.contexts = Contexts.initializeContexts(this.imageDrawerInstance);

		this.lastSelectedContextOption = this.getContexts().feed.name;

		for (const contextKey in this.getContexts()) {
			const context = this.getContexts()[contextKey];
			const option = document.createElement("option");
			option.value = context.name;
			option.textContent = context.name;
			option.title = context.tooltip;
			this.ContextSelector.appendChild(option);
		}

		// Add an event listener for the "change" event
		this.ContextSelector.addEventListener("change", async () => {
			const selectedValue = this.ContextSelector.value;
			this.onOptionSelected(selectedValue);
			// await api.fetchApi(
			// 	'/jnodes_request_task_cancellation', { method: "POST"}); // Cancel any outstanding python task
		});

		// Initialize
		this.setOptionSelected(this.lastSelectedContextOption);

		return this.ContextSelector;
	};

}

const factoryInstance = new ClassInstanceFactory(ImageDrawerContextSelector);