import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import {
	ImageDrawerConfigSetting, setupUiSettings, createDrawerSelectionWidget,
	setting_bEnabled, setting_bMasterVisibility, setting_DrawerAnchor,
	createFlyoutHandle, createLabeledSliderRange, options_LabeledSliderRange,
	setting_bQueueTimerEnabled
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
		value = utilitiesInstance.clamp(value, 1, value);
		this.setting_ColumnCount.value = value;
		this.imageDrawer?.style.setProperty("--column-count", value);
		this.columnSlider.title = `Controls the number of columns in the drawer (${value} columns).\nClick label to set custom value.`;
		if (bSetColumnCountSliderValue && this.columnSlider) {

			this.columnSlider.setValueDirectly(value, false); // Don't clamp to "max"
		}
	}

	getDrawerWidth() {
		return this.setting_DrawerWidth.value;
	}

	setDrawerWidth(value, bSetDrawerWidthSliderValue = true) {
		value = utilitiesInstance.clamp(value, this._minimumDrawerSize, this._maximumDrawerSize);
		this.setting_DrawerWidth.value = value;
		this.imageDrawer?.style.setProperty("--drawer-width", value);
		this.drawerWidthSlider.title = `Controls the maximum width of the drawer panel (${value}vw)`;
		if (bSetDrawerWidthSliderValue && this.drawerWidthSlider) {

			this.drawerWidthSlider.setValueDirectly(value);
		}
	}

	getDrawerHeight() {
		return this.setting_DrawerHeight.value;
	}

	setDrawerHeight(value, bSetDrawerHeightSliderValue = true) {
		value = utilitiesInstance.clamp(value, this._minimumDrawerSize, this._maximumDrawerSize);
		this.setting_DrawerHeight.value = value;
		this.imageDrawer?.style.setProperty("--drawer-height", value);
		this.drawerHeightSlider.title = `Controls the maximum height of the drawer panel (${value}vh)`;
		if (bSetDrawerHeightSliderValue && this.drawerHeightSlider) {

			this.drawerHeightSlider.setValueDirectly(value);
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
			$el("tr.drawer-size-control.drawer-width-control", [
				$el('td', [$el("a", {
					textContent: 'Drawer Width',
					style: {
						cursor: "pointer",
						textDecoration: "underline",
					},
					onclick: () => {
						const value = +prompt("Enter custom drawer width", this.getDrawerWidth());
						if (!isNaN(value)) {
							this.setDrawerWidth(value);
						}
					},
				})]),
				$el('td', [this.drawerWidthSlider])
			]));
		flyout.menu.appendChild(
			$el("tr.drawer-size-control.drawer-height-control", [
				$el('td', [$el("a", {
					textContent: 'Drawer Height',
					style: {
						cursor: "pointer",
						textDecoration: "underline",
					},
					onclick: () => {
						const value = +prompt("Enter custom drawer height", this.getDrawerHeight());
						if (!isNaN(value)) {
							this.setDrawerHeight(value);
						}
					},
				})]),
				$el('td', [this.drawerHeightSlider])
			]));
		flyout.menu.appendChild(
			$el("tr.drawer-size-control.column-count-control", [
				$el('td', [$el("a", {
					textContent: "Column count",
					style: {
						cursor: "pointer",
						textDecoration: "underline",
					},
					onclick: () => {
						const value = +prompt("Enter custom column count", this.getColumnCount());
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

		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");

		setupUiSettings((e) => { this.setDrawerAnchor(e.target.value); });

		if (!setting_bEnabled.value) {
			return;
		}

		// A button shown in the comfy modal to show the drawer after it's been hidden
		const showButton = $el("button.comfyui-button.comfy-settings-btn", {
			textContent: "🖼️",
			title: "Display JNodes Image Drawer"
		});
		const showButtonClickListener = () => {
			utilitiesInstance.setElementVisible(this.imageDrawer, true, "flex");
			utilitiesInstance.setElementVisible(showButton, false);
			utilitiesInstance.setElementVisible(showButtonClone, false);
			setting_bMasterVisibility.value = true;
		};
		utilitiesInstance.setElementVisible(showButton, !setting_bMasterVisibility.value);
		showButton.addEventListener("click", showButtonClickListener);

		const showButtonClone = showButton.cloneNode(true);
		utilitiesInstance.setElementVisible(showButtonClone, !setting_bMasterVisibility.value);
		showButtonClone.addEventListener("click", showButtonClickListener);

		try {
			app.menu?.settingsGroup.element.after(showButton); // insert Show after comfy buttons menu
		} catch {
			console.warn("Could not add showButton to app.menu.settingsGroup.element")
		}

		try {
			document.querySelector(".comfy-settings-btn").after(showButtonClone); // insert Show after Settings
		} catch {
			console.warn("Could not add showButton beside comfy-settings-btn")
		}

		// A button to queue at a set interval with the current workflow
		if (setting_bQueueTimerEnabled.value)
		{
			const baseAutoQueueIntervalButtonTooltipText = "Auto Queue Interval";
			function startAutomaticQueue(intervalInMs) {
				if (!isNaN(intervalInMs) && intervalInMs > 1) {

					stopAutomaticQueue; // Stop existing auto mode

					timerQueueButton.lastAutoQueueInterval = intervalInMs;

					timerQueueButton.style.backgroundColor = "red";
					timerQueueButton.title = `${baseAutoQueueIntervalButtonTooltipText} (currently ${intervalInMs} ms)`;
					timerQueueButton.timer = setInterval(() => {
						app.queuePrompt(0, 1);
					}, intervalInMs);
				}
			}

			function stopAutomaticQueue() {

				if (timerQueueButton?.timer) {
					clearInterval(timerQueueButton.timer);
					timerQueueButton.timer = 0;
					timerQueueButton.style.backgroundColor = "";
					timerQueueButton.title = baseAutoQueueIntervalButtonTooltipText;

					return true;
				}

				return false;
			}

			const timerQueueButton = utilitiesInstance.createLongPressableButton(
				{
					textContent: "⏲️",
					title: baseAutoQueueIntervalButtonTooltipText
				},
				async () => { // Regular click

					if (!stopAutomaticQueue()) {

						startAutomaticQueue(timerQueueButton.lastAutoQueueInterval);
					}
				},
				async () => { // Long press

					const value = Math.abs(+prompt("Set automatic queue interval in milliseconds:", timerQueueButton.lastAutoQueueInterval));
					startAutomaticQueue(value);
				},
				["JNodes-auto-queue-interval-btn"]);

			timerQueueButton.lastAutoQueueInterval = 60000;

			document.querySelector(".comfy-queue-btn").after(timerQueueButton); // insert Show after Settings
		}

		// Remove the drawer widget from view, can be re-opened with showButton
		const hideButton = $el("button.JNodes-image-drawer-btn.hide-btn", {
			textContent: "❌",
			title: "Hide the drawer. Show it again by clicking the image icon on the Comfy menu.",
			onclick: () => {

				const imageDrawerListSortingInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerListSorting");
				imageDrawerListSortingInstance.stopAutomaticShuffle();

				utilitiesInstance.setElementVisible(this.imageDrawer, false);
				utilitiesInstance.setElementVisible(showButton, true);
				utilitiesInstance.setElementVisible(showButtonClone, true);
				setting_bMasterVisibility.value = false;
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		// The main drawer widget
		const drawerParent = document.querySelector(".comfyui-body-bottom") || document.body;
		this.imageDrawer = $el("div.JNodes-image-drawer", {
			parent: drawerParent
		});

		// Initialize Anchor
		const drawerStartingAnchor = setting_DrawerAnchor.value;
		this.imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${drawerStartingAnchor}`;

		// Resizing / View options
		this.createDrawerOptionsFlyout();

		const syncButton = $el("button.JNodes-image-drawer-btn.sync-videos-btn", {
			textContent: "🔄",
			title: "Sync playback for all currently loaded videos",
			onclick: () => {
				for (const video of document.querySelectorAll("video")) {
					if (video.readyState > 0) {
						video.currentTime = 0;
					}
				}
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		const LeftAffinedControlsGroup = $el("div.JNodes-image-drawer-left-affined-basic-controls-group", {
			style: {
				display: "flex",
				justifycontent: "flex-start",
			}
		}, [hideButton, this.drawerOptionsFlyout, syncButton]);

		const CollapseExpandButton = $el("button.JNodes-image-drawer-menu-collapsible-area-toggle-button", {
			title: "Toggle the visibility of the controls below",
			textContent: "▼",
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
			const bIsCurrentlyCollapsed = CollapsibleArea.style.display === "none";

			// Toggle content display
			CollapsibleArea.style.display =
				bIsCurrentlyCollapsed ? 'block' : 'none';

			// Toggle button arrow orientation
			CollapseExpandButton.textContent = bIsCurrentlyCollapsed ? "▼" : "▶";
		});

		const batchFavouriteManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchFavouriteManager", this.drawerInstanceIndex);
		const batchFavouriteManagerWidget = batchFavouriteManagerInstance.makeWidget();
		const batchDeletionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchDeletionManager", this.drawerInstanceIndex);
		const batchDeletionManagerWidget = batchDeletionManagerInstance.makeWidget();
		const batchRemovalManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchRemovalManager", this.drawerInstanceIndex);
		const batchRemovalManagerWidget = batchRemovalManagerInstance.makeWidget();
		const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager", this.drawerInstanceIndex);
		const batchSelectionManagerWidget = batchSelectionManagerInstance.makeWidget();
		const RightAffinedControlsGroup = $el("div.JNodes-image-drawer-right-affined-basic-controls-group", {
			style: {
				display: "flex",
				justifycontent: "flex-end",
			}
		}, [batchFavouriteManagerWidget.container, batchDeletionManagerWidget.container, batchRemovalManagerWidget.container, batchSelectionManagerWidget.container, 
			CollapseExpandButton]);

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
			const imageDrawerListSortingInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerListSorting");
			const sortingWidget = imageDrawerListSortingInstance.makeSortingWidget(); // Sorting first since contexts act upon sorting
			sortingWidget.style.width = '50%';

			const imageDrawerContextSelectorInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerContextSelector");
			const contextSelector = imageDrawerContextSelectorInstance.createContextSelector();
			contextSelector.style.width = '50%';

			const DropDownComboContainer = $el("div.JNodes-context-sorting-menu", {
				style: {
					display: "flex",
					flexDirection: "row"
				}
			}, [contextSelector, sortingWidget]);

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
				imageDrawerSearchInstance.createSearchBar()
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