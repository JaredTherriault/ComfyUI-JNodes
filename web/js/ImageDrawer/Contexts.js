import { $el } from "/scripts/ui.js";
import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import * as ExtraNetworks from "./ImageListChildElements/ExtraNetworks.js";
import * as ImageElements from "./ImageListChildElements/ImageElements.js";
import { getMetaData } from "./ImageListChildElements/ImageListChildElementUtils.js";

import * as SortTypes from "../common/SortTypes.js"

import { utilitiesInstance } from "../common/Utilities.js"

import {
	createLabeledCheckboxToggle, createLabeledSliderRange, createVideoPlaybackOptionsFlyout,
	options_LabeledCheckboxToggle, options_LabeledSliderRange, setting_ModelCardAspectRatio,
	setting_FavouritesDirectory,
	ImageDrawerConfigSetting
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
		preview: new ContextPreview(imageDrawerInstance),
		metadata: new ContextMetadataViewer(imageDrawerInstance),
		//savedPrompts: new ContextSavedPrompts(imageDrawerInstance),
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
		this.setting_LastSelectedSorting = new ImageDrawerConfigSetting(`ImageDrawer_LastSelectedSorting_Context_${this.constructor.name}_Instance_${this.imageDrawerInstance.getIndex()}`, this.getDefaultSortType());
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

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		const imageListElement = imageDrawerListInstance.getImageListElement();

		const mainWidget = this.getMainWidget();

		const bUseImageList = mainWidget == imageListElement;

		if (imageDrawerListInstance.getImageListContainerElement().firstChild) {
			imageDrawerListInstance.getImageListContainerElement().removeChild(imageDrawerListInstance.getImageListContainerElement().firstChild);
		}
		imageDrawerListInstance.getImageListContainerElement().appendChild(mainWidget);

		const bSuccessfulRestore = bSkipRestore || bUseImageList ? await this.checkAndRestoreContextCache(bUseImageList) : false;
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
				imageDrawerListInstance.getImageListContainerElement().scrollTop = 0;
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

	async checkAndRestoreContextCache(bUseImageList) {
		if (this.hasCache()) {

			if (bUseImageList && this.cache.imageListElements.length > 0) {

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

	// Override this function to use your own widget instead of the default image list grid.
	getMainWidget() {

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		return imageDrawerListInstance.getImageListElement();
	}

	getSupportedSortTypes() {
		return [SortTypes.SortTypeFilename, SortTypes.SortTypeDate, SortTypes.SortTypeShuffle];
	}

	getDesiredSortType() {

		let desiredType = this.cache?.sortType;			
		
		const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
		
		if (!desiredType) {
			
			try {

				const lastSelectedType = JSON.parse(this.setting_LastSelectedSorting.value);

				desiredType = imageDrawerListSortingInstance.getSortTypeObjectFromClassName(lastSelectedType.name, lastSelectedType.bIsAscending);

			} catch {

				// pass
			}
		} 
		
		if (!desiredType) {
			
			desiredType = this.getDefaultSortType();
		}

		const supportedTypes = this.getSupportedSortTypes();

		const desiredTypeObject = imageDrawerListSortingInstance.getSortTypeObjectFromName(desiredType) || desiredType;
	
		if (supportedTypes.includes(desiredTypeObject.constructor)) {

			return desiredTypeObject;
		}

		return this.getDefaultSortType();
	}

	getDefaultSortType() {
		return { type: SortTypes.SortTypeFilename, bIsAscending: true };
	}

	setLastSelectedSorting(sortType) {
		const value = JSON.stringify({ name: sortType.constructor.name, bIsAscending: sortType.bIsAscending });
		this.setting_LastSelectedSorting.value = value;
		return value;
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
		return super.getSupportedSortTypes().concat([SortTypes.SortTypeFriendlyName, SortTypes.SortTypePath]);
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
			let decodedString = await utilitiesInstance.decodeReadableStream(subdirectoriesResponse.body);

			decodedString = utilitiesInstance.sanitizeMetadataForJson(decodedString);

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

			decodedString = utilitiesInstance.sanitizeMetadataForJson(decodedString);

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
				subdirectory: file.subdirectory ? selectedSubdirectory ? `${selectedSubdirectory}/${file.subdirectory}` : file.subdirectory : selectedSubdirectory,
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
			selectedSubdirectory: this.subdirectorySelector?.data?.getSelectedOptionName(), subdirectorySearchToken: this.subdirectorySelector?.data?.getFilterText(),
			subdirectorySelectorScrollAmount: this.subdirectorySelector?.data?.getLastScrollAmount()
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
		if (this.cache?.customContextCacheData?.subdirectorySearchToken) {
			this.subdirectorySelector.data.setFilterTextAndExecuteSearch(this.cache.customContextCacheData.subdirectorySearchToken);
		}
		if (this.cache?.customContextCacheData?.subdirectorySelectorScrollAmount) {
			this.subdirectorySelector.data.setScrollAmount(this.cache.customContextCacheData.subdirectorySelectorScrollAmount);
		}
	}

	async onRefreshClicked() {
		await this.fetchFolderItems(this.subdirectorySelector.data.getSelectedOptionElement().value);
		await super.onRefreshClicked();
	}

	getSupportedSortTypes() {
		const NewSortTypes = [
			SortTypes.SortTypeFileSize, SortTypes.SortTypeImageWidth, SortTypes.SortTypeImageHeight, 
			SortTypes.SortTypeImageAspectRatio, SortTypes.SortTypeFileType, SortTypes.SortTypePath
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

				// utilitiesInstance.tryFreeMemory(false, true, false);
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
				fileInfo.file = fileInfo;
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

export class ContextMetadataViewer extends ImageDrawerContext {
	constructor(imageDrawerInstance) {
		super(
			"Metadata Viewer", 
			"Read and display metadata from an image or video", 
			imageDrawerInstance);
	}

	async switchToContext() {
		if (!await super.switchToContext()) {

			if (this.mainWidget) {

				return;
			}

			this.makeMainWidget();
	

		} else {

			if (this.viewingItem) {
				this._refreshPreviewFromBlob(this.viewingItem, this.container.firstChild);
			}
		}
	}

	makeMainWidget() {

		if (!this.container) {
			this.container = $el("div", {
				style: {
					height: "100%",
					width: "100%",
				}
			});
		}

		this.makeDefaultDragAndDropAreaContent();

		this.mainWidget = $el("div", {
			textContent: "Metadata Viewer",
			style: {
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "20px",
				fontFamily: "sans-serif",
				position: "relative", 
				fontWeight: "bold",
				fontSize: "24px",
				textAlign: "center",
				marginBottom: "10px",
				height: "97%", // Avoids inner scrolling
			},
		});

		// Drag-and-drop listeners
		this.mainWidget.addEventListener("dragover", (e) => {
			e.preventDefault();
			this.dropOverlay.textContent = "Drop here to extract metadata!";
			this.dropOverlay.style.opacity = 1;
		});
		
		this.mainWidget.addEventListener("dragleave", () => {
			this.dropOverlay.style.opacity = 0;
		});
		
		this.mainWidget.addEventListener("drop", async (e) => {
			e.preventDefault();

			// Temporarily disable comfy file handling
			const handleFileFunction = app.handleFile;
			app.handleFile = (src) => {};

			this.dropOverlay.textContent = "Processing file metadata...";

			let payload = null;
			
			if (e.dataTransfer) {

				let bIsBinary = false;

				if (e.dataTransfer.files.length > 0) { // For file drag and drop

					const file = e.dataTransfer.files[0];
					console.log("Dropped: " + JSON.stringify(file));
					if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
						payload = file;
						bIsBinary = true;
					}

				} else if (e.dataTransfer.items.length > 0) { // For image drawer drag and drop

					const item = e.dataTransfer.items[0];
					console.log("Dropped: " + JSON.stringify(item));
					if (item && item.type == "text/jnodes_image_drawer_payload") {
						payload = item;
					} 
				}

				if (payload) {

					await this.handleDrop(payload, bIsBinary);

				} else {
					
					this.dropOverlay.textContent = "Please drop a valid image or video file.";

					setTimeout( () => {
						this.dropOverlay.style.opacity = 0;
					}, 1000);

				}
			}

			// Reenable comfy file handling
			app.handleFile = handleFileFunction;
		});

		this.dropOverlay = $el("div", {
			style: {
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: "rgba(0, 0, 0, 0.95)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "#fff",
				fontSize: "20px",
				zIndex: 1000,
				pointerEvents: "none",
				opacity: 0,
				transition: "opacity 0.3s ease",
			}
		});

		this.mainWidget.appendChild(this.container);
		this.mainWidget.appendChild(this.dropOverlay);
	}

	makeDefaultDragAndDropAreaContent() {

		this.dragAndDropArea = $el("div", {
			style: {
				width: "100%",
				height: "200px",
				border: "2px dashed #aaa",
				borderRadius: "10px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "#666",
				fontSize: "16px",
				transition: "border-color 0.3s, background-color 0.3s",
				marginTop: "20px",
				cursor: "pointer",
			},
		});

		this.dropMessage = $el("span", { textContent: "Drag & drop an image or video here to view metadata, or use 'Send To...' on any imange/video/model from the image drawer.", 
			style: { padding: "5%"}
		 });
		this.dragAndDropArea.appendChild(this.dropMessage);
		this.setContent(this.dragAndDropArea); // Add area to container
	}

	async handleDrop(payload, bIsBinary) {

		console.log("Dropped: " + JSON.stringify(payload));

		let filenameItem;
		let fileUrlItem;

		if (bIsBinary) { 

			// file = payload.getAsFile();
			await this.setImageOrVideo(payload, true);

		} else if (payload.type == 'text/jnodes_image_drawer_payload') { // a payload specific to media from the drawer

			let bSuccessfulLoad = false;

			// Create a promise to encapsulate the asynchronous operation
			const loadItemAsString = (payload) => {
				return new Promise((resolve, reject) => {
					payload.getAsString(async (value) => {
						if (value) {
							try {
								const jnodesPayload = JSON.parse(value);
								let href = `/jnodes_view_image?`;

								if (jnodesPayload.imageHref) { // Use existing href if it exists

									href = jnodesPayload.imageHref;

								} else { // Otherwise construct it

									if (jnodesPayload.filename) {
										href += `filename=${encodeURIComponent(jnodesPayload.filename)}&`;
									}
									if (jnodesPayload.type) {
										href += `type=${jnodesPayload.type}&`;
									}
									if (jnodesPayload.subdirectory || jnodesPayload.subfolder) {
										href += `subfolder=${encodeURIComponent(jnodesPayload.subdirectory || jnodesPayload.subfolder || "")}&`;
									}
								
									href += `t=${+new Date()}`; // Add Timestamp
								}

								const response = await fetch(href);
        						const blob = await response.blob();

								if (blob) {
									this.setImageOrVideo(blob, true);
								}

								// Resolve the promise with the result of updateNode()
								resolve(bSuccess);
							} catch (e) {
								console.error(`Error getting file from dropped item: ${e}`);
								// Reject the promise in case of an error
								reject(e);
							}
						} else {
							// Resolve with false if value is empty
							resolve(false);
						}
					});
				});
			};

			// Wait for the return of the Promise
			await loadItemAsString(payload)
				.then((success) => {
					bSuccessfulLoad = success;
				})
				.catch((error) => {
					console.error('Error loading item as string:', error);
				});

			if (bSuccessfulLoad) {
				return true; // Early out for jnodes_image_drawer_payload
			}

		} else if (payload.type == 'application/x-moz-file-promise-url') { // Firefox specific pair fallback

			if (!fileUrlItem) { fileUrlItem = payload; }

		} else if (payload.type == 'application/x-moz-file-promise-dest-filename') { // Firefox specific pair fallback

			if (!filenameItem) { filenameItem = payload; }

		}

		// Manually get filename and load file (Mozilla) if 
		if (fileUrlItem) {

			let filename;

			if (filenameItem) {
				await filenameItem.getAsString(async (value) => {
					if (value) { filename = value; }
				});
			}

			fileUrlItem.getAsString(async (value) => {
				let file = await utilitiesInstance.loadFileFromURL(value);

				if (!filename) {
					// Set filename from url maybe
					filename = `${Math.random()}.${file.type.split('/')[1]}`;
				}

				file.filename = filename;

				if (file) {
					return conditionallyUploadFile(file);
				} else {
					console.error("Error getting file from dropped item.");
				}
			});
		}
	}

	removeContent() {

		while (this.container && this.container.firstChild) {
			this.container.removeChild(this.container.firstChild);
		  }
	}

	setContent(inWidget) {

		if (this.container && inWidget) {

			this.widget = inWidget;
			this.removeContent();
			this.container.appendChild(inWidget);
		}
	}

	_createTableRow(key, value, bCreateCopyButton, bCreateEditButton, bCreateDeleteButton) {
		const row = $el("tr");
	
		// Container for key text + edit button
		const keyContainer = $el("div", {
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "10px",
				width: "100%",
			}
		});

		let keyText = $el("span", {
			textContent: key,
			style: {
				wordBreak: "break-word",
				flex: "1",
			}
		});

		keyContainer.appendChild(keyText);

		if (bCreateEditButton) {
			const editKeyButton = $el("button", {
				textContent: "✏️",
				title: "Edit key",
				style: {
					background: "none",
					border: "none",
					color: "#fff",
					cursor: "pointer",
					fontSize: "16px",
					padding: "0",
					margin: "0",
					opacity: "0.6",
				}
			});

			editKeyButton.addEventListener("click", () => {
				const input = $el("input", {
					type: "text",
					value: keyText.textContent,
					style: {
						flex: "1",
						padding: "4px",
						borderRadius: "4px",
						border: "1px solid #ccc",
					}
				});

				const save = () => {
					keyText.textContent = input.value;
					keyContainer.replaceChild(keyText, input);
				};

				keyContainer.replaceChild(input, keyText);
				input.focus();

				input.addEventListener("blur", save);
				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") input.blur();
				});
			});

			keyContainer.appendChild(editKeyButton);
		}

		const keyCell = $el("td", {
			style: {
				padding: "8px",
				borderBottom: "1px solid #eee",
				fontWeight: "bold",
				width: "40%",
				color: "#fff",
				backgroundColor: "rgba(0, 0, 0, 0.4)",
			}
		});
		keyCell.appendChild(keyContainer);
	
		// Container for value + button
		const valueContainer = $el("div", {
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "10px",
			}
		});
	
		const valueText = $el("span", {
			textContent: utilitiesInstance.decodeUnicodeForeignLanguageText(value !== null && value !== undefined ? JSON.stringify(value) : ""),
			style: {
				wordBreak: "break-word",
				flex: "1",
			}
		});
	
		valueContainer.appendChild(valueText);
	
		if (bCreateCopyButton) {
			const copyButton = $el("button", {
				textContent: "📋",
				title: "Copy to clipboard",
				style: {
					background: "none",
					border: "none",
					color: "#fff",
					cursor: "pointer",
					fontSize: "16px",
					padding: "0",
					margin: "0",
					opacity: "0.6",
				}
			});
		
			copyButton.addEventListener("click", () => {
				navigator.clipboard.writeText(valueText.textContent).then(() => {
					copyButton.textContent = "✅";
					setTimeout(() => (copyButton.textContent = "📋"), 1000);
				});
			});

			valueContainer.appendChild(copyButton);
		}

		// ✏️ Edit button
		if (bCreateEditButton) {
			const editButton = $el("button", {
				textContent: "✏️",
				title: "Edit value",
				style: {
					background: "none",
					border: "none",
					color: "#fff",
					cursor: "pointer",
					fontSize: "16px",
					padding: "0",
					margin: "0",
					opacity: "0.6",
				}
			});

			editButton.addEventListener("click", () => {
				// Replace valueText with input
				const input = $el("input", {
					type: "text",
					value: valueText.textContent,
					style: {
						flex: "1",
						padding: "4px",
						borderRadius: "4px",
						border: "1px solid #ccc",
					}
				});

				// Replace and focus
				valueContainer.replaceChild(input, valueText);
				input.focus();

				// Save on blur or enter
				const save = () => {
					valueText.textContent = input.value;
					valueContainer.replaceChild(valueText, input);
				};

				input.addEventListener("blur", save);
				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						input.blur(); // triggers save
					}
				});
			});
			
			valueContainer.appendChild(editButton);
		}

		// 🗑️ Delete button
		if (bCreateDeleteButton) {
			const deleteButton = $el("button", {
				textContent: "🗑️",
				title: "Delete row",
				style: {
					background: "none",
					border: "none",
					color: "#fff",
					cursor: "pointer",
					fontSize: "16px",
					padding: "0",
					margin: "0",
					opacity: "0.6",
				}
			});

			deleteButton.confirmState = false;

			deleteButton.addEventListener("click", () => {

				if (deleteButton.confirmState) {

					row.remove();

				} else {

					deleteButton.confirmState = true;
					deleteButton.textContent = "🗑️?";
					setTimeout(() => {
						deleteButton.confirmState = false;
						deleteButton.textContent = "🗑️";
					}, 2000);
				}
			});

			valueContainer.appendChild(deleteButton);
		}
	
		const valueCell = $el("td", {
			style: {
				padding: "8px",
				borderBottom: "1px solid #eee",
				color: "#fff",
				backgroundColor: "rgba(0, 0, 0, 0.4)",
			}
		});
	
		valueCell.appendChild(valueContainer);
	
		row.appendChild(keyCell);
		row.appendChild(valueCell);
	
		return row;
	}

	_makeMediaPreview(inImageOrVideo) {

		this.previewElement = null;
		if (inImageOrVideo.type.startsWith("image/")) {
			this.previewElement = $el("img", {
				src: this.imageOrVideoUrl,
				style: {
					maxHeight: "10vh",
					marginBottom: "10px",
					borderRadius: "8px",
					boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
				}
			});
		} else if (inImageOrVideo.type.startsWith("video/")) {
			this.previewElement = $el("video", {
				src: this.imageOrVideoUrl,
				controls: true,
				autoplay: true,
				muted: true,
				loop: true,
				style: {
					maxHeight: "10vh",
					marginBottom: "10px",
					borderRadius: "8px",
					boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
				}
			});
		}
	}

	_refreshPreviewFromBlob(inImageOrVideo, container) {

		if (this.previewElement) {
			this.previewElement.remove();
			this.previewElement = null;
		}
	
		if (this.imageOrVideoUrl) {
			URL.revokeObjectURL(this.imageOrVideoUrl);
		}
	
		this.imageOrVideoUrl = URL.createObjectURL(inImageOrVideo);
	
		this._makeMediaPreview(inImageOrVideo);
	
		if (this.previewElement) {

			if (container.firstChild?.nextSibling) {
				container.insertBefore(this.previewElement, container.firstChild?.nextSibling);
			} else {
				container.appendChild(this.previewElement);
			}
		}
	}

	async _generateMetadataWidgetFromImageOrVideo(inImageOrVideo) {
		let metadata = null;
		try {
			metadata = await getMetaData(inImageOrVideo, inImageOrVideo.type);
		} catch {
			// pass
		}
	
		if (metadata) {
			const container = $el("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					width: "100%",
					color: "#fff",
					height: "100%",
				}
			});
	
			// Title
			const title = $el("h3", {
				textContent: inImageOrVideo.name || "",
				style: {
					margin: "10px 0",
					fontSize: "22px",
					color: "#fff",
				}
			});
			container.appendChild(title);
	
			// Media preview
			this._refreshPreviewFromBlob(inImageOrVideo, container);
	
			// Metadata table
			const table = $el("table", {
				style: {
					width: "100%",
					borderCollapse: "collapse",
					fontSize: "14px",
				}
			});
	
			const tbody = $el("tbody");
	
			let entries = Object.entries(metadata);
	
			entries.sort(([keyA], [keyB]) => {
				if (keyA === "workflow") return 1;
				if (keyB === "workflow") return -1;
				if (keyA === "prompt") return 1;
				if (keyB === "prompt") return -1;
				return keyA.localeCompare(keyB);
			});

			const bCreateCopyButton = true;
			const bCreateEditButton = false; // TODO: No reason to edit until I implement saving meta back to the original image
			const bCreateDeleteButton = false;
	
			for (const [key, value] of entries) {
				if (key !== "parameters") {
					const row = this._createTableRow(
						key, value, bCreateCopyButton, bCreateEditButton, bCreateDeleteButton);
					tbody.appendChild(row);
				}
			}
	
			table.appendChild(tbody);

			// Create a container to hold input + button side-by-side
			const filterContainer = $el("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					width: "100%",
					margin: "10px 0",
				}
			});

			// Text input
			const filterInput = $el("input", {
				type: "text",
				placeholder: "Filter metadata...",
				style: {
					flexGrow: "1",
					padding: "8px",
					borderRadius: "4px",
					border: "1px solid #ccc",
					boxSizing: "border-box",
				}
			});

			// Clear "X" button
			const clearButton = $el("button", {
				textContent: "❌",
				title: "Clear filter",
				style: {
					padding: "6px 10px",
					borderRadius: "4px",
					border: "1px solid #ccc",
					backgroundColor: "#500",
					color: "#fff",
					cursor: "pointer",
				}
			});

			clearButton.addEventListener("click", () => {
				filterInput.value = "";
				filterInput.dispatchEvent(new Event("input"));
			});

			// Toggle button
			let filterMode = "ANY"; // default mode

			const filterToggleButton = $el("button", {
				textContent: "ANY",
				style: {
					padding: "8px 12px",
					borderRadius: "4px",
					border: "1px solid #ccc",
					backgroundColor: "#222",
					color: "#fff",
					cursor: "pointer",
				}
			});

			filterToggleButton.addEventListener("click", () => {
				filterMode = filterMode === "ANY" ? "ALL" : "ANY";
				filterToggleButton.textContent = filterMode;
				filterInput.dispatchEvent(new Event("input")); // reapply filter
			});

			filterInput.addEventListener("input", () => {
				const query = filterInput.value.toLowerCase();
				const terms = query.split(" ").filter(Boolean);
			
				Array.from(tbody.children).forEach((row) => {
					const key = row.children[0]?.textContent.toLowerCase() || "";
					const value = row.children[1]?.textContent.toLowerCase() || "";
					const combined = key + " " + value;
			
					let matches = true;
			
					if (terms.length > 0) {
						if (filterMode === "ANY") {
							matches = terms.some(term => combined.includes(term));
						} else if (filterMode === "ALL") {
							matches = terms.every(term => combined.includes(term));
						}
					}
			
					row.style.display = matches ? "" : "none";
				});
			});

			filterContainer.appendChild(filterInput);
			filterContainer.appendChild(clearButton);		
			filterContainer.appendChild(filterToggleButton);	
	
			// Scrollable wrapper for the table
			const scrollContainer = $el("div", {
				style: {
					overflowY: "auto",
					width: "100%",
					padding: "10px",
					border: "1px solid rgba(255, 255, 255, 0.2)",
					borderRadius: "6px",
					backgroundColor: "rgba(0, 0, 0, 0.3)",
					boxShadow: "inset 0 0 10px rgba(0,0,0,0.2)",
					marginTop: "10px",
				}
			});
			scrollContainer.appendChild(table);
	
			container.appendChild(filterContainer);
			container.appendChild(scrollContainer);
	
			return container;
		}
	
		return null;
	}
	
	async setImageOrVideo(inImageOrVideoBlob, bUpdateOverlayWidget = false) {

		let widget;
		
		try {
			widget = await this._generateMetadataWidgetFromImageOrVideo(inImageOrVideoBlob);
		} catch {

			// pass
		}

		if (widget) {

			this.viewingItem = inImageOrVideoBlob;
			this.setContent(widget);

			if (bUpdateOverlayWidget) {
				this.dropOverlay.style.opacity = 0;
			}
		} else {
		
			console.warn("setImageOrVideo: Iamge or video has no metadata!");

			if (bUpdateOverlayWidget) {

				this.dropOverlay.style.opacity = 1;
				this.dropOverlay.textContent = "No metadata...";
				setTimeout( () => {
					this.dropOverlay.style.opacity = 0;
				}, 1000);
			}
		}
	}

	_renderMetadataTree(data, collectedTbodyList = []) {
		const container = $el("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				width: "100%",
				color: "#fff",
			}
		});
	
		const table = $el("table", {
			style: {
				width: "100%",
				borderCollapse: "collapse",
				fontSize: "14px",
			}
		});
		const tbody = $el("tbody");
		collectedTbodyList.push(tbody); // ✅ collect for filtering
	
		for (const [key, value] of Object.entries(data)) {
			const row = $el("tr");
			const keyCell = $el("td", {
				textContent: key,
				style: {
					padding: "6px",
					fontWeight: "bold",
					verticalAlign: "top",
					width: "40%",
					backgroundColor: "rgba(255,255,255,0.05)",
					borderBottom: "1px solid rgba(255,255,255,0.1)"
				}
			});
	
			const valueCell = $el("td", {
				style: {
					padding: "6px",
					borderBottom: "1px solid rgba(255,255,255,0.1)",
					wordBreak: "break-word",
					whiteSpace: "normal",
					overflowWrap: "anywhere",
					maxWidth: "40%",
				}
			});
	
			if (typeof value === "object" && value !== null) {
				const toggle = $el("details", {
					open: false,
					style: {
						cursor: "pointer"
					}
				});
	
				const summary = $el("summary", {
					textContent: Array.isArray(value) ? `Array [${value.length}]` : "Object",
					style: {
						marginBottom: "4px",
						color: "#ccc"
					}
				});
	
				toggle.appendChild(summary);
				toggle.appendChild(this._renderMetadataTree(value, collectedTbodyList)); // recursive pass
				valueCell.appendChild(toggle);
			} else {
				valueCell.innerHTML = utilitiesInstance.sanitizeHTML(String(value));
			}
	
			row.appendChild(keyCell);
			row.appendChild(valueCell);
			tbody.appendChild(row);
		}
	
		table.appendChild(tbody);
		container.appendChild(table);
		return container;
	}	

	async _generateMetadataWidgetFromModel(inModelInfo, inImageOrVideo = null) {
		const container = $el("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "10px",
				color: "#fff",
				width: "100%",
				height: "100%",
				
			}
		});
	
		if (!inModelInfo?.familiars?.familiar_infos) return null;
	
		// Title
		const title = $el("h3", {
			textContent: inModelInfo.name || "",
			style: {
				margin: "10px 0",
				fontSize: "22px",
				color: "#fff",
			}
		});
		container.appendChild(title);
	
		// Media preview
		if (inImageOrVideo) {
			this._refreshPreviewFromBlob(inImageOrVideo, container);
		}

		// Create a container to hold input + button side-by-side
		const filterContainer = $el("div", {
			style: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				width: "100%",
				margin: "10px 0",
			}
		});

		// Text input
		const filterInput = $el("input", {
			type: "text",
			placeholder: "Filter metadata...",
			style: {
				flexGrow: "1",
				padding: "8px",
				borderRadius: "4px",
				border: "1px solid #ccc",
				boxSizing: "border-box",
			}
		});

		// Clear "X" button
		const clearButton = $el("button", {
			textContent: "❌",
			title: "Clear filter",
			style: {
				padding: "6px 10px",
				borderRadius: "4px",
				border: "1px solid #ccc",
				backgroundColor: "#500",
				color: "#fff",
				cursor: "pointer",
			}
		});

		clearButton.addEventListener("click", () => {
			filterInput.value = "";
			filterInput.dispatchEvent(new Event("input"));
		});

		// Toggle button
		let filterMode = "ANY"; // default mode

		const filterToggleButton = $el("button", {
			textContent: "ANY",
			style: {
				padding: "8px 12px",
				borderRadius: "4px",
				border: "1px solid #ccc",
				backgroundColor: "#222",
				color: "#fff",
				cursor: "pointer",
			}
		});

		filterToggleButton.addEventListener("click", () => {
			filterMode = filterMode === "ANY" ? "ALL" : "ANY";
			filterToggleButton.textContent = filterMode;
			filterInput.dispatchEvent(new Event("input")); // reapply filter
		});

		const collectedTbodyList = [];

		filterInput.addEventListener("input", () => {
			const query = filterInput.value.toLowerCase();
			const terms = query.split(" ").filter(Boolean);
		
			for (const tbody of collectedTbodyList) {
				Array.from(tbody.children).forEach((row) => {
					const key = row.children[0]?.textContent.toLowerCase() || "";
					const value = row.children[1]?.textContent.toLowerCase() || "";
					const combined = key + " " + value;
		
					let matches = true;
		
					if (terms.length > 0) {
						if (filterMode === "ANY") {
							matches = terms.some(term => combined.includes(term));
						} else if (filterMode === "ALL") {
							matches = terms.every(term => combined.includes(term));
						}
					}
		
					row.style.display = matches ? "" : "none";
				});
			}
		});

		filterContainer.appendChild(filterInput);
		filterContainer.appendChild(clearButton);		
		filterContainer.appendChild(filterToggleButton);	

		container.appendChild(filterContainer);

		const scrollContainer = $el("div", {
			style: {
				maxHeight: "100%",
				overflowY: "auto",
				width: "100%",
				padding: "10px",
				border: "1px solid rgba(255, 255, 255, 0.2)",
				borderRadius: "6px",
				backgroundColor: "rgba(0, 0, 0, 0.3)",
				boxShadow: "inset 0 0 10px rgba(0,0,0,0.2)",
				marginTop: "10px",
			}
		});
	
		for (const info of inModelInfo.familiars.familiar_infos) {
			const section = $el("details", {
				open: false,
				style: {
					border: "1px solid rgba(255,255,255,0.2)",
					borderRadius: "6px",
					backgroundColor: "rgba(0, 0, 0, 0.4)",
					width: "100%"
				}
			});
		
			const summary = $el("summary", {
				textContent: info.file_name || "Unnamed Info File",
				style: {
					fontSize: "16px",
					fontWeight: "bold",
					margin: "10px",
					cursor: "pointer",
				}
			});
			section.appendChild(summary);
		
			let parsed = null;
			let rendered;
		
			try {
				parsed = JSON.parse(info.loaded_text);
				rendered = this._renderMetadataTree(parsed, collectedTbodyList); // ✅ pass in the list
			} catch {
				rendered = $el("pre", {
					textContent: info.loaded_text,
					style: {
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						fontSize: "13px",
						lineHeight: "1.4"
					}
				});
			}
		
			section.appendChild(rendered);
			scrollContainer.appendChild(section);
		}

		container.appendChild(scrollContainer);
	
		return container;
	}

	// Only inModelInfo is necessary, inImageOrVideo is optional and purely visual
	async setModel(inModelInfo, inImageOrVideo = null, bUpdateOverlayWidget = false) {

		let widget;
		
		try {
			widget = await this._generateMetadataWidgetFromModel(inModelInfo, inImageOrVideo);
		} catch {

			// pass
		}

		if (widget) {

			this.viewingItem = inModelInfo;
			this.setContent(widget);

			if (bUpdateOverlayWidget) {
				this.dropOverlay.style.opacity = 0;
			}
		} else {
		
			console.warn("setModel: Model has no metadata!");

			if (bUpdateOverlayWidget) {

				this.dropOverlay.style.opacity = 1;
				this.dropOverlay.textContent = "No metadata...";
				setTimeout( () => {
					this.dropOverlay.style.opacity = 0;
				}, 1000);
			}
		}
	}

	getSupportedSortTypes() {
		return [];
	}

	getMainWidget() {
		
		if (!this.mainWidget) {
			this.makeMainWidget();
		}
		return this.mainWidget;
	}
}

export class ContextPreview extends ImageDrawerContext {
	constructor(imageDrawerInstance) {
		super(
			"Inference Preview", 
			"Show the current preview of whatever is being generated, the same as what would show on a sampler node",
			imageDrawerInstance
		);
	}

	async switchToContext() {
		if (!await super.switchToContext()) {

			if (!this.link) {
				this.createPreviewElement();
			}
	
			api.addEventListener("b_preview", ({ detail }) => {
				if (this.animateInterval) { return; }
				this.canvas.style.display = "none";
				this.img.style.display = "unset";
				this.show(URL.createObjectURL(detail), app.runningNodeId);
			});

			api.addEventListener('VHS_latentpreview', ({ detail }) => {
				let setting = app.ui.settings.getSettingValue("VHS.LatentPreview");
				if (!setting) {
					return;
				}
				this.nodeId = detail.id;
				if (this.nodeId == null) {
					return;
				}

				let previewNode = app.graph.getNodeById(this.nodeId);
				if (!previewNode?.widgets) { return; }
				
				let previewWidget = previewNode.widgets.find((w) => w.name == "vhslatentpreview");
				if (!previewWidget) { return; }

				this.canvas.style.display = "unset";
				this.img.style.display = "none";
				let ctx;
				if (this.animateInterval) {
					clearInterval(this.animateInterval);
				}
				this.animateInterval = setInterval(() => {

					if (!this) return;
					
					if (detail.id != this.nodeId) {
						clearInterval(this.animateInterval);
						this.animateInterval = undefined;
						return;
					}
					if (!ctx) {
						ctx = this.canvas.getContext("2d");
					}
					this.canvas.style.aspectRatio = previewWidget.aspectRatio;
					ctx.drawImage(previewWidget.element, 0, 0, this.canvas.width, this.canvas.height);
				}, 1000/detail.rate);
			});
		}
	}

	show(src, node) {
		this.img.src = src;
		this.nodeId = Number(node);
	}

	createPreviewElement() {

		this.canvas = $el("canvas", { style: { display: "none", width: "100%" } });
		this.img = $el("img", { style: { display: "none", width: "100%" } });

		this.link = $el(
			"a",
			{
				href: "#",
				onclick: (e) => {
					e.stopPropagation();
					e.preventDefault();
					const node = app.graph.getNodeById(this.nodeId);
					if (!node) return;
					app.canvas.centerOnNode(node);
					app.canvas.setZoom(1);
				},
			}, [
				this.canvas, this.img
			]
		);
	}

	getSupportedSortTypes() {
		return [];
	}

	getMainWidget() {

		if (!this.link) {
			this.createPreviewElement();
		}
		return this.link;
	}
}
