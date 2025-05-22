import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import {
	ImageDrawerConfigSetting, createDrawerSelectionWidget,
	setting_bEnabled, setting_DrawerAnchor,
	createFlyoutHandle, createLabeledSliderRange, options_LabeledSliderRange,
	setting_bQueueTimerEnabled, setting_SidebarSplitterHandleSize,
	setting_bRememberLastDrawerContext
} from "../common/SettingsManager.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

import { utilitiesInstance } from "../common/Utilities.js";
import { ContextFeed } from "./Contexts.js";

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

class ImageDrawerMain extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.imageDrawer;
		this.ImageDrawerMenu;
		this.drawerOptionsFlyout;
		this.imageDrawerContextToolbar;
		this.drawerWidthSlider;
		this.drawerHeightSlider;
		this.columnSlider;

		this.icon = "🗄️";

		this._bHasRenderedSidebarTabAtLeastOnce = false;

		this._minimumDrawerSize = 15;
		this._maximumDrawerSize = 100;

		this.setting_bIsDrawerVisible = new ImageDrawerConfigSetting(`ImageDrawer_Visibility_Instance_${this.imageDrawerInstance.getIndex()}`, true);
		this.setting_ColumnCount = new ImageDrawerConfigSetting(`ImageDrawer_ColumnCount_Instance_${this.imageDrawerInstance.getIndex()}`, 4);
		this.setting_DrawerHeight = new ImageDrawerConfigSetting(`ImageDrawer_Height_Instance_${this.imageDrawerInstance.getIndex()}`, 25);
		this.setting_DrawerWidth = new ImageDrawerConfigSetting(`ImageDrawer_Width_Instance_${this.imageDrawerInstance.getIndex()}`, 25);
		this.setting_DrawerAnchorLocal = new ImageDrawerConfigSetting(`ImageDrawer_Anchor_Instance_${this.imageDrawerInstance.getIndex()}`, setting_DrawerAnchor.value);
		this.setting_CollapsedControls = new ImageDrawerConfigSetting(`ImageDrawer_Collapsed_Instance_${this.imageDrawerInstance.getIndex()}`, false);

		const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
		imageDrawerContextSelectorInstance.createContextSelector();
		const feedName = imageDrawerContextSelectorInstance.contexts.feed.name;
		this.setting_LastSelectedContext = new ImageDrawerConfigSetting(`ImageDrawer_LastSelectedContext_Instance_${this.imageDrawerInstance.getIndex()}`, feedName);
	}

	destroy() {

		if (this.isSidebarTab()) {
			this.unregisterSidebarTab();
		}

		this.imageDrawer.parent = null;
		this.imageDrawer = null;
		this.ImageDrawerMenu = null;
		this.drawerOptionsFlyout = null;
		this.imageDrawerContextToolbar = null;
		this.drawerWidthSlider = null;
		this.drawerHeightSlider = null;
		this.columnSlider = null;

		this.icon = null;

		this.setting_ColumnCount = null;
		this.setting_DrawerHeight = null;
		this.setting_DrawerWidth = null;
		this.setting_DrawerAnchorLocal = null;
	}

	isSidebarTab() {

		return this.setting_DrawerAnchorLocal.value == "sidebar";
	}

	getColumnCount() {
		return this.setting_ColumnCount.value;
	}

	setColumnCount(value, bSetColumnCountSliderValue = true) {
		value = utilitiesInstance.clamp(value, 1, value);
		this.setting_ColumnCount.value = value;
		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.getImageListElement().style.setProperty("--column-count", value);
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
		const bWasSidebar = this.setting_DrawerAnchorLocal.value == "sidebar";
		this.setting_DrawerAnchorLocal.value = value;
		this.imageDrawer.className =
			`JNodes-image-drawer JNodes-image-drawer--${value}`;

		if (this.isSidebarTab() && !bWasSidebar) {
			this.registerAsSidebarTab();
		} else if (!this.isSidebarTab() && bWasSidebar) {
			this.unregisterSidebarTab();
			this.registerAsAnchored();
		}
	}

	setContextToolbarWidget(widget) {
		this.imageDrawerContextToolbar.replaceChildren(widget);
	}

	setSortingOptions(options) {
		this.imageDrawerContextToolbar.replaceChildren(widget);
	}

	createDrawerOptionsFlyout(parentRect = window) {

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

		let flyout = createFlyoutHandle("👁️", "image-drawer-options-handle", "image-drawer-options-menu");
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
		const anchorSelector = $el("tr.drawer-anchor-control", [
			$el('td', [$el("span", {
				textContent: "Image Drawer Anchor:",
			})]),
			$el('td', [createDrawerSelectionWidget(
				this.setting_DrawerAnchorLocal.value,
				(e) => { this.setDrawerAnchor(e.target.value); },
				(m) => { this.setting_DrawerAnchorLocal.value === m; }
			)]
			)
		]);
		flyout.menu.appendChild(anchorSelector);
	};

	isComfySidebarLeft() {

		const sidebar = document.querySelector(".side-tool-bar-container");
		if (sidebar) {
			const sidebarParent = sidebar.parentElement;

			if (sidebarParent) {
				return sidebarParent.classList.contains("comfyui-body-left");
			}
		}

		return false;
	}

	registerAsSidebarTab() {

		// Create sidebar icon
		this.iconOverride = document.createElement("style")
		this.iconOverride.innerHTML = `.ImageDrawerTabIcon_${this.imageDrawerInstance.getIndex()}:before 
			{content: '${this.icon}'; font-style: normal; filter: hue-rotate(${this.imageDrawerInstance.getIndex() * 60}deg);}`
		document.body.append(this.iconOverride)

		let sidebarTab = {
			id: `ImageDrawerSidebarTab_${this.imageDrawerInstance.getIndex()}`, title: `Image Drawer Sidebar Tab (${this.imageDrawerInstance.getIndex()})`, 
			tooltip: `Toggle Image Drawer (${this.imageDrawerInstance.getIndex()})`,
			icon: `ImageDrawerTabIcon_${this.imageDrawerInstance.getIndex()}`, type: "custom",
			render: (e) => {

				 // Remove all children
				while (e.firstChild) {
					e.removeChild(e.firstChild);
				}
				
				// And append the incoming one
				e.appendChild(
					$el("div", {
						id: `jnodes-sidebar-image-drawer-wrapper_${this.imageDrawerInstance.getIndex()}`,
						style: {
							height: "100%",
							width: "100%",
						}
					}, [
						this.imageDrawer
					])
				);

				// Perform some visual workarounds on next frame
				requestAnimationFrame(() => {

					// Restore last drawer width / splitter position and
					// cache splitter position so it can be restored on next session.
					// We're specifically not using '.p-splitter-gutter-handle' here because
					// the handle width is reset after dragging
					const splitterElement = document.querySelector(".p-splitter-gutter:not(.hidden)");
					if (splitterElement) {
						
						let savedWidthPercentage = this.setting_DrawerWidth.value / 100;
						if (!this.isComfySidebarLeft()) {
							savedWidthPercentage = 1.0 - savedWidthPercentage;
						}
						const endX = window.innerWidth * savedWidthPercentage;
						const rect = splitterElement.getBoundingClientRect();
						utilitiesInstance.simulateDrag(splitterElement, rect.x, rect.y, endX, rect.y);

						// Set handle width
						if (setting_SidebarSplitterHandleSize.value != 0) {

							splitterElement.style.width = `${setting_SidebarSplitterHandleSize.value}px`;
						}

						// Bind to pointerup for splitter so we can cache the width
						splitterElement.addEventListener("pointerup", (e) => {
							this.cacheDrawerWidthFromSplitterElement(splitterElement);
						});
					}

					// Ensure that custom tooltips and such are not constrained to the bounds of the drawer
					const panelElement = document.querySelector(".p-splitterpanel.side-bar-panel");
					if (panelElement) {
						panelElement.style.overflow = "visible";
					}
					const containerElement = document.querySelector(".sidebar-content-container");
					if (containerElement) {
						containerElement.style.overflow = "visible";
					}

					// Ensure that the image drawer list is contained within the height of the sidebar panel
					e.style.height = "100%";

					// Restore scroll level
					const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
					imageDrawerListInstance.scrollToLastScrollLevel();
					if (splitterElement) {
					}

					this._bHasRenderedSidebarTabAtLeastOnce = true;

				}, 1);

			}};
		app.extensionManager.registerSidebarTab(sidebarTab);
	}

	registerAsAnchored() {

		const drawerParent = document.querySelector(".comfyui-body-bottom") || document.body;
		drawerParent.appendChild(this.imageDrawer);
	}

	unregisterSidebarTab() {

		this.iconOverride.remove();
		this.iconOverride = null;
		app.extensionManager.unregisterSidebarTab(`ImageDrawerSidebarTab_${this.imageDrawerInstance.getIndex()}`);

		this._bHasRenderedSidebarTabAtLeastOnce = false;
	}

	cacheDrawerWidthFromSplitterElement(splitterElement) {

		let rect = splitterElement.getBoundingClientRect();
		let percentage = rect.x / window.innerWidth;

		if (!this.isComfySidebarLeft()) {

			percentage = 1.0 - percentage;
		}

		this.setDrawerWidth(percentage * 100);
	}

	cacheDrawerDimensions() {

		const rect = this.imageDrawer.getBoundingClientRect();

		const widthPercentage = rect.width / window.innerWidth;
		const heightPercentage = rect.height / window.innerHeight;

		this.setDrawerWidth(parseInt(widthPercentage * 100));
		this.setDrawerHeight(parseInt(heightPercentage * 100));
	}

	async setup() {

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");

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
			this.setting_bIsDrawerVisible.value = true;
		};
		utilitiesInstance.setElementVisible(showButton, !this.setting_bIsDrawerVisible.value);
		showButton.addEventListener("click", showButtonClickListener);

		try {
			app.menu?.settingsGroup.element.after(showButton); // insert Show after comfy buttons menu
		} catch {
			console.warn("Could not add showButton to app.menu.settingsGroup.element")
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

				const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
				imageDrawerListSortingInstance.stopAutomaticShuffle();

				utilitiesInstance.setElementVisible(this.imageDrawer, false);
				utilitiesInstance.setElementVisible(showButton, true);
				this.setting_bIsDrawerVisible.value = false;
			},
			style: {
				width: "fit-content",
				padding: '3px',
			},
		});

		// The main drawer widget
		this.imageDrawer = $el("div.JNodes-image-drawer");

		// Initialize Anchor
		const drawerStartingAnchor = this.setting_DrawerAnchorLocal.value;
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

		this.CollapseExpandButton = $el("button.JNodes-image-drawer-menu-collapsible-area-toggle-button", {
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
		this.CollapseExpandButton.classList.add("JNodes-interactive-container");

		// Add click event listener to toggle button
		const setCollapsedState = (bIsCollapsed) => {

			// Toggle content display
			CollapsibleArea.style.display = bIsCollapsed ? 'none' : 'block';

			// Toggle button arrow orientation
			this.CollapseExpandButton.textContent = bIsCollapsed ? "▶" : "▼";
		};
		this.CollapseExpandButton.addEventListener('click', () => {

			this.setting_CollapsedControls.value = !this.setting_CollapsedControls.value;

			setCollapsedState(this.setting_CollapsedControls.value);
		});

		const batchFavouriteManagerInstance = this.imageDrawerInstance.getComponentByName("BatchFavouriteManager");
		const batchFavouriteManagerWidget = batchFavouriteManagerInstance.makeWidget();
		const batchDeletionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchDeletionManager");
		const batchDeletionManagerWidget = batchDeletionManagerInstance.makeWidget();
		const batchRemovalManagerInstance = this.imageDrawerInstance.getComponentByName("BatchRemovalManager");
		const batchRemovalManagerWidget = batchRemovalManagerInstance.makeWidget();
		const batchSelectionManagerInstance = this.imageDrawerInstance.getComponentByName("BatchSelectionManager");
		const batchSelectionManagerWidget = batchSelectionManagerInstance.makeWidget();
		const RightAffinedControlsGroup = $el("div.JNodes-image-drawer-right-affined-basic-controls-group", {
			style: {
				display: "flex",
				justifycontent: "flex-end",
			}
		}, [batchFavouriteManagerWidget.container, batchDeletionManagerWidget.container, batchRemovalManagerWidget.container, batchSelectionManagerWidget.container, 
			this.CollapseExpandButton]);

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

		const makeDropDownComboContainer = () => {
			// Context and sorting Dropdowns
			const imageDrawerListSortingInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerListSorting");
			const sortingWidget = imageDrawerListSortingInstance.makeSortingWidget(); // Sorting first since contexts act upon sorting
			sortingWidget.style.width = '50%';

			const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
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

		this.ImageDrawerMenu =
			$el("div.JNodes-image-drawer-menu", {
				style: {
					minHeight: 'fit-content',
					minWidth: 'fit-content',
					position: 'relative',
					flex: '0 1 min-content',
					gap: '3px',
					padding: '3px',
					justifyContent: 'flex-start',
				},
			}, [
				BasicControlsGroup,
				CollapsibleArea
			]);
		this.imageDrawer.append(this.ImageDrawerMenu, imageDrawerListInstance.getImageListElement());

		if (this.isSidebarTab()) {
			this.registerAsSidebarTab();
		} else {
			this.registerAsAnchored();

			// If not supposed to be visible on startup, close it
			if (!this.isSidebarTab() && !this.setting_bIsDrawerVisible.value) {
				hideButton.onclick();
			}
		}

		// Restore last chosen context
		if (setting_bRememberLastDrawerContext.value) {
			const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
			await imageDrawerContextSelectorInstance.setOptionSelected(this.setting_LastSelectedContext.value);
		}

		// Restore control collapse state
		setCollapsedState(this.setting_CollapsedControls.value);
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerMain);