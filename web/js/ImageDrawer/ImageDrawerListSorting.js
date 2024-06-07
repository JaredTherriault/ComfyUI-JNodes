import { $el } from "/scripts/ui.js";

import * as SortTypes from "../common/SortTypes.js"

import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

class ImageDrawerListSorting extends ImageDrawerComponent {

	constructor(args) {

		super(args);
		this.SortingWidget;
		this.SortSelectionWidget;
		this.SortShuffleButton;
		this.SortTypes;

		this.lastShuffleInterval = 1000;
	}

initializeSortTypes() {
	this.SortTypes = {
		filenameAscending: new SortTypes.SortTypeFilename(true),
		filenameDescending: new SortTypes.SortTypeFilename(false),
		friendlyNameAscending: new SortTypes.SortTypeFriendlyName(true),
		friendlyNameDescending: new SortTypes.SortTypeFriendlyName(false),
		dateAscending: new SortTypes.SortTypeDate(true),
		dateDescending: new SortTypes.SortTypeDate(false),
		fileSizeAscending: new SortTypes.SortTypeFileSize(true),
		fileSizeDescending: new SortTypes.SortTypeFileSize(false),
		imageWidthAscending: new SortTypes.SortTypeImageWidth(true),
		imageWidthDescending: new SortTypes.SortTypeImageWidth(false),
		imageHeightAscending: new SortTypes.SortTypeImageHeight(true),
		imageHeightDescending: new SortTypes.SortTypeImageHeight(false),
		imageAspectRatioAscending: new SortTypes.SortTypeImageAspectRatio(true),
		imageAspectRatioDescending: new SortTypes.SortTypeImageAspectRatio(false),
		fileTypeAscending: new SortTypes.SortTypeFileType(true),
		fileTypeDescending: new SortTypes.SortTypeFileType(false),
		shuffle: new SortTypes.SortTypeShuffle(),
	}
}

getSortTypes() {
	return this.SortTypes;
}

getCurrentSortTypeName() {
	return this.SortSelectionWidget.value;
}

getCurrentSortTypeObject() {
	return this.getSortTypeObjectFromName(this.getCurrentSortTypeName());
}

sortWithCurrentType() {
	this.getCurrentSortTypeObject()?.sortImageList();
}

getSortTypeObjectFromName(sortName, bIsAscending = undefined) {
	const sortValues = Object.values(this.SortTypes);

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
		console.error(`SortType with name '${foundSortType}' not found.`);
		return null;
	}
}

getSortTypeObjectFromClassType(classType, bIsAscending = undefined) {
	const sortValues = Object.values(this.SortTypes);

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

	this.SortSelectionWidget.value = option;
	this.onOptionSelected(option);
}

setOptionSelectedFromSortType(type, bIsAscending) {

	const foundType = this.getSortTypeObjectFromClassType(type, bIsAscending);
	this.setOptionSelectedFromOptionName(foundType.name);
}

onOptionSelected(option) {

	const NewType = this.getSortTypeObjectFromName(option);
	NewType.sortImageList();

	if (NewType instanceof SortTypes.SortTypeShuffle) {

		this.SortShuffleButton.style.display = "unset";
	} else {

		this.SortShuffleButton.style.display = "none";
		this.stopAutomaticShuffle();
	}
}

_addSortingOption(optionName) {

	const option = document.createElement("option");
	option.value = optionName;
	option.textContent = optionName;

	// Find the correct position to insert the new option
	let index = 0;
	while (index < this.SortSelectionWidget.children.length && optionName.localeCompare(this.SortSelectionWidget.children[index].value) > 0) {
		index++;
	}

	// Insert the new option at the correct position
	this.SortSelectionWidget.insertBefore(option, this.SortSelectionWidget.children[index]);
}

_addUniqueSortingOption(optionName) {

	if (!Array.from(this.SortSelectionWidget.children).find(op => op.value === optionName)) {
		this._addSortingOption(optionName);
	}
}

setSortingOptionsFromSortTypeArray(inOptionArray) {

	this.SortSelectionWidget.replaceChildren();

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

	this.SortSelectionWidget.replaceChildren();

	for (const optionKey in inOptionArray) {
		this._addUniqueSortingOption(optionKey);
	}
}

_createSortShuffleButton() {

	this.SortShuffleButton = utilitiesInstance.createLongPressableButton(
		{
			textContent: "🔀",
			title: "Shuffle sorting again",
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

			const value = +prompt("Set automatic shuffle interval in milliseconds:", this.lastShuffleInterval);
			if (!isNaN(value)) {

				this.stopAutomaticShuffle(); // Stop existing auto mode

				this.lastShuffleInterval = value;

				this.SortShuffleButton.style.backgroundColor = "red";
				this.SortShuffleButton.timer = setInterval(() => {
					this.sortWithCurrentType();
				}, value);
			}
		},
		["JNodes-sort-shuffle-btn"]);

	return this.SortShuffleButton;
}

// If the Shuffle sort type is set to automatically work at an interval,
// stop it with this function. Returns true if it was in auto mode and was stopped.
stopAutomaticShuffle() {
	if (this.SortShuffleButton?.timer) {
		clearInterval(this.SortShuffleButton.timer);
		this.SortShuffleButton.timer = 0;
		this.SortShuffleButton.style.backgroundColor = "";

		return true;
	}

	return false;
}

makeSortingWidget() {

	this.SortSelectionWidget = $el("select", {
		style: {
			width: '100%',
		}
	});

	this.SortingWidget = $el("div", {
		style: {
			width: '100%',
			display: 'flex',
			flexDirection: 'row',
		}
	}, [
		this.SortSelectionWidget, this._createSortShuffleButton()
	]);

	// Add an event listener for the "change" event
	this.SortSelectionWidget.addEventListener("change", async () => {
		this.onOptionSelected(this.SortSelectionWidget.value);
	});

	this.initializeSortTypes();

	return this.SortingWidget;
}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerListSorting);