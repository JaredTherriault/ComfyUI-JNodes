import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ImageElements from "./ImageElements.js";
import * as Sorting from "./Sorting.js";
import { getCurrentContextName, getCurrentContextObject } from "./ContextSelector.js";
import {
	setColumnCount, setDrawerHeight, setDrawerWidth, setContextToolbarWidget
} from "./ImageDrawer.js"

import {
	getImageListChildren, replaceImageListChildren, clearImageListChildren,
	addElementToImageList, setImageListScrollLevel, setSearchTextAndExecute,
	clearAndExecuteSearch
} from "./ImageListAndSearch.js"

import { decodeReadableStream } from "../common/Utilities.js"

import {
	createLabeledCheckboxToggle, createLabeledSliderRange, createVideoPlaybackOptionsFlyout,
	options_LabeledCheckboxToggle, options_LabeledSliderRange, setting_ModelCardAspectRatio
} from "../common/SettingsManager.js";

let Contexts;

export function initializeContexts() {
	if (!Contexts) {
		Contexts = {
			feed: new ContextFeed(),
			temp: new ContextTemp(),
			input: new ContextInput(),
			output: new ContextOutput(),
			lora: new ContextLora(),
			embeddings: new ContextEmbeddings(),
			//savedPrompts: new ContextSavedPrompts(),
			//			metadata: new ContextMetadataReader(),
			//			compare: new ContextCompare(),
		};
	}
};

export function getContexts() {
	return Contexts;
}

export function getContextObjectFromName(contextName) {
	const contextValues = Object.values(Contexts);

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

export class ImageDrawerContextCache {
	constructor(scrollLevel, searchBarText, columnCount, drawerWidth, drawerHeight, imageListElements, sortType) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.columnCount = columnCount;
		this.drawerWidth = drawerWidth;
		this.drawerHeight = drawerHeight;
		this.imageListElements = imageListElements;
		this.sortType = sortType;
	}
};

class ImageDrawerContext {
	constructor(name, tooltip) {
		this.name = name;
		this.tooltip = tooltip;
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

	reverseItemsInCache() {
		if (this.cache && this.cache.imageListElements.length > 1) {
			this.cache.imageListElements.reverse();
		}
	}

	async switchToContext(bSkipRestore = false) {
		const bSuccessfulRestore = bSkipRestore || await this.checkAndRestoreContextCache();
		if (!bSuccessfulRestore) {
			clearAndExecuteSearch(); // Reset search if no cache
		}

		setContextToolbarWidget(await this.makeToolbar());

		return bSuccessfulRestore;
	}

	async makeToolbar() {
		return $el("div", { //Inner container so it can maintain 'flex' display attribute
			style: {
				alignItems: 'normal',
				display: 'flex',
				gap: '.5rem',
				flex: '0 1 fit-content',
				justifyContent: 'flex-end',
			}
		});
	}

	async checkAndRestoreContextCache() {
		if (this.hasCache()) {
			if (this.cache.imageListElements.length > 0) {
				// Replace children
				replaceImageListChildren(this.cache.imageListElements);
				// Execute Search
				setSearchTextAndExecute(this.cache.searchBarText);
				// Drawer column count and size
				setColumnCount(this.cache.columnCount);
				setDrawerWidth(this.cache.drawerWidth);
				setDrawerHeight(this.cache.drawerHeight);
				// Restore sort type
				Sorting.setOptionSelectedFromOptionName(this.cache.sortType);
				// Restore scroll level
				setImageListScrollLevel(this.cache.scrollLevel);

				return true;
			}
		}
		return false;
	}

	getSupportedSortTypes() {
		return [Sorting.SortTypeFilename, Sorting.SortTypeDate];
	}

	getDesiredSortType() {
		return this.cache?.sortType || this.getDefaultSortType();
	}

	getDefaultSortType() {
		return { type: Sorting.SortTypeFilename, bIsAscending: true };
	}

	shouldCancelAsyncOperation() {
		return getCurrentContextObject() != this; // By default, cancel async operations if the selected context has changed
	}
}

class ContextClearable extends ImageDrawerContext {
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

		finalWidget.appendChild(clearButton);

		return finalWidget;
	}

	getSupportedSortTypes() {
		const SortTypes = [Sorting.SortTypeFileSize, Sorting.SortTypeImageWidth, Sorting.SortTypeImageHeight, Sorting.SortTypeImageAspectRatio, Sorting.SortTypeFileType];
		return super.getSupportedSortTypes().concat(SortTypes);
	}
}

class ContextRefreshable extends ImageDrawerContext {

	async onRefreshClicked() {
		Sorting.sortWithCurrentType();
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

		finalWidget.appendChild(refreshButton);

		return finalWidget;
	}
}

class ContextModel extends ContextRefreshable {
	constructor(name, description, type) {
		super(name, description);
		this.type = type;
	}

	async getModels(bForceRefresh = false) { }

	async loadModels(bForceRefresh = false) {
		clearImageListChildren();
		await addElementToImageList($el("label", { textContent: `Loading ${this.name}...` }));
		let modelDicts = await this.getModels(bForceRefresh);
		if (this.shouldCancelAsyncOperation()) { return; }
		clearImageListChildren(); // Remove loading indicator
		//console.log("modelDicts: " + JSON.stringify(loraDicts));
		const modelKeys = Object.keys(modelDicts);
		if (modelKeys.length > 0) {
			let count = 0;
			let maxCount = 0;
			for (const modelKey of modelKeys) {
				if (this.shouldCancelAsyncOperation()) { break; }

				if (maxCount > 0 && count > maxCount) { break; }
				let element = await ExtraNetworks.createExtraNetworkCard(modelKey, modelDicts[modelKey], this.type);
				if (element == undefined) {
					console.log("Attempting to add undefined element for model named: " + modelKey + " with dict: " + JSON.stringify(modelDicts[modelKey]));
				}
				await addElementToImageList(element);
				count++;
			}
		}
		else {
			await addElementToImageList($el("label", { textContent: "No models were found." }));
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
		options.oninput = (e) => {
			setting_ModelCardAspectRatio.value = e.target.valueAsNumber;
			for (let element of getImageListChildren()) {
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

	getSupportedSortTypes() {
		return super.getSupportedSortTypes().concat([Sorting.SortTypeFriendlyName]);
	}

	getDefaultSortType() {
		return { type: Sorting.SortTypeFriendlyName, bIsAscending: true };
	}
}

class ContextSubFolderExplorer extends ContextRefreshable {
	constructor(name, description, folderName, bShouldForceLoad = false) {
		super(name, description);
		this.rootFolderName = folderName;
		this.rootFolderDisplayName = '/root';
		this.bIncludeSubfolders = false;
		this.fileMap = null;
		this.subfolderSelector = null;
		this.bShouldForceLoad = bShouldForceLoad; // Whether or not to lazy load. Lazy load = !bShouldForceLoad
	}

	// Get the image paths in the folder or directory specified at this.folderName 
	// as well as all subfolders then load the images in a given subfolder
	async fetchFolderItems(path_to_load_images_from = '') {
		clearImageListChildren();
		const withOrWithout = this.bIncludeSubfolders ? "with" : "without";

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

		await addElementToImageList(
			$el('div', [
				$el("label", {
					textContent:
						`Loading folder '${path_to_load_images_from || this.rootFolderName}' ${withOrWithout} subfolders...`
				}),
				//cancelButton
			])
		);
		const allItems = await api.fetchApi(
			'/jnodes_comfyui_subfolder_items' +
			`?root_folder=${this.rootFolderName}` +
			`&start_getting_files_from_folder=${path_to_load_images_from}` +
			`&include_subfolder_files=${this.bIncludeSubfolders}`);

		let decodedString;
		try {
			// Decode into a string
			decodedString = await decodeReadableStream(allItems.body);

			this.fileMap = JSON.parse(decodedString);
		} catch (e) {
			console.error(`Could not get list of files when loading "${this.rootFolderName}": ${e}`)
			this.fileMap.clear(); // Set an empty map on failure. This allows the function to complete without further failures.
		}

		// Fill out combo box options based on folder paths
		const lastSelectedValue = this.subfolderSelector.value; // Cache last selection
		this.subfolderSelector.innerHTML = ''; // Clear combo box
		for (let folderIndex = 0; folderIndex < this.fileMap.length; folderIndex++) {
			const bIsRoot = folderIndex == 0;
			const result = this.fileMap[folderIndex];

			const option = document.createElement("option");
			const folder_path = bIsRoot ? this.rootFolderDisplayName : result.folder_path;
			option.value = bIsRoot ? '' : folder_path;
			option.textContent = folder_path;
			option.title = folder_path;
			this.subfolderSelector.appendChild(option);
		}

		// Restore last selected value if it exists in the new combo options
		for (let option of this.subfolderSelector.options) {
			// Check if the option's value is equal to the specific value
			if (option.value === lastSelectedValue) {
				// If found, set the flag to true and break out of the loop
				this.subfolderSelector.value = lastSelectedValue;
				break;
			}
		}

		// Load root folder if no path is specified (even if there are no images within)
		await this.loadImagesInFolder(path_to_load_images_from);
	}

	findFileMapByFolderPath(folder_path) {

		if (folder_path == '') {
			return this.fileMap[0];
		}

		const values = Object.values(this.fileMap);

		let foundValue;

		for (const value of values) {
			if (value.folder_path.includes(folder_path)) {
				foundValue = value;
				break;
			}
		}

		if (foundValue) {
			return foundValue;
		} else {
			console.error(`fileMap with name '${foundValue}' not found.`);
			return null;
		}
	}

	async loadImagesInFolder(folder_path) {
		if (!this.fileMap) { return; }
		if (this.shouldCancelAsyncOperation()) { return; }

		const bIsRoot = folder_path === '';
		clearImageListChildren();
		const values = Object.values(this.fileMap);

		const bUseBatching = false;

		const evaluateGuardClauses = (value) => {
			if (this.bIncludeSubfolders) {
				if (!bIsRoot && !value.folder_path.startsWith(folder_path)) {
					// If we want to include subfolders and we're not starting from root, require that value.folder_path starts with folder_path
					return true;
				}
			} else {
				if (!bIsRoot && value.folder_path != folder_path) {
					// Require an exact match when not including subfolders
					return true;
				}
			}
		}

		const createElementFromFile = async (file, value) => {
			let element = await ImageElements.createImageElementFromFileInfo({
				filename: file.item,
				file: file,
				type: this.rootFolderName,
				subfolder: value.folder_path,
				bShouldForceLoad: this.bShouldForceLoad,
				bShouldSort: false,
				bShouldApplySearch: false,
			});
			if (element !== undefined) {
				await addElementToImageList(element);
			} else {
				console.log(`Attempted to add undefined image element in ${this.name}`);
			}
		};

		if (bUseBatching) {
			const promises = [];
			for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
				if (this.shouldCancelAsyncOperation()) { break; }

				const value = values[valueIndex];

				if (evaluateGuardClauses(value)) {
					continue;
				}

				const processBatch = async (fileBatch) => {
					let processedElements = [];
					const promises = fileBatch.map(async (file) => {
						const element = await createElementFromFile(file, value);
						if (element) {
							processedElements.push(element);
						}
					});
					await Promise.all(promises);
					await Promise.all(processedElements.map(img => new Promise(resolve => {
						if (img.complete) {
							resolve();
						} else {
							img.onload = resolve;
						}
					})));
				}

				async function processFilesInBatches(files, batchSize, delayBetweenBatches) {
					const batchPromises = [];
					for (let i = 0; i < files.length; i += batchSize) {
						const fileBatch = files.slice(i, i + batchSize);
						batchPromises.push(processBatch(fileBatch));
						await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
					}
					return Promise.all(batchPromises);
				}

				const batchSize = 4;
				const delayBetweenBatches = 0.1;
				promises.push(processFilesInBatches(value.files, batchSize, delayBetweenBatches));

				if (!this.bIncludeSubfolders) {
					break;
				}
			}

			await Promise.all(promises);
		} else {
			for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
				if (this.shouldCancelAsyncOperation()) { break; }

				const value = values[valueIndex];

				if (evaluateGuardClauses(value)) {
					continue;
				}

				for (const file of value.files) {
					await createElementFromFile(file, value);
				}

				// We only need one match if we're not including subfolders
				if (!this.bIncludeSubfolders) {
					break;
				}
			}
		}

		Sorting.sortWithCurrentType();
	}

	async makeToolbar() {

		const container = await super.makeToolbar();
		const self = this;

		container.insertBefore(createVideoPlaybackOptionsFlyout().handle, container.firstChild);

		let includeSubfoldersToggleOptions = new options_LabeledCheckboxToggle();
		includeSubfoldersToggleOptions.labelTextContent = 'Include Subfolders';
		includeSubfoldersToggleOptions.id = 'IncludeSubfoldersToggle';
		includeSubfoldersToggleOptions.checked = self.bIncludeSubfolders;
		includeSubfoldersToggleOptions.oninput = async (e) => {
			self.bIncludeSubfolders = e.target.checked;
			await self.fetchFolderItems(self.subfolderSelector.value);
		}

		const IncludeSubfoldersToggle = createLabeledCheckboxToggle(includeSubfoldersToggleOptions);

		container.insertBefore(IncludeSubfoldersToggle, container.firstChild);

		if (!this.subfolderSelector) {
			this.subfolderSelector = $el("select", { //Inner container so it can maintain 'flex' display attribute
				style: {
					width: '100%',
				}
			});
		}

		this.subfolderSelector.addEventListener("change", async function () {
			// Force subfolder inclusion off to avoid OOM - user must opt-in explicitly each time
			self.bIncludeSubfolders = false;
			IncludeSubfoldersToggle.getMainElement().checked = false;
			const selectedValue = this.value;
			// await api.fetchApi(
			// '/jnodes_request_task_cancellation', { method: "POST" }); // Cancel any outstanding python task
			await self.fetchFolderItems(selectedValue);
		});

		container.insertBefore(this.subfolderSelector, container.firstChild);

		return container;
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.fetchFolderItems();
		}
	}

	async onRefreshClicked() {
		await this.fetchFolderItems(this.subfolderSelector.value);
		await super.onRefreshClicked();
	}

	getSupportedSortTypes() {
		const SortTypes = [Sorting.SortTypeFileSize, Sorting.SortTypeImageWidth, Sorting.SortTypeImageHeight, Sorting.SortTypeImageAspectRatio, Sorting.SortTypeFileType];
		return super.getSupportedSortTypes().concat(SortTypes);
	}
}

export class ContextFeed extends ContextClearable {
	constructor() {
		super("Feed", "The latest generations from this web session (cleared on page refresh)");

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

				if (getCurrentContextName() == this.name) {
					await this.addNewUncachedFeedImages();
				}
			}
		});
	}

	async addNewUncachedFeedImages(bShouldSort = true, bShouldApplySearch = true) {
		const imageListLength = getImageListChildren().length;
		if (imageListLength < this.feedImages.length) {
			for (let imageIndex = imageListLength; imageIndex < this.feedImages.length; imageIndex++) {
				if (this.shouldCancelAsyncOperation()) { break; }

				let fileInfo = this.feedImages[imageIndex];
				fileInfo.bShouldForceLoad = true; // Don't lazy load
				fileInfo.bShouldSort = bShouldSort; // Optionally apply sort after image load
				fileInfo.bShouldApplySearch = bShouldApplySearch; // Optionally apply search after image load
				const element = await ImageElements.createImageElementFromFileInfo(fileInfo);
				if (element == undefined) { console.log(`Attempting to add undefined image element in ${this.name}`); }
				const bHandleSearch = false;
				await addElementToImageList(element, bHandleSearch);
			}
		}
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			clearImageListChildren();
		}

		await this.addNewUncachedFeedImages(false);
	}

	async onClearClicked() {
		clearImageListChildren();
		this.feedImages = [];
	}

	getDefaultSortType() {
		return { type: Sorting.SortTypeDate, bIsAscending: false };
	}
}

