import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ImageElements from "./ImageElements.js";
import * as Sorting from "./Sorting.js";
import { getCurrentContextName } from "./ContextSelector.js";
import {
	getImageListChildren, replaceImageListChildren, clearImageListChildren,
	addElementToImageList, setImageListScrollLevel, setSearchTextAndExecute,
	clearAndHandleSearch, setColumnCount, setDrawerSize, setContextToolbarWidget
} from "./imageDrawer.js"

import { decodeReadableStream, waitForImageCompletion } from "../common/utils.js"

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
			savedPrompts: new ContextSavedPrompts(),
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
	constructor(scrollLevel, searchBarText, columnCount, drawerSize, childElements, sortType) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.columnCount = columnCount;
		this.drawerSize = drawerSize;
		this.childElements = childElements;
		this.sortType = sortType;
	}
};

class ImageDrawerContext {
	constructor(name, description) {
		this.name = name;
		this.description = description;
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
		if (this.cache && this.cache.childElements.length > 1) {
			this.cache.childElements.reverse();
		}
	}

	async switchToContext(bSkipRestore = false) {
		const bSuccessfulRestore = bSkipRestore || await this.checkAndRestoreContextCache();
		if (!bSuccessfulRestore) {
			clearAndHandleSearch(); // Reset search if no cache
		}

		setContextToolbarWidget(await this.makeToolbar());

		return bSuccessfulRestore;
	}

	async makeToolbar() {
		return $el("div", { //Inner container so it can maintain 'flex' display attribute
			style: {
				alignItems: 'center',
				display: 'flex',
				gap: '.5rem',
				flex: '0 1 fit-content',
				justifyContent: 'flex-end',
			}
		});
	}

	async checkAndRestoreContextCache() {
		if (this.hasCache()) {
			if (this.cache.childElements.length > 0) {
				// Replace children
				replaceImageListChildren(this.cache.childElements);
				// Execute Search
				setSearchTextAndExecute(this.cache.searchBarText);
				// Drawer column count and size
				setColumnCount(this.cache.columnCount);
				setDrawerSize(this.cache.drawerSize);
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
}

class ContextClearable extends ImageDrawerContext {
	async onClearClicked() { }

	async makeToolbar() {
		// Remove all images from the list
		let clearButton = $el("button.JNodes-image-drawer-btn", {
			textContent: "Clear",
			onclick: async () => {
				await this.onClearClicked();
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
		clearImageListChildren(); // Remove loading indicator
		//console.log("modelDicts: " + JSON.stringify(loraDicts));
		const modelKeys = Object.keys(modelDicts);
		if (modelKeys.length > 0) {
			let count = 0;
			let maxCount = 0;
			for (const modelKey of modelKeys) {
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
	constructor(name, description, folderName) {
		super(name, description);
		this.folderName = folderName;
		this.rootFolderDisplayName = '/root';
		this.bIncludeSubfolders = false;
		this.fileMap = null;
		this.subfolderSelector = null;
	}

	async loadFolder() {
		clearImageListChildren();
		await addElementToImageList($el("label", { textContent: `Loading ${this.folderName} folder...` }));
		const allItems = await api.fetchApi(`/jnodes_comfyui_subfolder_items?subfolder=${this.folderName}`);

		// Decode into a string
		const decodedString = await decodeReadableStream(allItems.body);

		this.fileMap = JSON.parse(decodedString);

		// Fill out combo box options based on folder paths
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

		// Load root folder (even if there are no images within)
		await this.loadImagesInFolder('');
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

		const bIsRoot = folder_path == '';

		clearImageListChildren(); 

		const values = Object.values(this.fileMap);
		for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {

			const value = values[valueIndex];

			if (this.bIncludeSubfolders) {
				if (!bIsRoot && !value.folder_path.startsWith(folder_path)) {
					// If we want to include subfolders and we're not starting from root, require that value.folder_path starts with folder_path
					continue;
				}
			} else {
				if (!bIsRoot && value.folder_path != folder_path) {
					// Require an exact match when not including subfolders
					continue;
				}
			}

			for (const file of value.files) {
				let element = await ImageElements.createImageElementFromImgSrc(
					{
						filename: file.item,
						type: this.folderName,
						subfolder: value.folder_path,
						file_age: file.file_age
					});
				if (element == undefined) { console.log(`Attempting to add undefined image element in ${this.name}`); }
				await addElementToImageList(element);
			}

			// We only need one match if we're not including subfolders
			if (!this.bIncludeSubfolders) {
				break;
			}
		}
	}

	async makeToolbar() {

		const container = await super.makeToolbar();
		const self = this;

		const IncludeSubfoldersToggle = $el("input", {
			id: 'IncludeSubfoldersToggle',
			type: 'checkbox',
			checked: self.bIncludeSubfolders,
			onchange: (e) => {
				self.bIncludeSubfolders = e.target.checked;
				self.loadImagesInFolder(self.subfolderSelector.value);
			}
		});

		container.insertBefore($el("div", {
			style: {
				display: 'flex',
				flexDirection: 'row'
			}
		}, [
			$el("label", {
				textContent: 'Include subfolders?',
				toolTip: 'Include items found in subfolders? Be careful, this can be very memory-intensive if there are too many items. Browsers can crash.',
			}), IncludeSubfoldersToggle]),
			container.firstChild);

		this.subfolderSelector = $el("select", { //Inner container so it can maintain 'flex' display attribute
			style: {
				width: '100%',
			}
		});

		this.subfolderSelector.addEventListener("change", async function() {
			IncludeSubfoldersToggle.checked = self.bIncludeSubfolders = false;
			const selectedValue = this.value;
			await self.loadImagesInFolder(selectedValue);
		});

		container.insertBefore(this.subfolderSelector, container.firstChild);

		return container;
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.loadFolder();
		}
	}

	async onRefreshClicked() {
		await this.loadFolder();
		super.onRefreshClicked();
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

	async addNewUncachedFeedImages(bShouldSort = true) {
		const imageListLength = getImageListChildren().length;
		if (imageListLength < this.feedImages.length) {
			for (let imageIndex = imageListLength; imageIndex < this.feedImages.length; imageIndex++) {
				let src = this.feedImages[imageIndex];
				let element = await ImageElements.createImageElementFromImgSrc(src);
				if (element == undefined) { console.log(`Attempting to add undefined image element in ${this.name}`); }
				await addElementToImageList(element);
			}

			if (bShouldSort) {
				Sorting.sortWithCurrentType();
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
		super("Temp / History", "The generations you've created since the last comfyUI server restart", "temp");
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
		super("Output", "Images and videos found in your output folder", "output");
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
