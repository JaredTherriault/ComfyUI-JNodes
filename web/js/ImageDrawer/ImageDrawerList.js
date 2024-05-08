import { $el } from "/scripts/ui.js";

import { observeVisualElement, unobserveVisualElement } from "../common/ImageAndVideoObserver.js";
import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory, imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";

class ImageDrawerList extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.onStartChangingImageListMulticastFunctions = [];
		this.onFinishChangingImageListMulticastFunctions = [];
		this.imageList = $el("div.JNodes-image-drawer-list", {
			style: {
				visibility: 'visible',
				flex: "1 1 auto"
			}
		});
	}

	// Delegates
    registerStartChangingImageListMulticastFunction(inFunction) {
        if (typeof inFunction == "function") {
            this.onStartChangingImageListMulticastFunctions.push(inFunction);
        }
    }

    registerFinishChangingImageListMulticastFunction(inFunction) {
        if (typeof inFunction == "function") {
            this.onFinishChangingImageListMulticastFunctions.push(inFunction);
        }
    }

	// To be called externally when a context or another component begins adding a batch of elements to the imageList
	notifyStartChangingImageList() {
		// Filter out invalid delegates
        this.onStartChangingImageListMulticastFunctions = this.onStartChangingImageListMulticastFunctions.filter(func => func !== null && func !== undefined);

        for (const func of this.onStartChangingImageListMulticastFunctions) {
            func();
        }
	}

	// To be called externally when a context or another component finishes adding a batch of elements to the imageList
	notifyFinishChangingImageList() {
		// Filter out invalid delegates
        this.onFinishChangingImageListMulticastFunctions = this.onFinishChangingImageListMulticastFunctions.filter(func => func !== null && func !== undefined);

        for (const func of this.onFinishChangingImageListMulticastFunctions) {
            func();
        }
	}

	getImageListElement() {
		return this.imageList;
	}

	// Returns all child nodes of any kind
	getImageListChildren() {
		return this.imageList.childNodes;
	}

	async replaceImageListChildren(newChildren) {

		this.notifyStartChangingImageList();
		this.clearImageListChildren();
		for (let child of newChildren) {
			this.addElementToImageList(child, false);
		}
		this.notifyFinishChangingImageList();

		const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");
		imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
	}

	clearImageListChildren() {

		this.notifyStartChangingImageList();
		let currentChildren = this.getImageListChildren();
		const childNodeCount = currentChildren.length;
		for (let childIndex = childNodeCount - 1; childIndex >= 0; childIndex--) {
			this.removeElementFromImageList(currentChildren[childIndex], false);
		}
		this.notifyFinishChangingImageList();
	};

	async removeElementFromImageList(element, bHandleSearch = true) {
		if (element != undefined) {
			//console.log("removing element: " + element);
			for (let visualElement of utilitiesInstance.getVisualElements(element)) {
				unobserveVisualElement(visualElement);

				if (visualElement.tagName === 'VIDEO') {
					// Try to pause the video before unloading
					try {
						visualElement.pause();
					} catch { }

					if ('src' in visualElement) {
						visualElement.removeAttribute('src'); // Unload video
						if (visualElement.load) { visualElement.load(); } // Release memory
					}
				}
			}
			this.imageList.removeChild(element);
			if (bHandleSearch) {
				const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
			}
		} else {
			console.log("Attempted to remove undefined element");
		}
	};

	async addElementToImageList(element, bHandleSearch = true) {
		//console.log("adding element: " + element);
		if (element != undefined) {
			this.imageList.appendChild(element);
			for (let visualElement of utilitiesInstance.getVisualElements(element)) {
				observeVisualElement(visualElement);
			}
			if (bHandleSearch) {
				const imageDrawerSearchInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
			}
		} else {
			console.log("Attempted to add undefined element");
		}
	};

	getImageListScrollLevel() {
		if (this.imageList) {
			return this.imageList.scrollTop;
		}
	}

	setImageListScrollLevel(newScrollPosition) {
		if (this.imageList) {
			this.imageList.scrollTop = newScrollPosition;
		}
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerList);
