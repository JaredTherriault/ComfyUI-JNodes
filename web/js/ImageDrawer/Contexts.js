import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ImageElements from "./ImageElements.js";
import {
	getImageListChildren, replaceImageListChildren, clearImageListChildren,
	addElementToImageList, setImageListScrollLevel, setSearchTextAndExecute, clearAndHandleSearch,
	getTrackedFeedImages, setColumnCount, setDrawerSize
} from "./imageDrawer.js"

import { decodeReadableStream } from "../common/utils.js"

let Contexts;

export function initializeContexts() {
	if (!Contexts) {
		Contexts = {
			feed: new ContextFeed(),
			temp: new ContextTemp(),
			input: new ContextInput(),
			output: new ContextOutput(),
			lora: new ContextLora(),
			//			embeddings: new ContextEmbeddings(),
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
	constructor(scrollLevel, searchBarText, columnCount, drawerSize, childElements) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.columnCount = columnCount;
		this.drawerSize = drawerSize;
		this.childElements = childElements;
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

	async switchToContext() {
		const bSuccessfulRestore = await this.checkAndRestoreContextCache();
		if (!bSuccessfulRestore) {
			clearAndHandleSearch(); // Reset search if no cache
		}
		return bSuccessfulRestore;
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
				// Restore scroll level
				setImageListScrollLevel(this.cache.scrollLevel);

				return true;
			}
		}
		return false;
	}
}

class SubFolderExplorer extends ImageDrawerContext {
	constructor(name, description, folderName) {
		super(name, description);
		this.folderName = folderName;
	}

	async loadFolder() {
		clearImageListChildren();
		addElementToImageList($el("label", { textContent: `Loading ${this.folderName} folder...` }));
		const allItems = await api.fetchApi(`/jnodes_comfyui_subfolder_items?subfolder=${this.folderName}`);

		// Decode into a string
		const decodedString = await decodeReadableStream(allItems.body);

		const asJson = JSON.parse(decodedString);

		clearImageListChildren(); // Remove loading indicator
		//for (const folder of allOutputItems) {
		//if (!folder.files) { continue; }
		if (asJson.files.length > 0) {
			for (const file of asJson.files) {
				let element = await ImageElements.createImageElementFromImgSrc(
					{ filename: file, type: this.folderName, subfolder: asJson.folder_path });
				if (element == undefined) { console.log(`Attempting to add undefined image element in ${this.name}`); }
				addElementToImageList(element);
			}
		}
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.loadFolder();
		}
	}
}

export class ContextFeed extends ImageDrawerContext {
	constructor() {
		super("Feed", "The latest generations from this web session (cleared on page refresh)");
	}

	async addNewUncachedFeedImages() {
		const imageListLength = getImageListChildren().length;
		if (imageListLength < getTrackedFeedImages().length) {
			for (let imageIndex = imageListLength; imageIndex < getTrackedFeedImages().length; imageIndex++) {
				const src = getTrackedFeedImages()[imageIndex];
				let element = await ImageElements.createImageElementFromImgSrc(src);
				if (element == undefined) { console.log(`Attempting to add undefined image element in {selectedValue}`); }
				addElementToImageList(element);
			}
		}
	}

	async switchToContext() {
		if (!await super.switchToContext()) {
			clearImageListChildren();
		}

		await this.addNewUncachedFeedImages();
	}
}

export class ContextTemp extends ImageDrawerContext {
	constructor() {
		super("Temp / History", "The generations you've created since the last comfyUI server restart");
	}

	async loadHistory() {
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

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.loadHistory();
		}
	}
}

export class ContextInput extends SubFolderExplorer {
	constructor() {
		super("Input", "Images and videos found in your input folder", "input");
	}
}

export class ContextOutput extends SubFolderExplorer {
	constructor() {
		super("Output", "Images and videos found in your output folder", "output");
	}
}

export class ContextLora extends ImageDrawerContext {
	constructor() {
		super("Lora / Lycoris", "Lora and Lycoris models found in your Lora directory");
	}

	async loadLoras() {
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

	async switchToContext() {
		if (!await super.switchToContext()) {
			await this.loadLoras();
		}
	}
}

export class ContextEmbeddings extends ImageDrawerContext {
	constructor() {
		super("Embeddings / Textual Inversions", "Embedding/textual inversion models found in your embeddings directory");
	}
}

export class ContextSavedPrompts extends SubFolderExplorer {
	constructor() {
		super(
			"Saved Prompts",
			"Images and videos found in the JNodes/SavedPrompts folder and its subfolders. Title comes from filename",
			"JNodes/saved_prompts");
	}
}

export class ContextMetadataReader extends ImageDrawerContext {
	constructor() {
		super("Metadata Reader", "Read and display metadata from a generation");
	}
}

export class ContextCompare extends ImageDrawerContext {
	constructor() {
		super("Compare", "Compare generations sent to this context via menu. Does not persist on refresh.");
	}
}
