import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ContextSelector from "./ContextSelector.js";
import * as Sorting from "./Sorting.js";

import {
	ImageDrawerConfigSetting, setupUiSettings, createDrawerSelectionWidget,
	setting_bEnabled, setting_bMasterVisibility, setting_DrawerAnchor,
	createFlyoutHandle, createLabeledSliderRange, options_LabeledSliderRange
} from "../common/SettingsManager.js";
import { clearAndExecuteSearch, createSearchBar, executeSearchWithEnteredSearchText, getImageListElement, setSearchTextAndExecute } from "./ImageListAndSearch.js";

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

//Singletons

let imageDrawer;
let DrawerOptionsFlyout;
let ImageDrawerContextToolbar;
let drawerWidthSlider;
let drawerHeightSlider;
let columnSlider;

const _minimumDrawerSize = 15;
const _maximumDrawerSize = 100;

let setting_ColumnCount = new ImageDrawerConfigSetting("ImageSize", 4);
let setting_DrawerHeight = new ImageDrawerConfigSetting("DrawerHeight", 25);
let setting_DrawerWidth = new ImageDrawerConfigSetting("DrawerWidth", 25);

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

export function setContextToolbarWidget(widget) {
	ImageDrawerContextToolbar.replaceChildren(widget);
}

export function setSortingOptions(options) {
	ImageDrawerContextToolbar.replaceChildren(widget);
}

const createDrawerOptionsFlyout = () => {

	let widthSliderOptions = new options_LabeledSliderRange();
	widthSliderOptions.bPrependValueLabel = true;
	widthSliderOptions.min = _minimumDrawerSize;
	widthSliderOptions.max = _maximumDrawerSize;
	widthSliderOptions.value = getDrawerWidth();
	widthSliderOptions.oninput = (e) => {
		setDrawerWidth(e.target.valueAsNumber, false);
	};
	drawerWidthSlider = createLabeledSliderRange(widthSliderOptions);
	setDrawerWidth(getDrawerWidth());

	let heightSliderOptions = new options_LabeledSliderRange();
	heightSliderOptions.bPrependValueLabel = true;
	heightSliderOptions.min = _minimumDrawerSize;
	heightSliderOptions.max = _maximumDrawerSize;
	heightSliderOptions.value = getDrawerHeight();
	heightSliderOptions.oninput = (e) => {
		setDrawerHeight(e.target.valueAsNumber, false);
	};
	drawerHeightSlider = createLabeledSliderRange(heightSliderOptions);
	setDrawerHeight(getDrawerHeight());

	let columnSliderOptions = new options_LabeledSliderRange();
	columnSliderOptions.bPrependValueLabel = true;
	columnSliderOptions.min = 1;
	columnSliderOptions.max = 10;
	columnSliderOptions.value = getColumnCount();
	columnSliderOptions.oninput = (e) => {
		setColumnCount(e.target.valueAsNumber, false);
	};
	columnSlider = createLabeledSliderRange(columnSliderOptions);
	setColumnCount(getColumnCount());

	let flyout = createFlyoutHandle("👁️");
	DrawerOptionsFlyout = flyout.handle;

	flyout.menu.appendChild(
		$el("tr.size-control.drawer-width-control", [
			$el('td', [$el("span", {
				textContent: 'Drawer Width',
			})]),
			$el('td', [drawerWidthSlider])
		]));
	flyout.menu.appendChild(
		$el("tr.size-control.drawer-height-control", [
			$el('td', [$el("span", {
				textContent: 'Drawer Height',
			})]),
			$el('td', [drawerHeightSlider])
		]));
	flyout.menu.appendChild(
		$el("tr.size-control.column-count-control", [
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
		]));
	flyout.menu.appendChild(
		// Anchor Select
		$el("tr.drawer-anchor-control", [
			$el('td', [$el("span", {
				textContent: "Image Drawer Anchor:",
			})]),
			$el('td', [createDrawerSelectionWidget((e) => { setDrawerAnchor(e.target.value); })])
		]));
};

app.registerExtension({
	name: "JNodes.ImageDrawer",
	async setup() {

		setupUiSettings((e) => { setDrawerAnchor(e.target.value); });

		// A button shown in the comfy modal to show the drawer after it's been hidden
		const showButton = $el("button.comfy-settings-btn", {
			textContent: "🖼️",
			style: {
				right: "16px",
				cursor: "pointer",
				display: setting_bMasterVisibility.value == true ? "none" : "unset",
			},
		});
		showButton.onclick = () => {
			imageDrawer.style.display = "block";
			showButton.style.display = "none";
			setting_bMasterVisibility.value = true;
		};
		document.querySelector(".comfy-settings-btn").after(showButton); // insert Show after Settings

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

		// Resizing / View options
		createDrawerOptionsFlyout();

		// Search bar
		const SearchBarClearButton = $el("button.JNodes-search-bar-clear-btn", {
			textContent: "❌",
			title: "Clear Search",
			onclick: clearAndExecuteSearch
		});

		async function onClickSearchRandomizeButton() {
			let loraDicts = await ExtraNetworks.getLoras();
			const loraKeys = Object.keys(loraDicts);
			const randomIndex = Math.floor(Math.random() * loraKeys.length);
			setSearchTextAndExecute(loraKeys[randomIndex]);
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
		imageDrawer.append(ImageDrawerMenu, getImageListElement());

		// If not supposed to be visible on startup, close it
		if (!setting_bMasterVisibility.value) {
			hideButton.onclick();
		}

	},
});