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

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

import { utilitiesInstance } from "../common/Utilities.js";

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

class ImageDrawerMain extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.imageDrawer;
		this.drawerOptionsFlyout;
		this.imageDrawerContextToolbar;
		this.drawerWidthSlider;
		this.drawerHeightSlider;
		this.columnSlider;

		this._minimumDrawerSize = 15;
		this._maximumDrawerSize = 100;

		this.setting_ColumnCount = new ImageDrawerConfigSetting("ImageSize", 4);
		this.setting_DrawerHeight = new ImageDrawerConfigSetting("DrawerHeight", 25);
		this.setting_DrawerWidth = new ImageDrawerConfigSetting("DrawerWidth", 25);
	}

	getColumnCount() {
		return this.setting_ColumnCount.value;
	}

	setColumnCount(value, bSetColumnCountSliderValue = true) {
		this.setting_ColumnCount.value = value;
		this.imageDrawer?.style.setProperty("--column-count", value);
		this.columnSlider.title = `Controls the number of columns in the drawer (${value} columns).\nClick label to set custom value.`;
		if (bSetColumnCountSliderValue && this.columnSlider) {
			this.columnSlider.max = Math.max(10, value, this.columnSlider.max);
			this.columnSlider.value = value;
		}
	}

	getDrawerWidth() {
		return this.setting_DrawerWidth.value;
	}

	setDrawerWidth(value, bSetDrawerWidthSliderValue = true) {
		this.setting_DrawerWidth.value = value;
		this.imageDrawer?.style.setProperty("--drawer-width", value);
		this.drawerWidthSlider.title = `Controls the maximum width of the drawer panel (${value}vw)`;
		if (bSetDrawerWidthSliderValue && this.drawerWidthSlider) {
			this.drawerWidthSlider.value = value;
		}
	}

	getDrawerHeight() {
		return this.setting_DrawerHeight.value;
	}

	setDrawerHeight(value, bSetDrawerHeightSliderValue = true) {
		this.setting_DrawerHeight.value = value;
		this.imageDrawer?.style.setProperty("--drawer-height", value);
		this.drawerHeightSlider.title = `Controls the maximum height of the drawer panel (${value}vh)`;
		if (bSetDrawerHeightSliderValue && this.drawerHeightSlider) {
			this.drawerHeightSlider.value = value;
		}
	}

	setDrawerAnchor(value) {
		setting_DrawerAnchor.value = value;
		this.imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${value}`;
	}

	setContextToolbarWidget(widget) {
		this.imageDrawerContextToolbar.replaceChildren(widget);
	}

	setSortingOptions(options) {
		this.imageDrawerContextToolbar.replaceChildren(widget);
	}

	createDrawerOptionsFlyout() {

		let widthSliderOptions = new options_LabeledSliderRange();
		widthSliderOptions.bPrependValueLabel = true;
		widthSliderOptions.min = this._minimumDrawerSize;
		widthSliderOptions.max = this._maximumDrawerSize;
		widthSliderOptions.value = this.getDrawerWidth();
		widthSliderOptions.oninput = (e) => {
			this.setDrawerWidth(e.target.valueAsNumber, false);
		};
		this.drawerWidthSlider = createLabeledSliderRange(widthSliderOptions);
		this.setDrawerWidth(this.getDrawerWidth());

		let heightSliderOptions = new options_LabeledSliderRange();
		heightSliderOptions.bPrependValueLabel = true;
		heightSliderOptions.min = this._minimumDrawerSize;
		heightSliderOptions.max = this._maximumDrawerSize;
		heightSliderOptions.value = this.getDrawerHeight();
		heightSliderOptions.oninput = (e) => {
			this.setDrawerHeight(e.target.valueAsNumber, false);
		};
		this.drawerHeightSlider = createLabeledSliderRange(heightSliderOptions);
		this.setDrawerHeight(this.getDrawerHeight());

		let columnSliderOptions = new options_LabeledSliderRange();
		columnSliderOptions.bPrependValueLabel = true;
		columnSliderOptions.min = 1;
		columnSliderOptions.max = 10;
		columnSliderOptions.value = this.getColumnCount();
		columnSliderOptions.oninput = (e) => {
			this.setColumnCount(e.target.valueAsNumber, false);
		};
		this.columnSlider = createLabeledSliderRange(columnSliderOptions);
		this.setColumnCount(this.getColumnCount());

		let flyout = createFlyoutHandle("👁️");
		this.drawerOptionsFlyout = flyout.handle;

		flyout.menu.appendChild(
			$el("tr.size-control.drawer-width-control", [
				$el('td', [$el("span", {
					textContent: 'Drawer Width',
				})]),
				$el('td', [this.drawerWidthSlider])
			]));
		flyout.menu.appendChild(
			$el("tr.size-control.drawer-height-control", [
				$el('td', [$el("span", {
					textContent: 'Drawer Height',
				})]),
				$el('td', [this.drawerHeightSlider])
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
							this.setColumnCount(value);
						}
					},
				})]),
				$el('td', [this.columnSlider])
			]));
		flyout.menu.appendChild(
			// Anchor Select
			$el("tr.drawer-anchor-control", [
				$el('td', [$el("span", {
					textContent: "Image Drawer Anchor:",
				})]),
				$el('td', [createDrawerSelectionWidget((e) => { this.setDrawerAnchor(e.target.value); })])
			]));
	};

	async setup() {

		console.log(app.extensions);
		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");

		setupUiSettings((e) => { this.setDrawerAnchor(e.target.value); });

		if (!setting_bEnabled.value) {
			return;
		}

		// A button shown in the comfy modal to show the drawer after it's been hidden
		const showButton = $el("button.comfy-settings-btn", {
			textContent: "🖼️",
			style: {
				right: "16px",
				cursor: "pointer",
			},
		});
		utilitiesInstance.setElementVisible(showButton, !setting_bMasterVisibility.value);
		showButton.addEventListener("click", () => {
			utilitiesInstance.setElementVisible(this.imageDrawer, true, "flex");
			utilitiesInstance.setElementVisible(showButton, false);
			setting_bMasterVisibility.value = true;
		});
		document.querySelector(".comfy-settings-btn").after(showButton); // insert Show after Settings

		// Remove the drawer widget from view, can be re-opened with showButton
		const hideButton = $el("button.JNodes-image-drawer-btn.hide-btn", {
			textContent: "❌",
			onclick: () => {
				utilitiesInstance.setElementVisible(this.imageDrawer, false);
				utilitiesInstance.setElementVisible(showButton, true);
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
		this.imageDrawer = $el("div.JNodes-image-drawer", {
			parent: document.body
		});

		// Initialize Anchor
		const drawerStartingAnchor = setting_DrawerAnchor.value;
		this.imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${drawerStartingAnchor}`;

		// Resizing / View options
		this.createDrawerOptionsFlyout();

		const LeftAffinedControlsGroup = $el("div.JNodes-image-drawer-left-affined-basic-controls-group", {
			style: {
				display: "flex",
				justifycontent: "flex-start",
			}
		}, [hideButton, this.drawerOptionsFlyout]);

		const CollapseExpandButton = $el("button.JNodes-image-drawer-menu-collapsible-area-toggle-button", {
			title: "Toggle the visibility of the controls below",
			textContent: "v",
			style: {
				background: "none",
				border: "none",
				padding: "0px 6px",
				color: "white",
				fontWeight: "bolder",
				cursor: 'pointer',
			}
		});
		CollapseExpandButton.classList.add("JNodes-interactive-container");

		// Add click event listener to toggle button
		CollapseExpandButton.addEventListener('click', function () {
			const bIsCurrentlyCollapsed = CollapseExpandButton.textContent === ">";

			// Toggle content display
			CollapsibleArea.style.visibility =
				bIsCurrentlyCollapsed ? 'visible' : 'collapse';

			// Toggle button arrow orientation
			CollapseExpandButton.textContent = bIsCurrentlyCollapsed ? "v" : ">";
		});

		const batchDeletionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchDeletionManager", this.drawerInstanceIndex);
		const batchDeletionManagerWidget = batchDeletionManagerInstance.makeWidget()
		const batchRemovalManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchRemovalManager", this.drawerInstanceIndex);
		const batchRemovalManagerWidget = batchRemovalManagerInstance.makeWidget()
		const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager", this.drawerInstanceIndex);
		const batchSelectionManagerWidget = batchSelectionManagerInstance.makeWidget()
		const RightAffinedControlsGroup = $el("div.JNodes-image-drawer-right-affined-basic-controls-group", {
			style: {
				display: "flex",
				justifycontent: "flex-end",
			}
		}, [batchDeletionManagerWidget.container, batchRemovalManagerWidget.container, batchSelectionManagerWidget.container, CollapseExpandButton]);

		const BasicControlsGroup =
			$el("div.JNodes-image-drawer-basic-controls-group", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}
			}, [LeftAffinedControlsGroup, RightAffinedControlsGroup]);

		this.drawerOptionsFlyout.determineTransformLayout(); // Call immediately after parenting to avoid first caling being from the center

		this.imageDrawerContextToolbar =
			$el("div.JNodes-image-drawer-context-toolbar");

		function makeDropDownComboContainer() {
			// Context and sorting Dropdowns
			const sorting = Sorting.makeSortingWidget(); // Sorting first since contexts act upon sorting
			sorting.style.width = '50%';
			const context = ContextSelector.createContextSelector();
			context.style.width = '50%';

			const DropDownComboContainer = $el("div.JNodes-context-sorting-menu", {
				style: {
					display: "flex",
					flexDirection: "row"
				}
			}, [context, sorting]);

			return DropDownComboContainer;
		}

		const SearchBarGroup =
			$el("div.JNodes-search-bar-group", {
				style: {
					width: '100%',
					display: 'flex',
					flexDirection: 'row',
				}
			}, [
				imageDrawerSearchInstance.createSearchBar(), imageDrawerSearchInstance.createSearchBarClearButton(), imageDrawerSearchInstance.createSearchRandomizeButton()
			]);

		const CollapsibleArea = $el("div.JNodes-image-drawer-menu-collapsible-area", {
			style: {
				transformOrigin: "50% 0%",
				flex: "0 1 auto"
			}
		}, [
			makeDropDownComboContainer(),
			SearchBarGroup,
			this.imageDrawerContextToolbar,
		]);

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
				CollapsibleArea
			]);
		this.imageDrawer.append(ImageDrawerMenu, imageDrawerListInstance.getImageListElement());

		// If not supposed to be visible on startup, close it
		if (!setting_bMasterVisibility.value) {
			hideButton.onclick();
		}

	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerMain);