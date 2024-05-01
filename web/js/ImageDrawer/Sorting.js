import { $el } from "/scripts/ui.js";

import { getImageListChildren, replaceImageListChildren } from "./ImageListAndSearch.js";

let SortingWidget;
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
		fileTypeAscending: new SortTypeFileType(true),
		fileTypeDescending: new SortTypeFileType(false),
	}
}

export function getSortTypes() {
	return SortTypes;
}

export function getCurrentSortTypeName() {
	return SortingWidget.value;
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
		if (valueType == classType.name && (bIsAscending == undefined || value.bIsAscending == bIsAscending)) {
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

export class SortType {
	constructor(name, bIsAscending) {
		this.name = `${name} ${bIsAscending ? "⬆️" : "⬇️"}`;
		this.bIsAscending = bIsAscending;
	}

	sortImageList() {
		let imageListChildren = this.getSortableChildren();

		imageListChildren.sort(this.getSortingLambda());

		replaceImageListChildren(imageListChildren);
	}

	getSortingLambda() { }

	getSortableChildren() {
		let imageListChildren = getImageListChildren();

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
		return (a, b) => this.bIsAscending ? a.file_size - b.file_size : b.file_size - a.file_size;
	}
}

export class SortTypeImageWidth extends SortType {
	constructor(bIsAscending) {
		super('Image Width', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.fileWidth - b.fileWidth : b.fileWidth - a.fileWidth;
	}
}

export class SortTypeImageHeight extends SortType {
	constructor(bIsAscending) {
		super('Image Height', bIsAscending)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.fileHeight - b.fileHeight : b.fileHeight - a.fileHeight;
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

// Selector

export function setOptionSelectedFromOptionName(option) {
	SortingWidget.value = option;
	onOptionSelected(option);
}

export function setOptionSelectedFromSortType(type, bIsAscending) {
	const foundType = getSortTypeObjectFromClassType(type, bIsAscending);
	setOptionSelectedFromOptionName(foundType.name);
}

export function onOptionSelected(option) {
	const NewType = getSortTypeObjectFromName(option);
	NewType.sortImageList();
}

export function setSortingOptionsFromSortTypeArray(inOptionArray) {
	SortingWidget.replaceChildren();

	for (const sortType of inOptionArray) {
		for (let bool = 1; bool > -1; bool--) { // Ascending and descending
			const sortObject = getSortTypeObjectFromClassType(sortType, bool);
			if (sortObject) {
				const option = document.createElement("option");
				option.value = sortObject.name;
				option.textContent = sortObject.name;
				SortingWidget.appendChild(option);
			}
		}
	}
}

export function setSortingOptionsFromStringArray(inOptionArray) {
	SortingWidget.replaceChildren();

	for (const optionKey in inOptionArray) {
		const option = document.createElement("option");
		option.value = optionKey;
		option.textContent = optionKey;
		SortingWidget.appendChild(option);
	}
}

export function makeSortingWidget() {
	SortingWidget = $el("select");

	// Add an event listener for the "change" event
	SortingWidget.addEventListener("change", async function() {
		onOptionSelected(SortingWidget.value);
	});

	initializeSortTypes();

	return SortingWidget;
}
