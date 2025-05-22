import { $el } from "/scripts/ui.js";

import * as SortTypes from "../common/SortTypes.js"

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

class ImageDrawerListSorting extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.sortingWidget;
		this.sortSelectionWidget;
		this.sortShuffleButton;
		this.sortTypes = {};

		this.lastShuffleInterval = 1000;


		this.baseShuffleButtonTooltipText = "Shuffle sorting again (long press to enable auto shuffle mode)";
		this.autoModehuffleButtonTooltipText = "Cancel auto shuffle mode";
	}

	initializeSortTypes() {
		this.addSortType("filenameAscending", SortTypes.SortTypeFilename, true);
		this.addSortType("filenameDescending", SortTypes.SortTypeFilename, false);
		this.addSortType("pathAscending", SortTypes.SortTypePath, true);
		this.addSortType("pathDescending", SortTypes.SortTypePath, false);
		this.addSortType("friendlyNameAscending", SortTypes.SortTypeFriendlyName, true);
		this.addSortType("friendlyNameDescending", SortTypes.SortTypeFriendlyName, false);
		this.addSortType("dateAscending", SortTypes.SortTypeDate, true);
		this.addSortType("dateDescending", SortTypes.SortTypeDate, false);
		this.addSortType("fileSizeAscending", SortTypes.SortTypeFileSize, true);
		this.addSortType("fileSizeDescending", SortTypes.SortTypeFileSize, false);
		this.addSortType("imageWidthAscending", SortTypes.SortTypeImageWidth, true);
		this.addSortType("imageWidthDescending", SortTypes.SortTypeImageWidth, false);
		this.addSortType("imageHeightAscending", SortTypes.SortTypeImageHeight, true);
		this.addSortType("imageHeightDescending", SortTypes.SortTypeImageHeight, false);
		this.addSortType("imageAspectRatioAscending", SortTypes.SortTypeImageAspectRatio, true);
		this.addSortType("imageAspectRatioDescending", SortTypes.SortTypeImageAspectRatio, false);
		this.addSortType("fileTypeAscending", SortTypes.SortTypeFileType, true);
		this.addSortType("fileTypeDescending", SortTypes.SortTypeFileType, false);
		this.addSortType("shuffle", SortTypes.SortTypeShuffle);
	}

	addSortType(internalName, type, bIsAscending) {
		this.sortTypes[internalName] = new type(bIsAscending, this.imageDrawerInstance);
	}

	getSortTypes() {
		return this.sortTypes;
	}

	getCurrentSortTypeName() {
		if (this.sortSelectionWidget) {
			return this.sortSelectionWidget.value;
		} else {
			return "";
		}
	}

	getCurrentSortTypeObject() {
		return this.getSortTypeObjectFromName(this.getCurrentSortTypeName());
	}

	sortWithCurrentType() {
		this.getCurrentSortTypeObject()?.sortImageList();
	}

	getSortTypeObjectFromName(sortName, bIsAscending = undefined) {
		const sortValues = Object.values(this.sortTypes);

		let foundSortType;

		for (const value of sortValues) {
			// returns true if the name at least partially matched and bIsAscending is not specified, 
			// or is specified and matches the SortType instance
			if (value.name.includes(sortName) && (bIsAscending == undefined || value.bIsAscending == bIsAscending)) {
				foundSortType = value;
				break;
			}
		}

		if (foundSortType) {
			return foundSortType;
		} else {
			console.error(`SortType with name '${sortName}' not found.`);
			return null;
		}
	}

	getSortTypeObjectFromClassName(className, bIsAscending = undefined) {
		const sortValues = Object.values(this.sortTypes);

		let foundSortType;

		for (const value of sortValues) {
			// returns true if the name at least partially matched and bIsAscending is not specified, 
			// or is specified and matches the SortType instance
			const valueType = value.constructor.name;
			if (valueType == className && (value.bIsAscending == undefined || value.bIsAscending == bIsAscending)) {
				foundSortType = value;
				break;
			}
		}

		if (foundSortType) {
			return foundSortType;
		} else {
			console.error(`SortType with class name '${className}' not found.`);
			return null;
		}
	}

	getSortTypeObjectFromClassType(classType, bIsAscending = undefined) {
		const sortValues = Object.values(this.sortTypes);

		let foundSortType;

		for (const value of sortValues) {
			// returns true if the name at least partially matched and bIsAscending is not specified, 
			// or is specified and matches the SortType instance
			const valueType = value.constructor.name;
			if (valueType == classType.name && (value.bIsAscending == undefined || value.bIsAscending == bIsAscending)) {
				foundSortType = value;
				break;
			}
		}

		if (foundSortType) {
			return foundSortType;
		} else {
			console.error(`SortType with name '${classType.name}' not found.`);
			return null;
		}
	}

	// Selector

	setOptionSelectedFromOptionName(option) {

		this.sortSelectionWidget.value = option;
		this.onOptionSelected(option);
	}

	setOptionSelectedFromSortType(type, bIsAscending) {

		const foundType = this.getSortTypeObjectFromClassType(type, bIsAscending);
		this.setOptionSelectedFromOptionName(foundType.name);
	}

	onOptionSelected(option) {

		const newType = this.getSortTypeObjectFromName(option);
		newType.sortImageList();

		if (newType instanceof SortTypes.SortTypeShuffle) {

			this.sortShuffleButton.style.display = "unset";
		} else {

			this.sortShuffleButton.style.display = "none";
			this.stopAutomaticShuffle();
		}

		const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
		imageDrawerContextSelectorInstance.getCurrentContextObject().setLastSelectedSorting(newType);
	}

	_addSortingOption(optionName) {

		const option = document.createElement("option");
		option.value = optionName;
		option.textContent = optionName;

		// Find the correct position to insert the new option
		let index = 0;
		while (index < this.sortSelectionWidget.children.length && optionName.localeCompare(this.sortSelectionWidget.children[index].value) > 0) {
			index++;
		}

		// Insert the new option at the correct position
		this.sortSelectionWidget.insertBefore(option, this.sortSelectionWidget.children[index]);
	}

	_addUniqueSortingOption(optionName) {

		if (!Array.from(this.sortSelectionWidget.children).find(op => op.value === optionName)) {
			this._addSortingOption(optionName);
		}
	}

	setSortingOptionsFromSortTypeArray(inOptionArray) {

		this.sortSelectionWidget.replaceChildren();

		for (const sortType of inOptionArray) {

			for (let bool = 1; bool > -1; bool--) { // Ascending and descending

				const sortObject = this.getSortTypeObjectFromClassType(sortType, bool);
				if (sortObject) {
					this._addUniqueSortingOption(sortObject.name);
				}
			}
		}
	}

	setSortingOptionsFromStringArray(inOptionArray) {

		this.sortSelectionWidget.replaceChildren();

		for (const optionKey in inOptionArray) {
			this._addUniqueSortingOption(optionKey);
		}
	}

	_createSortShuffleButton() {

		this.sortShuffleButton = utilitiesInstance.createLongPressableButton(
			{
				textContent: "🔀",
				title: this.baseShuffleButtonTooltipText,
				style: {
					display: "none"
				}
			},
			async () => { // Regular click

				if (!this.stopAutomaticShuffle()) {

					this.sortWithCurrentType();
				}
			},
			async () => { // Long press

				const value = Math.abs(+prompt("Set automatic shuffle interval in milliseconds:", this.lastShuffleInterval));
				if (!isNaN(value) && value > 1) {

					this.stopAutomaticShuffle(); // Stop existing auto mode

					this.lastShuffleInterval = value;

					this.sortShuffleButton.style.backgroundColor = "red";
					this.sortShuffleButton.title = `${this.autoModehuffleButtonTooltipText} (currently ${value} ms)`;
					this.sortShuffleButton.timer = setInterval(() => {
						this.sortWithCurrentType();
					}, value);
				}
			},
			["JNodes-sort-shuffle-btn"]);

		return this.sortShuffleButton;
	}

	// If the Shuffle sort type is set to automatically work at an interval,
	// stop it with this function. Returns true if it was in auto mode and was stopped.
	stopAutomaticShuffle() {

		if (this.sortShuffleButton?.timer) {
			clearInterval(this.sortShuffleButton.timer);
			this.sortShuffleButton.timer = 0;
			this.sortShuffleButton.style.backgroundColor = "";
			this.sortShuffleButton.title = this.baseShuffleButtonTooltipText;

			return true;
		}

		return false;
	}

	makeSortingWidget() {

		this.sortSelectionWidget = $el("select", {
			style: {
				width: '100%',
			}
		});

		this.sortingWidget = $el("div", {
			style: {
				width: '100%',
				display: 'flex',
				flexDirection: 'row',
			}
		}, [
			this.sortSelectionWidget, this._createSortShuffleButton()
		]);

		// Add an event listener for the "change" event
		this.sortSelectionWidget.addEventListener("change", async () => {
			this.onOptionSelected(this.sortSelectionWidget.value);
		});

		this.initializeSortTypes();

		return this.sortingWidget;
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerListSorting);