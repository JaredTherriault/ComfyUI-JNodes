import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ContextSelector from "./ContextSelector.js";
import * as Sorting from "./Sorting.js";

import { setElementVisibility, getVisualElements, getVideoElements } from "../common/Utilities.js"
import { observeVisualElement, unobserveVisualElement } from "../common/ImageAndVideoObserver.js";
import { 
	ImageDrawerConfigSetting, setupUiSettings, createDrawerSelectionWidget, 
	setting_bEnabled, setting_bMasterVisibility, setting_DrawerAnchor
} from "./UiSettings.js";
import { createLabeledSliderRange, options_LabeledSliderRange } from "../common/SettingsManager.js";

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

//Singletons

let imageDrawer;
let imageList;
let DrawerOptionsFlyout;
let SearchBar;
let ImageDrawerContextToolbar;
let drawerWidthSlider;
let drawerHeightSlider;
let columnSlider;

const _minimumDrawerSize = 10;
const _maximumDrawerSize = 100;

let setting_ColumnCount = new ImageDrawerConfigSetting("ImageSize", 4);
let setting_DrawerHeight = new ImageDrawerConfigSetting("DrawerHeight", 25);
let setting_DrawerWidth = new ImageDrawerConfigSetting("DrawerWidth", 25);

// Helpers

// Returns all child nodes of any kind
export function getImageListChildren() {
	return imageList.childNodes;
}

export function replaceImageListChildren(newChildren) {
	clearImageListChildren();
	for (let child of newChildren) {
		addElementToImageList(child, false);
	}

	handleSearch();
}

export function clearImageListChildren() {
	const childNodeCount = getImageListChildren().length;
	for (let childIndex = childNodeCount; childIndex >= 0; childIndex--) {
		removeElementFromImageList(getImageListChildren()[childIndex], false);
	}
};

export function removeElementFromImageList(element, bHandleSearch = true) {
	if (element != undefined) {
		//console.log("removing element: " + element);
		for (let videoElement of getVideoElements(element)) {
			unobserveVisualElement(videoElement);
		}
		imageList.removeChild(element);
		if (bHandleSearch) {
			handleSearch();
		}
	} else {
		console.log("Attempted to remove undefined element");
	}
};

export async function addElementToImageList(element, bHandleSearch = true) {
	//console.log("adding element: " + element);
	if (element != undefined) {
		imageList.appendChild(element);
		for (let visualElement of getVisualElements(element)) {
			observeVisualElement(visualElement);
		}
		if (bHandleSearch) {
			handleSearch();
		}
	} else {
		console.log("Attempted to add undefined element");
	}
};

export function getColumnCount() {
	return setting_ColumnCount.value;
}

export function setColumnCount(value, setColumnCountSliderValue = true) {
	setting_ColumnCount.value = value;
	imageDrawer?.style.setProperty("--column-count", value);
	if (setColumnCountSliderValue && columnSlider) {
		columnSlider.max = Math.max(10, value, columnSlider.max);
		columnSlider.value = value;
		columnSlider.title = `Controls the number of columns in the drawer (${value} columns).\nClick label to set custom value.`;
	}
}

export function getDrawerWidth() {
	return setting_DrawerWidth.value;
}

export function setDrawerWidth(value, setDrawerWidthSliderValue = true) {
	setting_DrawerWidth.value = value;
	imageDrawer?.style.setProperty("--drawer-width", value);
	if (setDrawerWidthSliderValue && drawerWidthSlider) {
		drawerWidthSlider.value = value;
		drawerWidthSlider.title = `Controls the maximum width of the drawer panel (${value}vw)`;
	}
}

export function getDrawerHeight() {
	return setting_DrawerHeight.value;
}

export function setDrawerHeight(value, setDrawerHeightSliderValue = true) {
	setting_DrawerHeight.value = value;
	imageDrawer?.style.setProperty("--drawer-height", value);
	if (setDrawerHeightSliderValue && drawerHeightSlider) {
		drawerHeightSlider.value = value;
		drawerHeightSlider.title = `Controls the maximum height of the drawer panel (${value}vh)`;
	}
}

function setDrawerAnchor(value) {
	setting_DrawerAnchor.value = value;
	imageDrawer.className =
		`JNodes-image-drawer JNodes-image-drawer--${value}`;
}