export class ContextTemp extends ContextSubFolderExplorer {
	constructor() {
		const bShouldForceLoad = true; // These need to be searchable by meta data
		super("Temp / History", "The generations you've created since the last comfyUI server restart", "temp", bShouldForceLoad);
	}

	getDefaultSortType() {
		return { type: Sorting.SortTypeDate, bIsAscending: false };
	}
}

export class ContextInput extends ContextSubFolderExplorer {
	constructor() {
		super("Input", "Images and videos found in your input folder", "input");
	}
}

export class ContextOutput extends ContextSubFolderExplorer {
	constructor() {
		const bShouldForceLoad = true; // These need to be searchable by meta data
		super("Output", "Images and videos found in your output folder", "output", bShouldForceLoad);
	}
}

export class ContextLora extends ContextModel {
	constructor() {
		super("Lora / Lycoris", "Lora and Lycoris models found in your Lora directory", "loras");
	}

	async getModels(bForceRefresh = false) {
		return await ExtraNetworks.getLoras(bForceRefresh);
	}
}

export class ContextEmbeddings extends ContextModel {
	constructor() {
		super("Embeddings / Textual Inversions", "Embedding/textual inversion models found in your embeddings directory", "embeddings");
	}

	async getModels(bForceRefresh = false) {
		return await ExtraNetworks.getEmbeddings(bForceRefresh);
	}
}

export class ContextSavedPrompts extends ContextSubFolderExplorer {
	constructor() {
		super(
			"Saved Prompts",
			"Images and videos found in the JNodes/saved_prompts folder and its subfolders. Title comes from filename",
			"JNodes/saved_prompts");
	}
}

export class ContextMetadataReader extends ImageDrawerContext {
	constructor() {
		super("Metadata Reader", "Read and display metadata from a generation");
	}

	getSupportedSortNames() {
		return [];
	}
}

export class ContextCompare extends ContextClearable {
	constructor() {
		super("Compare", "Compare generations sent to this context via menu. Does not persist on refresh.");
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			clearImageListChildren();
		}

		//await this.addNewUncachedFeedImages();
	}

	async onClearClicked() {
	}

	getSupportedSortNames() {
		return [];
	}
}
