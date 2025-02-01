import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";

import * as ExtraNetworks from "./ImageListChildElements/ExtraNetworks.js";
import * as ImageElements from "./ImageListChildElements/ImageElements.js";

import * as SortTypes from "../common/SortTypes.js"

import { utilitiesInstance } from "../common/Utilities.js"

import {
	createLabeledCheckboxToggle, createLabeledSliderRange, createVideoPlaybackOptionsFlyout,
	options_LabeledCheckboxToggle, options_LabeledSliderRange, setting_ModelCardAspectRatio,
	setting_FavouritesDirectory
} from "../common/SettingsManager.js";

import { SearchableDropDown } from "../common/SearchableDropDown.js";

export function initializeContexts(imageDrawerInstance) {

	return {
		feed: new ContextFeed(imageDrawerInstance),
		temp: new ContextTemp(imageDrawerInstance),
		favoourites: new ContextFavourites(imageDrawerInstance),
		input: new ContextInput(imageDrawerInstance),
		output: new ContextOutput(imageDrawerInstance),
		lora: new ContextLora(imageDrawerInstance),
		embeddings: new ContextEmbeddings(imageDrawerInstance),
		//savedPrompts: new ContextSavedPrompts(imageDrawerInstance),
		//			metadata: new ContextMetadataReader(imageDrawerInstance),
		//			compare: new ContextCompare(imageDrawerInstance),
	};
};

export class ImageDrawerContextCache {
	constructor(scrollLevel, searchBarText, imageListElements, sortType, customContextCacheData = null) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.imageListElements = imageListElements;
		this.sortType = sortType;
		this.customContextCacheData = customContextCacheData;
	}
};

export class ImageDrawerContext {
	constructor(name, tooltip, imageDrawerInstance) {
		this.name = name;
		this.tooltip = tooltip;
		this.imageDrawerInstance = imageDrawerInstance;
		this.cache = null;
	}

	hasCache() {
		return this.cache != null;
	}

	setCache(newCache) {
		if (!(newCache instanceof ImageDrawerContextCache)) {
			console.error("Invalid cache type. Expected ImageDrawerContextCache.");
			return;
		}
		this.cache = newCache;
	}

	makeCache() {

		const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		const childNodesArray = Array.from(imageDrawerListInstance.getImageListChildren());

		const newCache =
			new ImageDrawerContextCache(
				imageDrawerListInstance.getImageListScrollLevel(), imageDrawerSearchInstance.getSearchText(),
				childNodesArray, imageDrawerListSortingInstance.getCurrentSortTypeName());
		this.setCache(newCache);
	}

	async switchToContext(bSkipRestore = false) {

		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		imageDrawerListSortingInstance.stopAutomaticShuffle();

		const bSuccessfulRestore = bSkipRestore || await this.checkAndRestoreContextCache();
		if (!bSuccessfulRestore) {
			const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
			imageDrawerSearchInstance.clearAndExecuteSearch(); // Reset search if no cache
		}

		const imageDrawerMainInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerMain");
		imageDrawerMainInstance.setContextToolbarWidget(await this.makeToolbar());

		return bSuccessfulRestore;
	}

	async makeToolbar() {
		const container = $el("div", { //Inner container so it can maintain 'flex' display attribute
			style: {
				alignItems: 'normal',
				display: 'flex',
				gap: '.5rem',
				flex: '0 1 100%',
				justifyContent: 'flex-end',
			}
		});

		const scrollToTopButton = $el("button.JNodes-image-drawer-btn", {
			textContent: "⏫",
			title: "Jump to top of list",
			onclick: async () => {
				const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
				imageDrawerListInstance.getImageListElement().scrollTop = 0;
				scrollToTopButton.blur();
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		container.appendChild(scrollToTopButton);

		return container;
	}

	async checkAndRestoreContextCache() {
		if (this.hasCache()) {
			if (this.cache.imageListElements.length > 0) {

				const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
				const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
				const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");

				// Replace children
				imageDrawerListInstance.replaceImageListChildren(this.cache.imageListElements);
				// Execute Search
				imageDrawerSearchInstance.setSearchTextAndExecute(this.cache.searchBarText);
				// Restore sort type
				imageDrawerListSortingInstance.setOptionSelectedFromOptionName(this.cache.sortType);
				// Restore scroll level
				imageDrawerListInstance.setImageListScrollLevel(this.cache.scrollLevel);

				return true;
			}
		}
		return false;
	}

	onRequestShowInFileManager(item) {
		if (item && item.showInFileManager) {
			item.showInFileManager();
		}
	}

	onRequestSingleDeletion(item) {
		if (item && item.deleteItem) {
			item.deleteItem();
		}
	}

	onRequestBatchDeletion() {
		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		for (const child of batchSelectionManagerInstance.getValidSelectedItems()) {
			this.onRequestSingleDeletion(child);
		}
	}

	onRequestSingleRemoval(item) {
		if (item && item.removeItemFromImageList) {
			item.removeItemFromImageList();
		}
	}

	onRequestBatchRemoval() {
		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		for (const child of batchSelectionManagerInstance.getValidSelectedItems()) {
			this.onRequestSingleRemoval(child);
		}
	}

	onRequestSingleFavourite(item) {
		if (item && item.copyItem) {
			item.copyItem(setting_FavouritesDirectory.value);
		}
	}

	onRequestBatchFavourite() {
		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		for (const child of batchSelectionManagerInstance.getValidSelectedItems()) {
			this.onRequestSingleFavourite(child);
		}
	}

	getSupportedSortTypes() {
		return [SortTypes.SortTypeFilename, SortTypes.SortTypeDate, SortTypes.SortTypeShuffle];
	}

	getDesiredSortType() {
		return this.cache?.sortType || this.getDefaultSortType();
	}

	getDefaultSortType() {
		return { type: SortTypes.SortTypeFilename, bIsAscending: true };
	}

	shouldCancelAsyncOperation() {
		const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
		return imageDrawerContextSelectorInstance.getCurrentContextObject() != this; // By default, cancel async operations if the selected context has changed
	}
}

export class ContextClearable extends ImageDrawerContext {
	async onClearClicked() { }

	async makeToolbar() {
		// Remove all images from the list
		let clearButton = $el("button.JNodes-image-drawer-btn", {
			textContent: "Clear",
			onclick: async () => {
				await this.onClearClicked();
				clearButton.blur();
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		const finalWidget = await super.makeToolbar();

		finalWidget.insertBefore(clearButton, finalWidget.firstChild);

		const flyoutHandle = createVideoPlaybackOptionsFlyout().handle;

		finalWidget.insertBefore(flyoutHandle, finalWidget.firstChild);

		return finalWidget;
	}

	getSupportedSortTypes() {
		const NewSortTypes = [
			SortTypes.SortTypeFileSize, SortTypes.SortTypeImageWidth,
			SortTypes.SortTypeImageHeight, SortTypes.SortTypeImageAspectRatio, SortTypes.SortTypeFileType
		];
		return super.getSupportedSortTypes().concat(NewSortTypes);
	}
}

export class ContextRefreshable extends ImageDrawerContext {

	async onRefreshClicked() {
		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		imageDrawerListSortingInstance.stopAutomaticShuffle();
		imageDrawerListSortingInstance.sortWithCurrentType();
	}

	async makeToolbar() {
		// Refresh button
		let refreshButton = $el("button.JNodes-image-drawer-btn", {
			textContent: "Refresh",
			onclick: async () => {
				await this.onRefreshClicked();
				refreshButton.blur();
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		const finalWidget = await super.makeToolbar();

		finalWidget.insertBefore(refreshButton, finalWidget.firstChild);

		return finalWidget;
	}
}

export class ContextModel extends ContextRefreshable {
	constructor(name, description, imageDrawerInstance, type) {
		super(name, description, imageDrawerInstance);
		this.type = type;
	}

	async getModels(bForceRefresh = false) { }

	async loadModels(bForceRefresh = false) {
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.clearImageListChildren();
		await imageDrawerListInstance.addElementToImageList($el("label", { textContent: `Loading ${this.name}...` }));
		let modelDicts = await this.getModels(bForceRefresh);
		if (this.shouldCancelAsyncOperation()) { return; }
		imageDrawerListInstance.clearImageListChildren(); // Remove loading indicator
		//console.log("modelDicts: " + JSON.stringify(loraDicts));
		const modelKeys = Object.keys(modelDicts);
		if (modelKeys.length > 0) {
			let count = 0;
			let maxCount = 0;
			imageDrawerListInstance.notifyStartChangingImageList();
			for (const modelKey of modelKeys) {
				if (this.shouldCancelAsyncOperation()) { break; }

				if (maxCount > 0 && count > maxCount) { break; }
				let element = await ExtraNetworks.createExtraNetworkCard(modelKey, modelDicts[modelKey], this.type, this.imageDrawerInstance);
				if (element == undefined) {
					console.log("Attempting to add undefined element for model named: " + modelKey + " with dict: " + JSON.stringify(modelDicts[modelKey]));
				}
				await imageDrawerListInstance.addElementToImageList(element);
				count++;
			}
			imageDrawerListInstance.notifyFinishChangingImageList();
		}
		else {
			imageDrawerListInstance.notifyStartChangingImageList();
			await imageDrawerListInstance.addElementToImageList($el("label", { textContent: "No models were found." }));
			imageDrawerListInstance.notifyFinishChangingImageList();
		}

	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.loadModels();
		}
	}

	async makeToolbar() {

		const container = await super.makeToolbar();

		let options = new options_LabeledSliderRange();
		options.labelTextContent = 'Card Aspect Ratio:'
		options.id = 'ModelCardAspectRatioSlider';
		options.value = setting_ModelCardAspectRatio.value;
		options.min = 0.1;
		options.max = 2;
		options.step = 0.01;
		options.bIncludeValueLabel = true;
		options.valueLabelFractionalDigits = 2;
		options.oninput = async (e) => {
			setting_ModelCardAspectRatio.value = e.target.valueAsNumber;
			const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
			for (let element of imageDrawerListInstance.getImageListChildren()) {
				if (element.classList.contains('extraNetworksCard')) {
					element.style.aspectRatio = setting_ModelCardAspectRatio.value;
				}
			}
		};

		container.insertBefore(createLabeledSliderRange(options), container.firstChild);

		return container;
	}

	async onRefreshClicked() {
		await this.loadModels(true);
		super.onRefreshClicked();
	}

	onRequestSingleDeletion(item) {
		// Unimplemented
	}

	onRequestBatchDeletion() {
		// Unimplemented
	}

	onRequestSingleRemoval(item) {
		// Unimplemented
	}

	onRequestBatchRemoval() {
		// Unimplemented
	}

	getSupportedSortTypes() {
		return super.getSupportedSortTypes().concat([SortTypes.SortTypeFriendlyName]);
	}

	getDefaultSortType() {
		return { type: SortTypes.SortTypeFriendlyName, bIsAscending: true };
	}
}

export class ContextSubdirectoryExplorer extends ContextRefreshable {
	constructor(name, description, imageDrawerInstance, directoryName, bShouldForceLoad = false) {
		super(name, description, imageDrawerInstance);
		this.rootDirectoryName = directoryName;
		this.rootDirectoryDisplayName = '/root';
		this.bIncludeSubdirectories = false;
		this.fileList = null;
		this.subdirectorySelector = null;
		this.bShouldForceLoad = bShouldForceLoad; // Whether or not to lazy load. Lazy load = !bShouldForceLoad
	}

	async updateSubdirectorySelectorOptions() {

		// Fill out combo box options based on paths
		const lastSelectedValue = this.subdirectorySelector.data.getSelectedOptionName(); // Cache last selection
		this.subdirectorySelector.data.clearOptions();

		// Indicate loading
		const loadingIndicatorText = "Loading...";
		this.subdirectorySelector.data.addOptionUnique(loadingIndicatorText, loadingIndicatorText);
		this.subdirectorySelector.data.setOptionSelected(loadingIndicatorText);

		const subdirectoriesResponse = await api.fetchApi(
			`/jnodes_list_comfyui_subdirectories?root_directory=${this.rootDirectoryName}`, { method: "GET", cache: "no-store" });

		let subdirectories;
		try {
			// Decode into a string
			const decodedString = await utilitiesInstance.decodeReadableStream(subdirectoriesResponse.body);

			const asJson = JSON.parse(decodedString);

			if (asJson.success && asJson.payload) {
				subdirectories = asJson.payload;
			}
		} catch (e) {
			console.error(`Could not get list of files when loading "${this.rootDirectoryName}": ${e}`)
		}

		this.subdirectorySelector.data.clearOptions();

		for (let directoryIndex = 0; directoryIndex < subdirectories.length; directoryIndex++) {
			const bIsRoot = directoryIndex == 0;
			const result = subdirectories[directoryIndex];

			const path = bIsRoot ? this.rootDirectoryDisplayName : result;

			this.subdirectorySelector.data.addOptionUnique(path, bIsRoot ? '' : path);
		}

		// Restore last selected value if it exists in the new combo options
		if (this.subdirectorySelector.data.hasOption(lastSelectedValue)) {

			this.subdirectorySelector.data.setOptionSelected(lastSelectedValue);
		} else {

			// Otherwise just set it to the first option
			const newOptionNames = this.subdirectorySelector.data.getOptionNames();
			if (newOptionNames.length > 0) {
				this.subdirectorySelector.data.setOptionSelected(newOptionNames[0]);
			}
		}
	}

	// Get the image paths in the folder or directory specified at this.folderName 
	// as well as all subdirectories then load the images in a given subdirectory
	async fetchFolderItems(selectedSubdirectory = "") {

		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		imageDrawerListSortingInstance.stopAutomaticShuffle();

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.clearImageListChildren();
		const withOrWithout = this.bIncludeSubdirectories ? "with" : "without";

		// todo: Python cancellation needs some work
		// const cancelButton = $el("button.JNodes-image-drawer-btn", {
		// 	textContent: 'Cancel',
		// 	onclick: async () => {
		// 		await api.fetchApi(
		// 			'/jnodes_request_task_cancellation', { method: "POST" }); // Cancel any outstanding python task
		// 		cancelButton.textContent = 'Canceling...';
		// 	},
		// 	style: {
		// 		width: "fit-content",
		// 		padding: '3px',
		// 	},
		// });

		imageDrawerListInstance.addElementToImageList(
			$el('div', [
				$el("label", {
					textContent:
						`Loading directory '${selectedSubdirectory || this.rootDirectoryName}' ${withOrWithout} subdirectories...`
				}),
				//cancelButton
			])
		);

		const allItems = await api.fetchApi(
			'/jnodes_get_comfyui_subdirectory_images' +
			`?root_directory=${this.rootDirectoryName}` +
			`&selected_subdirectory=${selectedSubdirectory}` +
			`&recursive=${this.bIncludeSubdirectories}`, { cache: "no-store" });

		imageDrawerListInstance.clearImageListChildren();

		let decodedString;
		try {
			// Decode into a string
			decodedString = await utilitiesInstance.decodeReadableStream(allItems.body);

			const asJson = JSON.parse(decodedString);

			this.fileList = asJson.payload;
		} catch (e) {
			console.error(`Could not get list of images when loading "${this.rootDirectoryName}": ${e}`)
			this.fileList = []; // Set an empty list on failure. This allows the function to complete without further failures.
		}

		// Load root folder if no path is specified (even if there are no images within)
		await this.loadImagesInFolder(selectedSubdirectory);

		this.updateSubdirectorySelectorOptions();

	}

	async loadImagesInFolder(selectedSubdirectory) {

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");

		if (!this.fileList || this.fileList.length == 0) {

			await imageDrawerListInstance.addElementToImageList(
				$el('div', [
					$el("label", {
						textContent:
							`No images or videos found in '${selectedSubdirectory == "" ? this.rootDirectoryDisplayName : selectedSubdirectory}'`
					}),
					//cancelButton
				])
			);
			return;
		}

		if (this.shouldCancelAsyncOperation()) { return; }


		const createElementFromFile = async (file) => {
			let element = await ImageElements.createImageElementFromFileInfo({
				filename: file.item,
				file: file,
				type: this.rootDirectoryName,
				subdirectory: file.subdirectory ? `${selectedSubdirectory}/${file.subdirectory}` : selectedSubdirectory,
				bShouldForceLoad: this.bShouldForceLoad,
				bShouldSort: false,
				bShouldApplySearch: false,
			}, this.imageDrawerInstance);
			if (element !== undefined) {
				imageDrawerListInstance.addElementToImageList(element, false);
			} else {
				console.log(`Attempted to add undefined image element in ${this.name}`);
			}
		};

		imageDrawerListInstance.notifyStartChangingImageList();

		const promises = [];
		for (let fileIndex = 0; fileIndex < this.fileList.length; fileIndex++) {
			if (this.shouldCancelAsyncOperation()) { break; }

			const file = this.fileList[fileIndex];
			// Push the promise to the array
			promises.push(createElementFromFile(file));
		}

		// Wait for all promises to resolve
		Promise.all(promises).then(() => {

			const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
			imageDrawerListSortingInstance.sortWithCurrentType();

			const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
			imageDrawerSearchInstance.executeSearchWithEnteredSearchText();

			imageDrawerListInstance.notifyFinishChangingImageList();
		});


	}

	async makeToolbar() {

		const container = await super.makeToolbar();

		const flyoutHandle = createVideoPlaybackOptionsFlyout().handle;

		container.insertBefore(flyoutHandle, container.firstChild);
		flyoutHandle.determineTransformLayout(); // Call immediately after parenting to avoid first caling being from the center

		let includeSubdirectoriesToggleOptions = new options_LabeledCheckboxToggle();
		includeSubdirectoriesToggleOptions.labelTextContent = 'Include Subdirectories';
		includeSubdirectoriesToggleOptions.id = 'IncludeSubdirectoriesToggle';
		includeSubdirectoriesToggleOptions.checked = this.bIncludeSubdirectories;
		includeSubdirectoriesToggleOptions.oninput = async (e) => {
			this.bIncludeSubdirectories = e.target.checked;

			const selectedOption = this.subdirectorySelector.data.getSelectedOptionElement();
			const selectedValue = selectedOption.value;

			await this.fetchFolderItems(selectedValue);
		}

		const IncludeSubdirectoriesToggle = createLabeledCheckboxToggle(includeSubdirectoriesToggleOptions);

		container.insertBefore(IncludeSubdirectoriesToggle, container.firstChild);

		const searchableDropDown = new SearchableDropDown();
		this.subdirectorySelector = searchableDropDown.createSearchableDropDown();
		this.subdirectorySelector.style.width = "100%";

		this.subdirectorySelector.addEventListener("selectoption", async () => {

			// Force subdirectory inclusion off to avoid OOM - user must opt-in explicitly each time
			this.bIncludeSubdirectories = false;
			IncludeSubdirectoriesToggle.getMainElement().checked = false;

			const selectedOption = this.subdirectorySelector.data.getSelectedOptionElement();
			const selectedValue = selectedOption.value;
			// await api.fetchApi(
			// '/jnodes_request_task_cancellation', { method: "POST" }); // Cancel any outstanding python task
			await this.fetchFolderItems(selectedValue);
		});

		container.insertBefore(this.subdirectorySelector, container.firstChild);

		return container;
	}

	makeCache() {
		super.makeCache();
		this.cache.customContextCacheData = {
			selectedSubdirectory: this.subdirectorySelector?.data?.getSelectedOptionName(), subdirectorySearchToken: this.subdirectorySelector?.data?.getFilterText()
		};
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.fetchFolderItems(); // updateSubdirectorySelector is called in fetchFolderItems
			return;
		}
		await this.updateSubdirectorySelectorOptions(); //  If we're not calling fetchFolderItems because we're restoring a cache, call updateSubdirectorySelector
		if (this.cache?.customContextCacheData?.selectedSubdirectory) { // Restore subdirectory selection from custom cache data
			this.subdirectorySelector.data.setOptionSelected(this.cache.customContextCacheData.selectedSubdirectory);
		}
		if (this.cache?.customContextCacheData?.subdirectorySearchToken) { // Restore subdirectory selection from custom cache data
			this.subdirectorySelector.data.setFilterTextAndExecuteSearch(this.cache.customContextCacheData.subdirectorySearchToken);
		}
	}

	async onRefreshClicked() {
		await this.fetchFolderItems(this.subdirectorySelector.data.getSelectedOptionElement().value);
		await super.onRefreshClicked();
	}

	getSupportedSortTypes() {
		const NewSortTypes = [
			SortTypes.SortTypeFileSize, SortTypes.SortTypeImageWidth,
			SortTypes.SortTypeImageHeight, SortTypes.SortTypeImageAspectRatio, SortTypes.SortTypeFileType
		];
		return super.getSupportedSortTypes().concat(NewSortTypes);
	}
}

export class ContextFeed extends ContextClearable {
	constructor(imageDrawerInstance) {
		super("Feed", "The latest generations from this web session (cleared on page refresh)", imageDrawerInstance);

		this.feedImages = [];

		// Automatically update feed if it's the active context
		api.addEventListener("executed", async ({ detail }) => {
			const outImages = detail?.output?.images;
			if (outImages) {

				const node = app.graph.getNodeById(detail.node);
				if (node.type == "PreviewImage") { return; } // todo: Make this configurable

				for (const src of outImages) {
					// Always add feed images to the record, but only add thumbs to the imageList if
					// we're currently in feed mode. Otherwise they'll be added when switching to feed.
					src.file_age = Date.now(); // Get time of creation since the last epoch, in milliseconds. For sorting.
					this.feedImages.push(src);
				}

				const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
				if (imageDrawerContextSelectorInstance.getCurrentContextName() == this.name) {
					await this.addNewUncachedFeedImages();
				}

				utilitiesInstance.tryFreeMemory(false, true, false);
			}
		});
	}

	async addNewUncachedFeedImages(bShouldSort = true, bShouldApplySearch = true) {
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		const imageListLength = imageDrawerListInstance.getImageListChildren().length;
		if (imageListLength < this.feedImages.length) {
			imageDrawerListInstance.notifyStartChangingImageList();
			for (let imageIndex = imageListLength; imageIndex < this.feedImages.length; imageIndex++) {
				if (this.shouldCancelAsyncOperation()) { break; }

				let fileInfo = this.feedImages[imageIndex];
				fileInfo.bShouldForceLoad = true; // Don't lazy load
				const element = await ImageElements.createImageElementFromFileInfo(fileInfo, this.imageDrawerInstance);
				if (element == undefined) { console.log(`Attempting to add undefined image element in ${this.name}`); }
				const bHandleSearch = false;
				await imageDrawerListInstance.addElementToImageList(element, bHandleSearch);
			}

			if (bShouldSort) {
				const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
				imageDrawerListSortingInstance.sortWithCurrentType();
			}

			if (bShouldApplySearch) {
				const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
			}

			imageDrawerListInstance.notifyFinishChangingImageList();
		}
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
			imageDrawerListInstance.clearImageListChildren();
		}

		await this.addNewUncachedFeedImages();
	}

	async onClearClicked() {
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.clearImageListChildren();
		this.feedImages = [];
	}

	onRequestSingleDeletion(item) {

		this.removeItemFromFeed(item);

		if (item && item.deleteItem) {
			const bRemoveFromImageList = false; // Don't do it again, that was handled above
			item.deleteItem(bRemoveFromImageList);
		}
	}

	onRequestBatchDeletion() {
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		for (const child of imageDrawerListInstance.getImageListChildren()) {
			this.onRequestSingleDeletion(child);
		}
	}

	onRequestSingleRemoval(item) {

		this.removeItemFromFeed(item);
	}

	onRequestBatchRemoval() {
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		for (const child of imageDrawerListInstance.getImageListChildren()) {
			this.onRequestSingleRemoval(child);
		}
	}

	getDefaultSortType() {
		return { type: SortTypes.SortTypeDate, bIsAscending: false };
	}

	removeItemFromFeed(item) {

		super.onRequestSingleRemoval(item);

		if (item.img?.src) {
			this.feedImages = this.feedImages.filter(src => src !== item.img.src); // Remove matching feed sources
		}
	}
}

export class ContextTemp extends ContextSubdirectoryExplorer {
	constructor(imageDrawerInstance) {
		const bShouldForceLoad = true; // These need to be searchable by meta data
		super("Temp / History", "The generations you've created since the last comfyUI server restart", imageDrawerInstance, "temp", bShouldForceLoad);
	}

	getDefaultSortType() {
		return { type: SortTypes.SortTypeDate, bIsAscending: false };
	}
}

export class ContextFavourites extends ContextSubdirectoryExplorer {
	constructor(imageDrawerInstance) {
		const bShouldForceLoad = true; // These need to be searchable by meta data

		// Update rootDirectoryName when this setting changes
		setting_FavouritesDirectory.setOnChange((newValue) => { this.rootDirectoryName = newValue; })

		super("Favourites", "The generations you've copied to the Favourites directory defined in Settings > JNodes Settings", imageDrawerInstance, setting_FavouritesDirectory.value, bShouldForceLoad);
	}
}

export class ContextInput extends ContextSubdirectoryExplorer {
	constructor(imageDrawerInstance) {
		super("Input", "Images and videos found in your input folder", imageDrawerInstance, "input");
	}
}

export class ContextOutput extends ContextSubdirectoryExplorer {
	constructor(imageDrawerInstance) {
		const bShouldForceLoad = true; // These need to be searchable by meta data
		super("Output", "Images and videos found in your output folder", imageDrawerInstance, "output", bShouldForceLoad);
	}
}

export class ContextLora extends ContextModel {
	constructor(imageDrawerInstance) {
		super("Lora / Lycoris", "Lora and Lycoris models found in your Lora directory", imageDrawerInstance, "loras");
	}

	async getModels(bForceRefresh = false) {
		return await ExtraNetworks.getLoras(bForceRefresh);
	}
}

export class ContextEmbeddings extends ContextModel {
	constructor(imageDrawerInstance) {
		super("Embeddings / Textual Inversions", "Embedding/textual inversion models found in your embeddings directory", imageDrawerInstance, "embeddings");
	}

	async getModels(bForceRefresh = false) {
		return await ExtraNetworks.getEmbeddings(bForceRefresh);
	}
}

export class ContextSavedPrompts extends ContextSubdirectoryExplorer {
	constructor(imageDrawerInstance) {
		super(
			"Saved Prompts",
			"Images and videos found in the JNodes/saved_prompts folder and its subdirectories. Title comes from filename",
			imageDrawerInstance,
			"JNodes/saved_prompts");
	}
}

export class ContextMetadataReader extends ImageDrawerContext {
	constructor(imageDrawerInstance) {
		super("Metadata Reader", "Read and display metadata from a generation", imageDrawerInstance);
	}

	getSupportedSortNames() {
		return [];
	}
}

export class ContextCompare extends ContextClearable {
	constructor(imageDrawerInstance) {
		super(
			"Compare", 
			"Compare generations sent to this context via menu. Does not persist on refresh.",
			imageDrawerInstance
		);
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
			imageDrawerListInstance.clearImageListChildren();
		}

		//await this.addNewUncachedFeedImages();
	}

	async onClearClicked() {
	}

	getSupportedSortNames() {
		return [];
	}
}
