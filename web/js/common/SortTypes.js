
export class SortType {
	constructor(name, bIsAscending, imageDrawerInstance) {
		this.name = `${name}${bIsAscending == undefined ? "" : " " + (bIsAscending ? "⬆️" : "⬇️")}`;
		this.bIsAscending = bIsAscending;
		this.imageDrawerInstance = imageDrawerInstance;
	}

	sortImageList() {
		let imageListChildren = this.getSortableChildren();

		imageListChildren.sort(this.getSortingLambda());

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.replaceImageListChildren(imageListChildren);
	}

	getSortingLambda() { }

	getSortableChildren() {

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		let imageListChildren = imageDrawerListInstance.getImageListChildren();

		return Array.from(imageListChildren);
	}
}

export class SortTypeFilename extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Filename', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename);
	}
}

export class SortTypeFriendlyName extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Friendly Name', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.friendlyName.localeCompare(b.friendlyName) : b.friendlyName.localeCompare(a.friendlyName);
	}
}

export class SortTypePath extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Path', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.path.localeCompare(b.path) : b.path.localeCompare(a.path);
	}
}

export class SortTypeDate extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Date', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.file_age - b.file_age : b.file_age - a.file_age;
	}
}

export class SortTypeFileSize extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('File Size', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileSize - b.displayData.FileSize : b.displayData.FileSize - a.displayData.FileSize;
	}
}

export class SortTypeImageWidth extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Image Width', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileDimensions[0] - b.displayData.FileDimensions[0] : b.displayData.FileDimensions[0] - a.displayData.FileDimensions[0];
	}
}

export class SortTypeImageHeight extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Image Height', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.FileDimensions[1] - b.displayData.FileDimensions[1] : b.displayData.FileDimensions[1] - a.displayData.FileDimensions[1];
	}
}

export class SortTypeImageAspectRatio extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Image Aspect Ratio', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.displayData.AspectRatio - b.displayData.AspectRatio : b.displayData.AspectRatio - a.displayData.AspectRatio;
	}
}

export class SortTypeFileType extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('File Type', bIsAscending, imageDrawerInstance)
	}

	getSortingLambda() {
		return (a, b) => this.bIsAscending ? a.fileType.localeCompare(b.fileType) : b.fileType.localeCompare(a.fileType);
	}
}

export class SortTypeShuffle extends SortType {
	constructor(bIsAscending, imageDrawerInstance) {
		super('Shuffle', undefined, imageDrawerInstance)
	}

	getSortingLambda() {
		return () => Math.random() - 0.5;
	}
}