function createSearchBar() {
	SearchBar = $el("input", {
		type: "text",
		id: "SearchInput",
		placeholder: "Type here to search",
		autocomplete: "off",
		style: {
			width: '100%',
		}
	});

	// Attach the handleSearch function to the input's 'input' event
	SearchBar?.addEventListener('input', handleSearch);

	return SearchBar;
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

export function focusAndSelectSearchText() {
	SearchBar.select(); // Select focuses already
}

// Function to execute seach with an explicit searchTerm
export function executeSearch(searchTerm) {

	// Provision search string
	searchTerm = searchTerm.toLowerCase().trim();

	// Loop through items and check for a match
	for (let i = 0; i < imageList?.children?.length; i++) {
		let itemText = imageList?.children[i]?.searchTerms?.toLowerCase().trim();
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

export function setContextToolbarWidget(widget) {
	ImageDrawerContextToolbar.replaceChildren(widget);
}

export function setSortingOptions(options) {
	ImageDrawerContextToolbar.replaceChildren(widget);
}

const createDrawerOptionsFlyout = () => {

	let widthSliderOptions = new options_LabeledSliderRange();
	widthSliderOptions.min = _minimumDrawerSize;
	widthSliderOptions.max = _maximumDrawerSize;
	widthSliderOptions.value = getDrawerWidth();
	widthSliderOptions.oninput = (e) => {
		setDrawerWidth(e.target.value, false);
	};
	drawerWidthSlider = createLabeledSliderRange(widthSliderOptions);
	setDrawerWidth(getDrawerWidth());

	let heightSliderOptions = new options_LabeledSliderRange();
	heightSliderOptions.min = _minimumDrawerSize;
	heightSliderOptions.max = _maximumDrawerSize;
	heightSliderOptions.value = getDrawerHeight();
	heightSliderOptions.oninput = (e) => {
		setDrawerHeight(e.target.value, false);
	};
	drawerHeightSlider = createLabeledSliderRange(heightSliderOptions);
	setDrawerHeight(getDrawerHeight());

	let columnSliderOptions = new options_LabeledSliderRange();
	columnSliderOptions.min = 1;
	columnSliderOptions.max = 10;
	columnSliderOptions.step = 1;
	columnSliderOptions.value = getColumnCount();
	columnSliderOptions.oninput = (e) => {
		setColumnCount(e.target.value, false);
	};
	columnSlider = createLabeledSliderRange(columnSliderOptions);
	setColumnCount(getColumnCount());

	DrawerOptionsFlyout =
		$el("section.sizing-menu", [
			$el("label.size-control-handle", { textContent: "👁️" }),
			$el("div.size-controls-flyout", [
				$el("tr.section.size-control.drawer-width-control", [
					$el('td', [$el("span", {
						textContent: 'Drawer Width',
					})]),
					$el('td', [drawerWidthSlider])
				]),
				$el("tr.section.size-control.drawer-height-control", [
					$el('td', [$el("span", {
						textContent: 'Drawer Height',
					})]),
					$el('td', [drawerHeightSlider])
				]),
				$el("tr.section.size-control.column-count-control", [
					$el('td', [$el("a", {
						textContent: "Column count",
						style: {
							cursor: "pointer",
							textDecoration: "underline",
						},
						onclick: () => {
							const value = +prompt("Enter custom column count", 20);
							if (!isNaN(value)) {
								setColumnCount(value);
							}
						},
					})]),
					$el('td', [columnSlider])
				]),
				// Anchor Select
				$el("tr.section.drawer-anchor-control", [
					$el('td', [$el("span", {
						textContent: "Image Drawer Anchor:",
					})]),
					$el('td', [createDrawerSelectionWidget((e) => { setDrawerAnchor(e.target.value); })])
				]),
			])
		]);
};

app.registerExtension({
	name: "JNodes.ImageDrawer",
	async setup() {

		setupUiSettings((e) => { setDrawerAnchor(e.target.value); });

		if (!setting_bEnabled.value) {
			return;
		}

		// Remove the drawer widget from view, can be re-opened with showButton
		const hideButton = $el("button.JNodes-image-drawer-btn.hide-btn", {
			textContent: "❌",
			onclick: () => {
				imageDrawer.style.display = "none";
				showButton.style.display = "unset";
				setting_bMasterVisibility.value = false;
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		// Get loras right at the start so we ensure we have to wait less when switching to loras context
		ExtraNetworks.getLoras();

		// The main drawer widget
		imageDrawer = $el("div.JNodes-image-drawer", {
			parent: document.body
		});

		// Initialize Anchor
		const drawerStartingAnchor = setting_DrawerAnchor.value;
		imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${drawerStartingAnchor}`;

		// Where images are shown
		imageList = $el("div.JNodes-image-drawer-list", {
			style: {
				visibility: 'visible',
			}
		});

		// Resizing / View options
		createDrawerOptionsFlyout();

		// Search bar
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
				createSearchBar(), SearchBarClearButton, RandomizeButton
			]);

		const BasicControlsGroup =
			$el("div.JNodes-image-drawer-basic-controls-group", [hideButton, DrawerOptionsFlyout]);

		ImageDrawerContextToolbar =
			$el("div.JNodes-image-drawer-context-toolbar");

		function makeDropDownComboContainer() {
			// Context and sorting Dropdowns
			const sorting = Sorting.makeSortingWidget(); // Sorting first since contexts act upon sorting
			sorting.style.width = '50%';
			const context = ContextSelector.createContextSelector();
			context.style.width = '50%';

			const DropDownComboContainer = $el("div", {
				style: {
					display: "flex",
					flexDirection: "row"
				}
			}, [context, sorting]);

			return DropDownComboContainer;
		}

		const ImageDrawerMenu =
			$el("div.JNodes-image-drawer-menu", {
				style: {
					minHeight: 'fit-content',
					minWidth: 'fit-content',
					position: 'relative',
					flex: '0 1 min-content',
					display: 'flex',
					gap: '3px',
					padding: '3px',
					justifyContent: 'flex-start',
				},
			}, [
				BasicControlsGroup,
				makeDropDownComboContainer(),
				SearchBarGroup,
				ImageDrawerContextToolbar,
			]);
		imageDrawer.append(ImageDrawerMenu, imageList);

		// If not supposed to be visible on startup, close it
		if (!setting_bMasterVisibility.value) {
			hideButton.onclick();
		}

	},
});