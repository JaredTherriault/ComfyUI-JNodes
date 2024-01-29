import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";

import * as ExtraNetworks from "./ExtraNetworks.js";
import * as ContextSelector from "./ContextSelector.js";
import * as Sorting from "./Sorting.js";

import { getValue, setValue, addJNodesSetting, setElementVisibility } from "../common/utils.js"

// Attribution: pythongsssss's Image Feed. So much brilliance in that original script.

//Singletons

let imageDrawer;
let imageList;
let DrawerOptionsFlyout;
let drawerSizeSlider;
let SearchBar;
let ImageDrawerContextToolbar;
let columnInput;

const _minimumDrawerSize = 4;
const _maximumDrawerSize = 100;

// UI Settings
export const defaultKeyList = "prompt, workflow";

// localStorage accessors
export const getVal = (n, d) => {
	return getValue("ImageDrawer." + n, d);
};

export const saveVal = (n, v) => {
	setValue("ImageDrawer." + n, v);
};

// Helpers

// Returns all child nodes of any kind
export function getImageListChildren() {
	return imageList.childNodes;
}

export function replaceImageListChildren(newChildren) {
	imageList.replaceChildren(...newChildren); // Spread the array because replaceChildren expects individual entries, not a single array
}

// Specifically returns nodes with an image
export function getImagesInList() {
	const imgs =
		[...imageList?.querySelectorAll("img")].map((img) => img.getAttribute("src"));
	return imgs;
};

export function clearImageListChildren() {
	imageList.replaceChildren();
};

export async function addElementToImageList(element) {
	//console.log("adding element: " + element);
	if (element != undefined) {
		imageList.appendChild(element);
		handleSearch();
	}
	else {
		console.log("Attempted to add undefined element");
	}
};

export function getColumnCount() {
	return getVal("ImageSize", 4);
}

export function setColumnCount(value) {
	columnInput.parentElement.title = `Controls the number of columns in the drawer (${value} columns).\nClick label to set custom value.`;
	imageDrawer.style.setProperty("--img-sz", value);
	saveVal("ImageSize", value);
	columnInput.max = Math.max(10, value, columnInput.max);
	columnInput.value = value;
}

export function getDrawerSize() {
	return getVal("DrawerSize", 25);
}

export function setDrawerSize(value, setDrawerSizeSliderValue = false) {
	saveVal("DrawerSize", value);
	imageDrawer?.style.setProperty("--max-size", value);
	if (setDrawerSizeSliderValue && drawerSizeSlider) {
		drawerSizeSlider.value = value;
	}
}

function createSearchBar() {
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
				el.value = getDrawerSize();
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
				$el("section.size-control.column-count-control", [
					$el("a", {
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
					}),
					$el("input", {
						type: "range",
						min: 1,
						max: 10,
						step: 1,
						oninput: (e) => {
							setColumnCount(e.target.value);
						},
						$: (el) => {
							columnInput = el;
							requestAnimationFrame(() => {
								setColumnCount(getColumnCount());
							});
						},
					}),
				]),
				// Location Select
				$el("section.drawer-location-control", [
					$el("label", {
						textContent: "Image Drawer Location:",
					}),
					$el(
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
					)
				]),
			])
		]);
};

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
			$el("div.JNodes-image-drawer-basic-controls-group", {
				style: {
					alignItems: 'left',
					display: 'flex',
					gap: '.5rem',
					flex: '0 1 fit-content',
					justifyContent: 'flex-start',
				}
			}, [hideButton, DrawerOptionsFlyout]);

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
			}, [ context, sorting ]);
			
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
		if (!getVal("bMasterVisibility", true)) {
			hideButton.onclick();
		}

	},
});