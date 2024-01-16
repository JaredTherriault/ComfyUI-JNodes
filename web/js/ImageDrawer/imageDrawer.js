import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ImageElements from "./ImageElements.js"

import { getValue, setValue, addJNodesSetting } from "../common/utils.js"

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

//Singletons

let imageDrawer;
let imageList;
let DrawerOptionsFlyout;
let drawerSizeSlider;
let ContextSelector;
let SearchBar;
let ImageDrawerButtonGroup;
let clearButton;

let feedImages = [];

const _minimumDrawerSize = 4;
const _maximumDrawerSize = 100;

// UI Settings
export const defaultKeyList = "prompt, workflow";

// Context selection constants
const contextSelectorOptionNames = {
	feedName: { name: "feed", description: "The latest generations from this web session (cleared on page refresh)"},
	tempName: { name: "temp/history", description: "The generations you've created since the last comfyUI server restart"},
//	inputName: { name: "input", description: "Images and videos found in your input folder"},
	loraName: { name: "Lora/Lycoris", description: "Lora and Lycoris models found in your Lora directory"},
//	embeddingsName: { name: "Embeddings", description: "Embedding/textual inversion models found in your embeddings directory"},
//	pngInfoName: { name: "Image Info", description: "Read and display metadata from an image or video"},
//	compareName: { name: "Compare", description: "Compare generations sent to this context via menu"},
//	resourcesName: { name: "Resources", description: "For things like poses, depth images, etc"},
};

class ContextState {
	constructor(scrollLevel, searchBarText, childElements) {
		this.scrollLevel = scrollLevel;
		this.searchBarText = searchBarText;
		this.childElements = childElements;
	}
};

let lastSelectedContextOption = contextSelectorOptionNames.feedName.name;
let contextCache = new Map();

// localStorage accessors
export const getVal = (n, d) => {
	return getValue("ImageDrawer." + n, d);
};

export const saveVal = (n, v) => {
	setValue("ImageDrawer." + n, v);
};

// Helpers

export const getImagesInList = () => {
	const imgs =
		[...imageList?.querySelectorAll("img")].map((img) => img.getAttribute("src"));
	return imgs;
};

export const clearImageList = () => {
	imageList.replaceChildren();
};

export const addElementToImageList = (element) => {
	//console.log("adding element: " + element);
	if (element != undefined) {
		const method = getVal("drawerDirection", "newest first") === "newest first" ? "prepend" : "append";
		imageList[method](element);
		toggleFeedImageButtonsBasedOnContextAndImageCount();
		handleSearch();
	}
	else {
		console.log("Attempted to add undefined element");
	}
};

export const setElementVisibility = (element, bNewVisible) => {
	if (!element) { return; }
	element.style.display = bNewVisible ? "unset" : "none";
}

export const toggleFeedImageButtonsBasedOnContextAndImageCount = () => {
	const imgs = getImagesInList();
	const bHasImages = imgs.length > 0;
	const bIsFeedView = ContextSelector?.value == contextSelectorOptionNames.feedName.name;

	setElementVisibility(clearButton, bIsFeedView && bHasImages);
}

export const setDrawerSize = (value, setDrawerSizeSliderValue = false) => {
	saveVal("DrawerSize", value);
	imageDrawer?.style.setProperty("--max-size", value);
	if (setDrawerSizeSliderValue && drawerSizeSlider) {
		drawerSizeSlider.value = value;
	}
}

