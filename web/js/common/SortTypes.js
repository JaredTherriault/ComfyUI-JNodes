import { imageDrawerComponentManagerInstance } from "../ImageDrawer/Core/ImageDrawerModule.js";

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

export class SortTypeShuffle extends SortType {
	constructor() {
		super('Shuffle', undefined)
	}

	getSortingLambda() {
		return () => Math.random() - 0.5;
	}
}