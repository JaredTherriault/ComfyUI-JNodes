import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../../common/Utilities.js";

import { ModalManager, ModalOptions } from "../../common/ModalManager.js";

import { setting_VideoPlaybackOptions } from "../../common/SettingsManager.js";
import { setVideoPlaybackRate, setVideoVolume, toggleVideoFullscreen, toggleVideoPlayback } from "../../common/VideoControl.js";

import * as ImageElementUtils from "./ImageListChildElementUtils.js";

export async function createImageElementFromFileInfo(fileInfo, imageDrawerInstance) {
	if (!fileInfo) { return; }
	let href = `/jnodes_view_image?`;
	if (fileInfo.filename) {
		href += `filename=${encodeURIComponent(fileInfo.filename)}&`;
	}
	if (fileInfo.type) {
		href += `type=${fileInfo.type}&`;
	}
	if (fileInfo.subdirectory || fileInfo.subfolder) {
		href += `subfolder=${encodeURIComponent(fileInfo.subdirectory || fileInfo.subfolder || "")}&`;
	}

	href += `t=${+new Date()}`; // Add Timestamp

	fileInfo.href = href;
	const bIsVideoFormat = fileInfo.file?.is_video || fileInfo.filename.endsWith(".mp4") || fileInfo.filename.endsWith(".webm"); // todo: fetch acceptable video types from python

	const imageElement =
		$el("div.imageElement", {
			bComplete: false,
			style: {
				borderRadius: '4px',
				transition: "100ms",
			}
		});

	imageElement.fileInfo = fileInfo;
	imageElement.bIsVideoFormat = bIsVideoFormat;
	imageElement.imageDrawerInstance = imageDrawerInstance;

	imageElement.deleteItem = async function (bAlsoRemoveFromImageList = true, bNotifyImageListChanged = true) {

		const deleteCall = imageElement.fileInfo.href.replace("jnodes_view_image", "jnodes_delete_item");
		const response = await api.fetchApi(deleteCall, { method: "DELETE" });

		let jsonResponse;
		try {
			const decodedString = await utilitiesInstance.decodeReadableStream(response.body);
			jsonResponse = JSON.parse(decodedString)
		} catch (error) { console.error("Could not parse json from response."); }

		let bSuccess = jsonResponse && jsonResponse.success && jsonResponse.success == true;

		if (bAlsoRemoveFromImageList) {
			imageElement.removeItemFromImageList(bNotifyImageListChanged);
		}

		return bSuccess;
	};

	imageElement.copyItem = async function (destinationDirectory) {

		const destination = utilitiesInstance.joinPaths([destinationDirectory, fileInfo.filename]);
		const copyCall = imageElement.fileInfo.href.replace("jnodes_view_image", "jnodes_copy_item") + `&destination=${encodeURIComponent(destination)}`;
		const response = await api.fetchApi(copyCall, { method: "POST" });

		let jsonResponse;
		try {
			const decodedString = await utilitiesInstance.decodeReadableStream(response.body);
			jsonResponse = JSON.parse(decodedString)
		} catch (error) { console.error("Could not parse json from response."); }

		let bSuccess = jsonResponse && jsonResponse.success && jsonResponse.success == true;

		return bSuccess;
	};

	imageElement.removeItemFromImageList = async function (bNotifyImageListChanged = true) {

		const imageDrawerListInstance = imageDrawerInstance.getComponentByName("ImageDrawerList");

		if (bNotifyImageListChanged) {
			imageDrawerListInstance.notifyStartChangingImageList();
		}

		imageDrawerListInstance.removeElementFromImageList(imageElement); // If it was deleted, remove it from the list

		if (bNotifyImageListChanged) {
			imageDrawerListInstance.notifyFinishChangingImageList();
		}
	};

	const img = $el(bIsVideoFormat ? "video" : "img", {
		// Store the image source as a data attribute for easy access
		dataSrc: href,
		preload: "metadata",
		lastSeekTime: 0.0,
		style: {
			transition: "100ms",
			cursor: bIsVideoFormat ? "default" : "pointer"
		},
		onload: () => { ImageElementUtils.onLoadImageElement(imageElement); }, // Still / animated images
		onloadedmetadata: () => { ImageElementUtils.onLoadImageElement(imageElement); }, // Videos
	});

	imageElement.img = img;

	img.forceLoad = function () {
		img.src = img.dataSrc;

		if (bIsVideoFormat) {
			setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate); // This gets reset when src is reset
		}
	};

	imageElement.forceLoad = function () {
		img.forceLoad();
	};

	if (fileInfo.bShouldForceLoad) {
		imageElement.forceLoad(); // Immediately load img if we don't want to lazy load (like in feed)
	}

	// Placeholder dimensions
	if (fileInfo.file?.metadata_read) {
		if (!imageElement.displayData) {
			imageElement.displayData = {};
		}
		imageElement.displayData.FileDimensions = fileInfo.file.dimensions;

		imageElement.displayData.AspectRatio = imageElement.displayData.FileDimensions[0] / imageElement.displayData.FileDimensions[1];
		imageElement.style.aspectRatio = imageElement.displayData.AspectRatio;
	} else {
		// If we can't properly placehold, load the whole image now instead of later
		imageElement.forceLoad();
	}

	if (!imageElement.displayData) {
		imageElement.displayData = {};
	}

	if (bIsVideoFormat) {

		img.initVideo = function () {

			img.type = fileInfo.file?.format || undefined;
			img.autoplay = false; // Start false, will autoplay via observer
			img.loop = setting_VideoPlaybackOptions.value.loop;
			img.controls = setting_VideoPlaybackOptions.value.controls;
			img.muted = setting_VideoPlaybackOptions.value.muted;
			setVideoVolume(img, setting_VideoPlaybackOptions.value.defaultVolume);
			setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate);
		}

		img.addEventListener('wheel', (event) => {

			if (setting_VideoPlaybackOptions.value.useWheelSeek || 
				(!setting_VideoPlaybackOptions.value.useWheelSeek && event.altKey)) {
				// Prevent scrolling the list
				event.preventDefault();
			}
		});

		img.initVideo();
	}

	imageElement.appendChild(img);

	// Sorting meta information
	imageElement.filename = imageElement.friendlyName = fileInfo.filename;
	imageElement.fileType = imageElement.filename.split(".")[1];
	imageElement.file_age = fileInfo.file?.file_age || utilitiesInstance.getCurrentSecondsFromEpoch(); // todo: fix for feed images
	imageElement.subdirectory = fileInfo.subdirectory || null;
	imageElement.displayData.FileSize = fileInfo.file?.file_size || -1;

	if (fileInfo?.file?.duration_in_seconds && fileInfo.file.duration_in_seconds > 0) {
		imageElement.displayData.DurationInSeconds = fileInfo.file.duration_in_seconds;
	}
	if (fileInfo?.file?.fps && fileInfo.file.fps > 0) {
		imageElement.displayData.FramesPerSecond = fileInfo.file.fps;
	}
	if (fileInfo?.file?.frame_count && fileInfo.file.frame_count > 0) {
		imageElement.displayData.FrameCount = fileInfo.file.frame_count;
	}

	imageElement.displayData = utilitiesInstance.sortJsonObjectByKeys(imageElement.displayData);

	imageElement.searchTerms = `${imageElement.filename} ${imageElement.subdirectory} ${JSON.stringify(imageElement.displayData)} `; // Search terms to start with, onload will add more

	// Add meta keys as well, except workflow and prompt from comfy
	if (fileInfo.file?.hasOwnProperty("metadata")) {
		for (const key of Object.keys(fileInfo.file.metadata)) {

			if (key == "prompt" || key == "workflow") {
				continue;
			}
			imageElement.searchTerms += fileInfo.file.metadata[key];
		}
	}

	// Mouse Events
	imageElement.bHasEverMousedOver = false;
	imageElement.addEventListener("mouseover", (event) => {

		if (!imageElement.bHasEverMousedOver) {
			imageElement.addEventListener("mouseout", (event) => {

				ImageElementUtils.imageElementMouseOutEvent(event, imageElement);
			});

			imageElement.draggable = true;
			imageElement.addEventListener('dragstart', function (event) {
				fileInfo.displayData = imageElement.displayData;
				event.dataTransfer.setData('text/jnodes_image_drawer_payload', `${JSON.stringify(fileInfo)}`);
				ImageElementUtils.removeAndHideToolButtonFromImageElement(imageElement);
				ImageElementUtils.hideImageElementCheckboxSelector(imageElement);
				ImageElementUtils.hideToolTip();
			});

			imageElement.showInFileManager = async function () {

				const call = imageElement.fileInfo.href.replace("jnodes_view_image", "jnodes_request_open_file_manager");
				api.fetchApi(call, { method: "POST" });
			}

			img.addEventListener("click", async (e) => {
				e.preventDefault();

				if (bIsVideoFormat) {

					if (img && toggleVideoPlayback) {
						toggleVideoPlayback(img);
					}

				} else {

					// Make a modal for the image, passing in its current index to allow for slideshows and image switching
					const imageDrawerListInstance = imageDrawerInstance.getComponentByName("ImageDrawerList");
					// Find this imageElement in the list
					const currentIndex = Array.from(imageDrawerListInstance.getVisibleImageListChildren()).findIndex((op => op === imageElement));

					const modalManager = new ModalManager(
						imageDrawerInstance, new ModalOptions(
							true, 
							(currentIndex !== undefined && currentIndex > -1) ? currentIndex : undefined),
							true
						);

					modalManager.createModal(modalManager.createModalReadyImage(href));

					// Remove focus from the currently focused element
					document.activeElement.blur();
				}
			});

			img.addEventListener("dblclick", async (e) => {
				e.preventDefault();

				if (bIsVideoFormat) {
					if (img) {
						toggleVideoFullscreen(img);
					}
				}
			});

			imageElement.bHasEverMousedOver = true;
		}

		ImageElementUtils.imageElementMouseOverEvent(event, imageElement);
	});

	// Selection
	ImageElementUtils.addCheckboxSelectorToImageElement(imageElement);
	ImageElementUtils.hideImageElementCheckboxSelector(imageElement);

	return imageElement;
}