const setupUiSettings = () => {
	// Enable/disable
	{
		const labelWidget = $el("label", {
			textContent: "Image Drawer Enabled:",
		});

		const settingWidget = $el(
			"input",
			{
				type: "checkbox",
				checked: getVal("Enabled", true),
				oninput: (e) => {
					saveVal("Enabled", e.target.value);
				},
			},
		);

		const tooltip = "Whether or not the image drawer is initialized (requires page reload)";
		addJNodesSetting(labelWidget, settingWidget, tooltip);
	}
	// Drawer location
	{
		const labelWidget = $el("label", {
			textContent: "Image Drawer Location:",
		});

		const settingWidget = $el(
			"select",
			{
				oninput: (e) => {
					saveVal("DrawerLocation", e.target.value);
					imageDrawer.className =
						`JNodes-image-drawer JNodes-image-drawer--${e.target.value}`;
				},
			},
			["left", "top", "right", "bottom"].map((m) =>
				$el("option", {
					value: m,
					textContent: m,
					selected: getVal("DrawerLocation", "left") === m,
				})
			)
		);

		const tooltip = "To which part of the screen the drawer should be docked";
		addJNodesSetting(labelWidget, settingWidget, tooltip);
	}

	// Mouse over image/video key allow/deny list
	{
		const labelWidget = $el("label", {
			textContent: "Image Drawer Image & Video Key List:",
		});

		const settingWidget = $el(
			"input",
			{
				defaultValue: getVal("ImageVideo.KeyList", defaultKeyList),
				oninput: (e) => {
					saveVal("ImageVideo.KeyList", e.target.value);
				},
			},
		);

		const tooltip = "A set of comma-separated names to include or exclude " +
			"from the tooltips applied to images in the drawer";
		addJNodesSetting(labelWidget, settingWidget, tooltip);
	}

	// Mouse over image/video key allow/deny list toggle
	{
		const labelWidget = $el("label", {
			textContent: "Image Drawer Image & Video Key List Allow/Deny Toggle:",
		});

		const settingWidget = $el(
			"input",
			{
				type: "checkbox",
				checked: getVal("ImageVideo.KeyListAllowDenyToggle", false),
				oninput: (e) => {
					saveVal("ImageVideo.KeyListAllowDenyToggle", e.target.value);
				},
			},
		);

		const tooltip = `Whether the terms listed in the Key List should be 
		denied or allowed, excluding everything else.
		True = Allow list, False = Deny list.`
		addJNodesSetting(labelWidget, settingWidget, tooltip);
	}
};

const createDrawerOptionsFlyout = () => {
	let columnInput;
	function updateColumnCount(v) {
		columnInput.parentElement.title = `Controls the number of columns in the drawer (${v} columns).\nClick label to set custom value.`;
		imageDrawer.style.setProperty("--img-sz", v);
		saveVal("ImageSize", v);
		columnInput.max = Math.max(10, v, columnInput.max);
		columnInput.value = v;
	}

	drawerSizeSlider = $el("input", {
		type: "range",
		min: _minimumDrawerSize,
		max: _maximumDrawerSize,
		oninput: (e) => {
			e.target.parentElement.title = `Controls the maximum size of the drawer panel (${e.target.value}vh)`;
			setDrawerSize(e.target.value);
		},
		$: (el) => {
			requestAnimationFrame(() => {
				el.value = getVal("DrawerSize", 25);
				el.oninput({ target: el });
			});
		},
	});

	DrawerOptionsFlyout =
		$el("section.sizing-menu", [
			$el("label.size-control-handle", { textContent: "↹ Drawer Options" }),
			$el("div.size-controls-flyout", [
				$el("section.size-control.drawer-size-control", [
					$el("span", {
						textContent: "Drawer Size",
					}),
					drawerSizeSlider,
				]),
				$el("section.size-control.image-size-control", [
					$el("a", {
						textContent: "Column count",
						style: {
							cursor: "pointer",
							textDecoration: "underline",
						},
						onclick: () => {
							const v = +prompt("Enter custom column count", 20);
							if (!isNaN(v)) {
								updateColumnCount(v);
							}
						},
					}),
					$el("input", {
						type: "range",
						min: 1,
						max: 10,
						step: 1,
						oninput: (e) => {
							updateColumnCount(e.target.value);
						},
						$: (el) => {
							columnInput = el;
							requestAnimationFrame(() => {
								updateColumnCount(getVal("ImageSize", 4));
							});
						},
					}),
				]),
				// Add a checkbox and label
				$el("section.size-control.checkbox-control", [
					$el("label", {
						textContent: "Show Newest First",
					}),
					$el("input", {
						type: "checkbox",
						checked: getVal("drawerDirection", "newest first") == "newest first",
						onchange: (e) => {
							saveVal("drawerDirection", getVal("drawerDirection", "newest first") == "newest first" ? "oldest first" : "newest first");
							const contextKeys = Object.keys(contextCache);
							for (const key in contextKeys) {
								contextCache[key].replaceChildren(contextCache[key].reverse());
							}

							imageList.replaceChildren(...contextCache.get(ContextSelector.value));
						},
					}),
				]),
			]),
		]);
};

const createContextSelector = () => {

	function checkContextCache(selectedValue) {
		const bHasCache = contextCache.has(selectedValue);
		if (bHasCache) {
			const cachedContent = contextCache.get(selectedValue);
			// Replace children
			imageList.replaceChildren(...cachedContent.childElements); // Spread the array 
			// Execute Search
			setSearchTextAndExecute(cachedContent.searchBarText);
			// Restore scroll level
			setImageListScrollLevel(cachedContent.scrollLevel);
		}
		return bHasCache;
	}

	ContextSelector = $el("select");

	for (const optionLabel in contextSelectorOptionNames) {
		if (contextSelectorOptionNames.hasOwnProperty(optionLabel)) {
			const option = document.createElement("option");
			option.value = contextSelectorOptionNames[optionLabel].name;
			option.textContent = contextSelectorOptionNames[optionLabel].name;
			option.title = contextSelectorOptionNames[optionLabel].description;
			ContextSelector.appendChild(option);
		}
	}

	// Add an event listener for the "change" event
	ContextSelector.addEventListener("change", async function() {
		const selectedValue = ContextSelector.value;
		// Call your custom function or perform actions based on the selected value
		console.log("ContextSelector selectedValue:" + selectedValue);

		// Create cache for previously selected option
		if (lastSelectedContextOption) {
			const childNodesArray = Array.from(imageList.childNodes);
			contextCache.set(lastSelectedContextOption, new ContextState(getImageListScrollLevel(), getSearchText(), childNodesArray));
			console.log("contextCache: " + JSON.stringify(contextCache));
		}

		// Replace imageList with appropriate elements
		if (selectedValue == contextSelectorOptionNames.feedName.name) {
			if (!checkContextCache(selectedValue)) {
				clearImageList();
			}
			const imageListLength = getImagesInList().length;
			if (imageListLength < feedImages.length) {
				for (let imageIndex = imageListLength; imageIndex < feedImages.length; imageIndex++) {
					const src = feedImages[imageIndex];
					let element = await ImageElements.createImageElementFromImgSrc(src);
					if (element == undefined) { console.log(`Attempting to add undefined image element in {selectedValue}`); }
					addElementToImageList(element);
				}
			}
		}
		else if (selectedValue == contextSelectorOptionNames.loraName.name) {
			if (!checkContextCache(selectedValue)) {
				await loadLoras();
			}
		}
		else if (selectedValue == contextSelectorOptionNames.tempName.name) {
			if (!checkContextCache(selectedValue)) {
				await loadHistory();
			}
		}

		// Set up lastSelectedContextOption to accommodate future context switching
		lastSelectedContextOption = selectedValue;

		// Automatically focus search bar to save user a click
		focusSearch();
	});
};

const createSearchBar = () => {
	SearchBar = $el("input", {
		type: "text",
		id: "SearchInput",
		placeholder: "Type here to search",
		autocomplete: "off",
		style: {
			width: '-webkit-fill-available',
		}
	});

	// Attach the handleSearch function to the input's 'input' event
	SearchBar?.addEventListener('input', handleSearch);
}

export function clearSearch() {
	if (!SearchBar) { return; }
	SearchBar.value = "";
}

export function getSearchText() {
	return SearchBar.value;
}

export function setSearchText(newText) {
	if (!SearchBar) { return; }
	SearchBar.value = newText;
}

export function setSearchTextAndExecute(newText) {
	if (!SearchBar) { return; }
	SearchBar.value = newText;
	handleSearch();
}

export function clearAndHandleSearch() {
	clearSearch();
	handleSearch();
}

export function focusSearch() {
	SearchBar.focus();
}

// Function to execute seach with an explicit searchTerm
export function executeSearch(searchTerm) {

	// Provision search string
	searchTerm = searchTerm.toLowerCase().trim();

	// Loop through items and check for a match
	for (let i = 0; i < imageList?.children?.length; i++) {
		let itemText = imageList?.children[i]?.getAttribute("searchTerms")?.toLowerCase().trim();
		//console.log(itemText + " matched against " + searchTerm + ": " + itemText.includes(searchTerm));

		setElementVisibility(imageList?.children[i], itemText ? itemText.includes(searchTerm) : true)
	}
}

// Function to execute search using the term entered in the SearchBar
function handleSearch() {
	// Get input value
	let searchTerm = SearchBar?.value;

	executeSearch(searchTerm);
}

async function loadLoras() {
	clearImageList();
	addElementToImageList($el("label", { textContent: "Loading loras..." }));
	let loraDicts = await ExtraNetworks.getLoras();
	clearImageList(); // Remove loading indicator
	//console.log("loraDicts: " + JSON.stringify(loraDicts));
	const loraKeys = Object.keys(loraDicts);
	if (loraKeys.length > 0) {
		let count = 0;
		let maxCount = 0;
		for (const loraName of loraKeys) {
			if (maxCount > 0 && count > maxCount) { break; }
			let element = await ExtraNetworks.createExtraNetworkCard(loraName, loraDicts[loraName]);
			if (element == undefined) {
				console.log("Attempting to add undefined element for lora named: " + loraName + " with dict: " + JSON.stringify(loraDicts[loraName]));
			}
			addElementToImageList(element);
			count++;
		}
	}
	else {
		addElementToImageList($el("label", { textContent: "No loras or locons were found." }));
	}
}

