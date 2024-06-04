import { $el } from "/scripts/ui.js";

import { imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

let SortingWidget;
let SortSelectionWidget;
let SortRandomizeButton;
let SortTypes;

export function initializeSortTypes() {
	SortTypes = {
		filenameAscending: new SortTypeFilename(true),
		filenameDescending: new SortTypeFilename(false),
		friendlyNameAscending: new SortTypeFriendlyName(true),
		friendlyNameDescending: new SortTypeFriendlyName(false),
		dateAscending: new SortTypeDate(true),
		dateDescending: new SortTypeDate(false),
		fileSizeAscending: new SortTypeFileSize(true),
		fileSizeDescending: new SortTypeFileSize(false),
		imageWidthAscending: new SortTypeImageWidth(true),
		imageWidthDescending: new SortTypeImageWidth(false),
		imageHeightAscending: new SortTypeImageHeight(true),
		imageHeightDescending: new SortTypeImageHeight(false),
		imageAspectRatioAscending: new SortTypeImageAspectRatio(true),
		imageAspectRatioDescending: new SortTypeImageAspectRatio(false),
		fileTypeAscending: new SortTypeFileType(true),
		fileTypeDescending: new SortTypeFileType(false),
		randomize: new SortTypeRandomize(),
	}
}

export function getSortTypes() {
	return SortTypes;
}

export function getCurrentSortTypeName() {
	return SortSelectionWidget.value;
}

export function getCurrentSortTypeObject() {
	return getSortTypeObjectFromName(getCurrentSortTypeName());
}

export function sortWithCurrentType() {
	getCurrentSortTypeObject()?.sortImageList();
}

export function getSortTypeObjectFromName(sortName, bIsAscending = undefined) {
	const sortValues = Object.values(SortTypes);

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

export function getSortTypeObjectFromClassType(classType, bIsAscending = undefined) {
	const sortValues = Object.values(SortTypes);

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

export class SortType {
	constructor(name, bIsAscending) {
		this.name = `${name}${bIsAscending == undefined ? "" : " " + (bIsAscending ? "⬆️" : "⬇️")}`;
		this.bIsAscending = bIsAscending;
	}

	sortImageList() {
		let imageListChildren = this.getSortableChildren();

		imageListChildren.sort(this.getSortingLambda());

		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.replaceImageListChildren(imageListChildren);
	}

	getSortingLambda() { }

	getSortableChildren() {

		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
		let imageListChildren = imageDrawerListInstance.getImageListChildren();

		return Array.from(imageListChildren);
	}
}

export class SortTypeFilename extends SortType {
	constructor(bIsAscending) {
		super('Filename', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename);
	}
}

export class SortTypeFriendlyName extends SortType {
	constructor(bIsAscending) {
		super('Friendly Name', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.friendlyName.localeCompare(b.friendlyName) : b.friendlyName.localeCompare(a.friendlyName);
	}
}

export class SortTypeDate extends SortType {
	constructor(bIsAscending) {
		super('Date', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.file_age - b.file_age : b.file_age - a.file_age;
	}
}

export class SortTypeFileSize extends SortType {
	constructor(bIsAscending) {
		super('File Size', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileSize - b.displayData.FileSize : b.displayData.FileSize - a.displayData.FileSize;
	}
}

export class SortTypeImageWidth extends SortType {
	constructor(bIsAscending) {
		super('Image Width', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileDimensions[0] - b.displayData.FileDimensions[0] : b.displayData.FileDimensions[0] - a.displayData.FileDimensions[0];
	}
}

export class SortTypeImageHeight extends SortType {
	constructor(bIsAscending) {
		super('Image Height', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileDimensions[1] - b.displayData.FileDimensions[1] : b.displayData.FileDimensions[1] - a.displayData.FileDimensions[1];
	}
}

export class SortTypeImageAspectRatio extends SortType {
	constructor(bIsAscending) {
		super('Image Aspect Ratio', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.AspectRatio - b.displayData.AspectRatio : b.displayData.AspectRatio - a.displayData.AspectRatio;
	}
}

export class SortTypeFileType extends SortType {
	constructor(bIsAscending) {
		super('File Type', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.fileType.localeCompare(b.fileType) : b.fileType.localeCompare(a.fileType);
	}
}

export class SortTypeRandomize extends SortType {
	constructor() {
		super('Randomize', undefined)
	}

	getSortingLambda() {
		return () => Math.random() - 0.5;
	}
}

// Selector

export function setOptionSelectedFromOptionName(option) {
	
	SortSelectionWidget.value = option;
	onOptionSelected(option);
}

export function setOptionSelectedFromSortType(type, bIsAscending) {

	const foundType = getSortTypeObjectFromClassType(type, bIsAscending);
	setOptionSelectedFromOptionName(foundType.name);
}

export function onOptionSelected(option) {

	const NewType = getSortTypeObjectFromName(option);
	NewType.sortImageList();

	SortRandomizeButton.style.display = (NewType instanceof SortTypeRandomize) ? "unset" : "none";
}

function addSortingOption(optionName) {

	const option = document.createElement("option");
	option.value = optionName;
	option.textContent = optionName;
	SortSelectionWidget.appendChild(option);
}

function addUniqueSortingOption(optionName) {

	if (!Array.from(SortSelectionWidget.children).find(op => op.value === optionName)) {
		addSortingOption(optionName);
	}
}

export function setSortingOptionsFromSortTypeArray(inOptionArray) {

	SortSelectionWidget.replaceChildren();

	for (const sortType of inOptionArray) {

		for (let bool = 1; bool > -1; bool--) { // Ascending and descending

			const sortObject = getSortTypeObjectFromClassType(sortType, bool);
			if (sortObject) {
				addUniqueSortingOption(sortObject.name);
			}
		}
	}
}

export function setSortingOptionsFromStringArray(inOptionArray) {

	SortSelectionWidget.replaceChildren();

	for (const optionKey in inOptionArray) {
		addUniqueSortingOption(optionKey);
	}
}

function createSortRandomizeButton() {

	SortRandomizeButton = $el("button.JNodes-sort-randomize-btn", {
		textContent: "🎲",
		title: "Randomize sorting again",
		style: {
			display: "none"
		},
		onclick: async () => { sortWithCurrentType(); }
	});

	return SortRandomizeButton;
}

export function makeSortingWidget() {

	SortSelectionWidget = $el("select", {
		style: {
			width: '100%',
		}
	});

	SortingWidget = $el("div", {
		style: {
			width: '100%',
			display: 'flex',
			flexDirection: 'row',
		}
	}, [
		SortSelectionWidget, createSortRandomizeButton()
	]);

	// Add an event listener for the "change" event
	SortSelectionWidget.addEventListener("change", async function () {
		onOptionSelected(SortSelectionWidget.value);
	});

	initializeSortTypes();

	return SortingWidget;
}
