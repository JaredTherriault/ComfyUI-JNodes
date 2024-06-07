import { $el } from "/scripts/ui.js";

import * as Contexts from "./Contexts.js";

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

class ImageDrawerContextSelector extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.ContextSelector;
		this.lastSelectedContextOption;
	}

	getCurrentContextName() {
		return this.ContextSelector.value;
	}

	getCurrentContextObject() {
		return Contexts.getContextObjectFromName(this.ContextSelector.value);
	}

	setOptionSelected(option) {
		this.ContextSelector.value = option;
		this.onOptionSelected(option);
	}

	async onOptionSelected(selectedValue) {
		//		console.log("ContextSelector selectedValue:" + selectedValue);

		const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");

		// Create cache for previously selected option
		if (this.lastSelectedContextOption) {

			const lastContextObject = Contexts.getContextObjectFromName(this.lastSelectedContextOption);
			if (lastContextObject) {
				lastContextObject.makeCache();
			}
		}

		const NewContext = Contexts.getContextObjectFromName(selectedValue);
		await NewContext.switchToContext();

		// Set up lastSelectedContextOption to accommodate future context switching
		this.lastSelectedContextOption = selectedValue;

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

	createContextSelector() {

		this.ContextSelector = $el("select");

		Contexts.initializeContexts();

		this.lastSelectedContextOption = Contexts.getContexts().feed.name;

		for (const contextKey in Contexts.getContexts()) {
			const context = Contexts.getContexts()[contextKey];
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