async function loadHistory() {
	clearImageList();
	addElementToImageList($el("label", { textContent: "Loading history..." }));
	const allHistory = await api.getHistory()
	clearImageList(); // Remove loading indicator
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

export function getImageListScrollLevel() {
	if (imageList) {
		return imageList.scrollTop;
	}
}

export function setImageListScrollLevel(newScrollPosition) {
	if (imageList) {
		imageList.scrollTop = newScrollPosition;
	}
}

app.registerExtension({
	name: "JNodes.ImageDrawer",
	async setup() {

		setupUiSettings();

		if (!getVal("Enabled", true)) {
			return;
		}

		// Get loras right at the start so we ensure we have to wait less when switching to loras context
		ExtraNetworks.getLoras();

		// The main drawer widget
		imageDrawer = $el("div.JNodes-image-drawer", {
			parent: document.body,
			style: {
				position: 'absolute',
				background: 'var(--comfy-menu-bg)',
				color: 'var(--fg-color)',
				zIndex: '99',
				fontFamily: 'sans-serif',
				fontSize: '12px',
				display: 'flex',
				flexDirection: 'column',
			}
		});

		// Initialize location
		const drawerStartingLocation = getVal("DrawerLocation", "left");
		imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${drawerStartingLocation}`;

		// Where images are shown
		imageList = $el("div.JNodes-image-drawer-list", {
			style: {
				visibility: 'visible',
			}
		});

		// Button setup

		// A button shown in the comfy modal to show the drawer after it's been hidden
		const showButton = $el("button.comfy-settings-btn", {
			textContent: "🖼️",
			style: {
				right: "16px",
				cursor: "pointer",
				display: "none",
			},
		});
		showButton.onclick = () => {
			imageDrawer.style.display = "block";
			showButton.style.display = "none";
			saveVal("bMasterVisibility", true);
		};
		document.querySelector(".comfy-settings-btn").after(showButton);

		// Remove the drawer widget from view, can be re-opened with showButton
		const hideButton = $el("button.JNodes-image-drawer-btn.hide-btn", {
			textContent: "❌",
			onclick: () => {
				imageDrawer.style.display = "none";
				showButton.style.display = "unset";
				saveVal("bMasterVisibility", false);
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		// Remove all images from the list (only for Feed)
		// Only shown when the imageList has elements within
		clearButton = $el("button.JNodes-image-drawer-btn.clear-btn", {
			textContent: "Clear",
			onclick: () => {
				clearImageList();
				feedImages = [];
				toggleFeedImageButtonsBasedOnContextAndImageCount();
			},
			style: {
				display: "none", // Initially hide the button
				width: "fit-content",
				padding: '3px',
			},
		});

		// Resizing / View options
		createDrawerOptionsFlyout();

		// Context dropdown
		createContextSelector();

		// Search bar
		createSearchBar();

		const SearchBarClearButton = $el("button.JNodes-search-bar-clear-btn", {
			textContent: "❌",
			title: "Clear Search",
			onclick: clearAndHandleSearch
		});

		async function onClickSearchRandomizeButton() {
			let loraDicts = await ExtraNetworks.getLoras();
			const loraKeys = Object.keys(loraDicts);
			const randomIndex = Math.floor(Math.random() * loraKeys.length);
			SearchBar.value = loraKeys[randomIndex];
			handleSearch();
		}

		const RandomizeButton = $el("button.JNodes-search-randomize-btn", {
			textContent: "🎲",
			title: "Random Suggestion",
			onclick: onClickSearchRandomizeButton
		});

		const SearchBarGroup =
			$el("div.JNodes-search-bar-group", {
				style: {
					width: '100%',
					display: 'flex',
					flexDirection: 'row',
				}
			}, [
				SearchBar, SearchBarClearButton, RandomizeButton
			]);

		const BasicControlsGroup =
			$el("div.JNodes-image-drawer-basic-controls-group", {
				style: {
					alignItems: 'left',
					display: 'flex',
					gap: '.5rem',
					flex: '0 1 fit-content',
					justifyContent: 'flex-start',
				}
			}, [hideButton, DrawerOptionsFlyout]);

		ImageDrawerButtonGroup =
			$el("div.JNodes-image-drawer-btn-group", [
				$el("div", { //Inner container so it can maintain 'flex' display attribute
					style: {
						alignItems: 'left',
						display: 'flex',
						gap: '.5rem',
						flex: '0 1 fit-content',
						justifyContent: 'flex-start',
					}
				}, [clearButton]
				)
			]);

		const ImageDrawerMenu =
			$el("div.JNodes-image-drawer-menu", {
				style: {
					minHeight: '10%',
					position: 'relative',
					flex: '0 1 min-content',
					display: 'flex',
					gap: '3px',
					padding: '5px',
					justifyContent: 'flex-start',
					minWidth: 'fit-content',
				},
			}, [
				BasicControlsGroup,
				ContextSelector,
				SearchBarGroup,
				ImageDrawerButtonGroup,
			]);
		imageDrawer.append(ImageDrawerMenu, imageList);

		// If not supposed to be visible on startup, close it
		if (!getVal("bMasterVisibility", true)) {
			hideButton.onclick();
		}

		api.addEventListener("executed", async ({ detail }) => {
			const outImages = detail?.output?.images;
			if (outImages) {
				for (const src of outImages) {
					// Always add feed images to the record, but only add thumbs to the imageList if
					// we're currently in feed mode. Otherwise they'll be added when switching to feed.
					feedImages.push(src);

					if (ContextSelector.value == contextSelectorOptionNames.feedName.name) {
						let element = await ImageElements.createImageElementFromImgSrc(src);
						if (element == undefined) { console.log("attempting to add undefined element in addEventListener"); }
						addElementToImageList(element);
					}
				}
			}
		});
	},
});