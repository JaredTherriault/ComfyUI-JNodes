import { $el } from "/scripts/ui.js";

import { observeVisualElement, unobserveVisualElement } from "../common/ImageAndVideoObserver.js";
import { utilitiesInstance } from "../common/Utilities.js";

import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";

class ImageDrawerList extends ImageDrawerComponent {

	constructor(args) {

		super(args);

		this.onStartChangingImageListMulticastFunctions = [];
		this.onFinishChangingImageListMulticastFunctions = [];
		this.imageListContainer = $el("div.JNodes-image-drawer-list-container");
		this.imageList = $el("div.JNodes-image-drawer-list", {
			style: {
				visibility: 'visible',
				flex: "1 1 auto"
			}
		});

		this.imageListContainer.append(this.imageList);

		this._scrollLevel = 0;
		this.imageListContainer.addEventListener("scroll", (event) => {
			this._scrollLevel = event.target.scrollTop;
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

	scrollToLastScrollLevel() {
		this.imageListContainer.scrollTop = this._scrollLevel;
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

	getImageListContainerElement() {
		return this.imageListContainer;
	}

	getImageListElement() {
		return this.imageList;
	}

	// Returns all child nodes of any kind
	getImageListChildren() {
		return this.imageList.childNodes;
	}

	getChildIndex(child) {
		const children = Array.from(child.parentNode.childNodes); 
		return children.indexOf(child);
	}

	getVisibleImageListChildren() {
		let visibleChildren = [];
		for (const child of this.getImageListChildren()) {
			if (child.style.display != "none") {
				visibleChildren.push(child);
			}
		}

		return visibleChildren;
	}

	async replaceImageListChild(oldChild, newChild) {

		if (!oldChild || !newChild) {

			return;
		}

		const insertionIndex = this.getChildIndex(oldChild);

		if (insertionIndex > -1) {
			await this.removeElementFromImageList(oldChild, false);
			await this.addElementToImageList(newChild, false, insertionIndex);
		}
	}

	async replaceImageListChildren(newChildren) {

		this.notifyStartChangingImageList();
		this.clearImageListChildren();
		for (let child of newChildren) {
			this.addElementToImageList(child, false);
		}
		this.notifyFinishChangingImageList();

		const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
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
			if (element.onObserverIntersect) {
				unobserveVisualElement(element);
			} else {
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
			}
			this.imageList.removeChild(element);
			if (bHandleSearch) {
				const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
			}
		} else {
			console.log("Attempted to remove undefined element");
		}
	};

	async addElementToImageList(element, bHandleSearch = true, insertAt = -1) {
		//console.log("adding element: " + element);
		if (element != undefined) {
			if (insertAt > -1 && insertAt < this.imageList.childNodes.length) {
				const referenceNode = this.imageList.childNodes[insertAt];
            	this.imageList.insertBefore(element, referenceNode);
			} else {
				this.imageList.appendChild(element);
			}
			if (element.onObserverIntersect) {
				observeVisualElement(element);
			} else {
				for (let visualElement of utilitiesInstance.getVisualElements(element)) {
					observeVisualElement(visualElement);
				}
			}
			if (bHandleSearch) {
				const imageDrawerSearchInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.executeSearchWithEnteredSearchText();
			}
		} else {
			console.log("Attempted to add undefined element");
		}
	};

	getImageListScrollLevel() {
		if (this.imageListContainer) {
			return this.imageListContainer.scrollTop;
		}
	}

	setImageListScrollLevel(newScrollPosition) {
		if (this.imageListContainer) {
			this.imageListContainer.scrollTop = newScrollPosition;
		}
	}
}

const factoryInstance = new ClassInstanceFactory(ImageDrawerList);
