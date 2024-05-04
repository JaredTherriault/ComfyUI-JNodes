import { $el } from "/scripts/ui.js";

import * as Sorting from "./Sorting.js";

import { getPngMetadata } from "/scripts/pnginfo.js";

import {
	getMaxZIndex, createDarkContainer, copyToClipboard,
	isValid, getCurrentSecondsFromEpoch, SortJsonObjectByKeys
} from "../common/Utilities.js";

import { getLastMousePosition, isPointerDown } from "../common/EventManager.js";

import ExifReader from '../common/ExifReader-main/src/exif-reader.js';
import { createModal } from "../common/ModalManager.js";

import { setting_FontSize, setting_FontFamily } from "../TextareaFontControl.js"
import { createFlyoutHandle, setting_bKeyListAllowDenyToggle, setting_KeyList, setting_VideoPlaybackOptions } from "../common/SettingsManager.js";
import { executeSearchWithEnteredSearchText, getImageListElement } from "./ImageListAndSearch.js";
import { onScrollVideo, setVideoPlaybackRate, setVideoVolume, toggleVideoFullscreen } from "../common/VideoControl.js";

let toolTip;
let toolButtonContainer;

const toolTipOffsetX = 10; // Adjust the offset from the mouse pointer
const toolTipOffsetY = 10;

const bUseWideTooltip = true;

function createToolTip(imageElement) {

	const zIndex = imageElement ? getMaxZIndex(imageElement) : 1001;
	const fontSize = setting_FontSize.value;

	toolTip = $el("div", {
		style: {
			position: "fixed",
			fontSize: fontSize.toString() + '%',
			fontFamily: setting_FontFamily.value,
			lineHeight: "20px",
			padding: "5px",
			background: "#444",
			border: "1px solid #222",
			visibility: "hidden",
			opacity: "0",
			boxShadow: "-2px 2px 5px rgba(0, 0, 0, 0.2)",
			transition: "opacity 0.3s, visibility 0s",
			color: "white",
			maxWidth: bUseWideTooltip ? "40vw" : "20vw",
			pointerEvents: 'none',
			zIndex: zIndex > 0 ? zIndex + 1 : 1002,
		}
	});
	toolTip.classList.add('tooltip');

	const x = imageElement && imageElement.hasAttribute('tip-left') ? 'calc(-100% - 5px)' : '16px';
	const y = imageElement && imageElement.hasAttribute('tip-top') ? '-100%' : '0';
	toolTip.style.transform = `translate(${x}, ${y})`;

	document.body.appendChild(toolTip);

	return toolTip;
}

function updateTooltip(newTooltipWidget, imageElement) {
	if (!newTooltipWidget) { return; }

	if (!toolTip) {
		createToolTip(imageElement);
	}

	// Remove all children
	while (toolTip.firstChild) {
		toolTip.removeChild(toolTip.firstChild);
	}

	// And append the incoming one
	toolTip.appendChild(newTooltipWidget);
}

export function updateAndShowTooltip(newTooltipWidget, imageElement) {
	updateTooltip(newTooltipWidget, imageElement);
	toolTip.style.visibility = "visible";
	toolTip.style.opacity = "1";
}

export function hideToolTip() {
	if (toolTip) {
		toolTip.style.visibility = "hidden";
		toolTip.style.opacity = "0";
	}
}

function getOrCreateToolButton(imageElementToUse) {

	function createButtons(flyout) {
		if (!flyout) { return; }

		function createButton(foregroundElement, tooltipText, onClickFunction) {
			const buttonElement = $el("button", {
				title: tooltipText,
				style: {
					background: "none",
					border: "none",
					padding: 0,
					width: "max-content",
					cursor: "pointer",
				}
			}, [
				foregroundElement
			]);

			foregroundElement.style.pointerEvents = "none"; 
			buttonElement.style.pointerEvents = "all";

			buttonElement.classList.add("JNodes-interactive-container"); // Creates highlighting and mouse down color changes for feedback

			buttonElement.addEventListener('click', onClickFunction);

			return $el("tr", [
				$el("td", [
					buttonElement
				])
			]);
		}

		function createOptionsMenu() {

			if (!imageElementToUse) {
				return;
			}

			if (imageElementToUse?.promptMetadata?.positive_prompt) {
				flyout.menu.appendChild(
					createButton(
						$el("label", {
							textContent: "📋 Copy Positive Prompt",
							style: {
								color: 'rgb(250,250,250)',
							}
						}),
						'Copy positive prompt',
						function (e) {
							let positive_prompt = imageElementToUse?.promptMetadata?.positive_prompt;
							if (positive_prompt.startsWith('"')) { positive_prompt = positive_prompt.slice(1); }
							if (positive_prompt.endsWith('"')) { positive_prompt = positive_prompt.slice(0, positive_prompt.length - 1); }
							copyToClipboard(positive_prompt);
							// removeOptionsMenu();
							e.preventDefault();
						}
					)
				);
			}

			let metadataKeys = Object.keys(imageElementToUse.promptMetadata);
			metadataKeys.sort();
			for (const key of metadataKeys) {
				if (key == "positive_prompt") {
					continue;
				}

				let data = imageElementToUse.promptMetadata[key];

				flyout.menu.appendChild(
					createButton(
						$el("label", {
							textContent: `📋 Copy ${key}`,
							style: {
								color: 'rgb(250,250,250)',
							}
						}),
						`Copy ${key}`,
						function (e) {
							if (data.startsWith('"')) { data = data.slice(1); }
							if (data.endsWith('"')) { data = data.slice(0, data.length - 1); }
							copyToClipboard(data);
							// removeOptionsMenu();
							e.preventDefault();
						}
					)
				);
			}
		}

		createOptionsMenu();
	}

	if (!toolButtonContainer) {
		toolButtonContainer = createDarkContainer("imageToolsButton", "0%");
	}

	const handleClassSuffix = '.imageElement-flyout-handle';
	const menuClassSuffix = '.imageElement-flyout-menu';
	const flyout = createFlyoutHandle("⋮", handleClassSuffix, menuClassSuffix);

	flyout.menu.className = "flyout-menu-imageElement-options"; // starting custom flyout class

	flyout.handle.addEventListener('mouseover', function () {
		const handle = flyout.handle;
		const menu = flyout.menu;
		const handleRect = handle.getBoundingClientRect();
		const listRect = getImageListElement().getBoundingClientRect();

		const bIsHandleInTopHalf = handleRect.top < listRect.height / 2;
		if (bIsHandleInTopHalf) {
			// Menu is in the top half of the viewport
			menu.classList.add("top");
			menu.classList.remove("bottom");
			menu.style.maxHeight = `${listRect.bottom - handleRect.top - 50}px`;
			console.log(menu.style.maxHeight);
		} else {
			// Menu is in the bottom half of the viewport
			menu.classList.add("bottom");
			menu.classList.remove("top");
			menu.style.maxHeight = `${handleRect.top - listRect.top - 50}px`;
			console.log(menu.style.maxHeight);
		}

		const bIsHandleInLeftHalf = handleRect.left < listRect.width / 2;
		if (bIsHandleInLeftHalf) {
			// Menu is in the top half of the viewport
			menu.classList.add("left");
			menu.classList.remove("right");
			// menu.style.maxHeight = `${listRect.bottom - handleRect.top - 50}px`;
			// console.log(menu.style.maxHeight);
		} else {
			// Menu is in the bottom half of the viewport
			menu.classList.add("right");
			menu.classList.remove("left");
			// menu.style.maxHeight = `${handleRect.top - listRect.top - 50}px`;
			// console.log(menu.style.maxHeight);
		}
	});

	toolButtonContainer.style.top = '2%';
	toolButtonContainer.style.left = '2%';
	toolButtonContainer.style.visibility = "hidden";

	while (toolButtonContainer.firstChild) {
		toolButtonContainer.removeChild(toolButtonContainer.firstChild);
	}
	toolButtonContainer.appendChild(flyout.handle);

	createButtons(flyout);

	return toolButtonContainer;
}

function addToolButtonToImageElement(imageElementToUse) {

	if (!imageElementToUse) {
		return;
	}

	const toolButton = getOrCreateToolButton(imageElementToUse);

	imageElementToUse.appendChild(toolButton);
	toolButton.style.visibility = "visible";
}

function removeAndHideToolButtonFromImageElement(imageElementToUse) {
	if (toolButtonContainer?.parentElement == imageElementToUse) {
		document.body.appendChild(toolButtonContainer);
		toolButtonContainer.style.visibility = "hidden";
	}
}

export async function createImageElementFromFileInfo(fileInfo) {
	if (!fileInfo) { return; }
	const href = `/jnodes_view_image?filename=${encodeURIComponent(fileInfo.filename)}&type=${fileInfo.type}&subfolder=${encodeURIComponent(fileInfo.subfolder)}&t=${+new Date()}`;
	fileInfo.href = href;
	const bIsVideoFormat = fileInfo.file?.is_video || fileInfo.filename.endsWith(".mp4"); // todo: fetch acceptable video types from python

	const imageElement =
		$el("div.imageElement", {
			bComplete: false,
			style: {
				width: 'calc(var(--drawer-width) / var(--column-count))',
				borderRadius: '4px'
			}
		});

	imageElement.mouseOverEvent = function (event) {
		// Only show tooltip if a mouse button is not being held
		if (!isPointerDown() && !toolButtonContainer?.contains(event.target)) {
			updateAndShowTooltip(imageElement.tooltipWidget, imageElement);
			addToolButtonToImageElement(imageElement);
		}
	}

	imageElement.mouseOutEvent = function (event) {

		hideToolTip();

		// If the new actively moused over element is not a child of imageElement, then hide the button
		if (!imageElement.contains(event.relatedTarget)) {
			removeAndHideToolButtonFromImageElement(imageElement);
		}
	}

	const img = $el(bIsVideoFormat ? "video" : "img", {
		// Store the image source as a data attribute for easy access
		dataSrc: href,
		preload: "metadata",
		lastSeekTime: 0.0,
		onload: async function () {
			if (img.complete) {
				if (imageElement.bComplete) {
					//console.log('Image has been completely loaded.');
					return;
				}

				function getDisplayTextFromMetadata(metadata) {

					if (!metadata) { return ''; }

					const positivePromptKey = 'positive_prompt';
					const negativePromptKey = 'negative_prompt';

					const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
					const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

					let outputString = '';

					if (metadata[positivePromptKey]) {
						outputString = metadata[positivePromptKey] + "\n";
					}

					const metaKeys = Object.keys(metadata)?.sort((a, b) => {
						// 'negative_prompt' comes first
						if (a === negativePromptKey) { return -1; }
						if (b === negativePromptKey) { return 1; }
						return a.localeCompare(b);  // Alphabetical sorting for other keys
					});

					for (const key of metaKeys) {
						if (key == positivePromptKey) { continue; }

						const bIsKeySpecified = allowDenyList?.includes(key.trim());

						// Add if no list specified or key is specified in allow list, or key not specified in deny list
						const bIncludeKey = !allowDenyList ||
							(bIsAllowList && bIsKeySpecified) || (!bIsAllowList && !bIsKeySpecified);

						if (bIncludeKey) {
							const formattedValue = metadata[key].replace(/\n/g, '').replace(/\\n/g, '');
							outputString = outputString + '\n' + `${key}: ${formattedValue}, `;
						}
					}

					// Replace all occurrences of "\n" with actual newlines
					outputString = outputString.replace(/\\n/g, '\n');

					return outputString;
				}

				function makeTooltipWidgetFromMetadata(metadata) {
					if (isValid(metadata)) {
						return null;
					}

					const positivePromptKey = 'positive_prompt';
					const negativePromptKey = 'negative_prompt';

					const allowDenyList = setting_KeyList.value.split(",")?.map(item => item.trim());
					const bIsAllowList = setting_bKeyListAllowDenyToggle.value;

					let outputWidget = $el("div", {
						style: {
							display: 'column',
						}
					});

					if (metadata[positivePromptKey]) {
						let textContent = metadata[positivePromptKey].replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
						outputWidget.appendChild(
							$el('tr', [
								$el('td', {
									colSpan: '2',
								}, [
									$el("div", { textContent: textContent })
								])
							])
						);
					}

					if (metadata[negativePromptKey]) {
						let textContent = metadata[negativePromptKey].replace(/\\n/g, '\n').replace(/,(?=\S)/g, ', ');
						// Negative Prompt key and value on separate rows
						outputWidget.appendChild(
							$el('tr', [
								$el('td', {
									colSpan: '2',
								}, [
									$el("label", { textContent: `${negativePromptKey}:` })
								])
							])
						);
						outputWidget.appendChild(
							$el('tr', [
								$el('td', {
									colSpan: '2',
								}, [
									$el("div", { textContent: textContent })
								])
							])
						);
					}

					const metaKeys = Object.keys(metadata)?.sort((a, b) => {
						return a.localeCompare(b);  // Alphabetical sorting for keys
					});

					for (const key of metaKeys) {
						if (key == positivePromptKey || key == negativePromptKey) { continue; }

						const bIsKeySpecified = allowDenyList?.includes(key.trim());

						// Add if no list specified or key is specified in allow list, or key not specified in deny list
						const bIncludeKey = !allowDenyList ||
							(bIsAllowList && bIsKeySpecified) || (!bIsAllowList && !bIsKeySpecified);

						if (bIncludeKey) {
							let formattedValue = metadata[key].replace(/\n/g, '').replace(/\\n/g, '');

							const row =
								$el('tr', [
									$el('td', {
										style: {
											width: bUseWideTooltip ? '25%' : '50%',
										}
									}, [
										$el('label', {
											textContent: `${key}:`,
											style: {
												wordBreak: bUseWideTooltip ? 'break-all' : 'none', // Break on any character to avoid overflow outside the container
											}
										})
									]),
									$el('td', {
										style: {
											width: bUseWideTooltip ? '75%' : '50%',
										}
									}, [
										$el('label', {
											textContent: `${formattedValue}`,
											style: {
												wordBreak: bUseWideTooltip ? 'break-all' : 'none',
											}
										})
									]),
								]);

							outputWidget.appendChild(row);
						}
					}

					return outputWidget;
				}

				function setTooltipFromWidget(widget) {
					if (widget) {

						imageElement.tooltipWidget = widget;

						const lastMousePosition = getLastMousePosition();
						const elementUnderMouse = document.elementFromPoint(lastMousePosition[0], lastMousePosition[1]);
						if (elementUnderMouse && elementUnderMouse == img) {
							imageElement.mouseOverEvent();
						}

						// Show/Hide tooltip
						imageElement.addEventListener("mouseover", imageElement.mouseOverEvent);

						imageElement.addEventListener("mouseout", imageElement.mouseOutEvent);

						imageElement.onpointermove = e => {
							if (toolTip?.style?.visibility === "visible") {

								// Calculate the maximum allowed positions
								const maxX = window.innerWidth - toolTip.offsetWidth - toolTipOffsetX;
								const maxY = window.innerHeight - toolTip.offsetHeight - toolTipOffsetY - 10; //extra offset to avoid link hint label

								// Calculate the adjusted positions
								const x = Math.min(e.pageX + toolTipOffsetX, maxX);
								const y = Math.min(e.pageY + toolTipOffsetY, maxY);

								toolTip.style.left = `${x}px`;
								toolTip.style.top = `${y}px`;
							}
						};
					}
				}

				function setMetadataAndUpdateTooltipAndSearchTerms(Metadata) {

					imageElement.promptMetadata = Metadata;

					// Set the dimensional display data in the event that it's not found in python meta sweep
					if (!imageElement.displayData.FileDimensions) {
						imageElement.displayData.FileDimensions = fileInfo.file.dimensions;
					}

					if (!imageElement.displayData.AspectRatio) {
						imageElement.displayData.AspectRatio = imageElement.displayData.FileDimensions[0] / imageElement.displayData.FileDimensions[1];
					}

					imageElement.displayData = SortJsonObjectByKeys(imageElement.displayData);

					const toolTipWidget = makeTooltipWidgetFromMetadata(Metadata);

					if (toolTipWidget) {
						setTooltipFromWidget(toolTipWidget);
					}

					// Finally, set search terms on the element
					imageElement.searchTerms += " " + getDisplayTextFromMetadata(Metadata);
				}

				const response = await fetch(href);
				const blob = await response.blob();

				// Hover mouse over image to show meta
				//console.log(href);
				let metadata = null;
				if (href.includes(".png")) {
					try {
						metadata = await getPngMetadata(blob);
					} catch (error) {
						console.log(error);
					}

				} else if (href.includes(".webp")) {
					const webpArrayBuffer = await blob.arrayBuffer();

					try {
						// Use the exif library to extract Exif data
						const exifData = ExifReader.load(webpArrayBuffer);
						//console.log("exif: " + JSON.stringify(exifData));

						const exif = exifData['UserComment'];

						if (exif) {

							// Convert the byte array to a Uint16Array
							const uint16Array = new Uint16Array(exif.value);

							// Create a TextDecoder for UTF-16 little-endian
							const textDecoder = new TextDecoder('utf-16le');

							// Decode the Uint16Array to a string
							const decodedString = textDecoder.decode(uint16Array);

							// Remove null characters
							const cleanedString = decodedString.replace(/\u0000/g, '');
							const jsonReadyString = cleanedString.replace("UNICODE", "")

							try {
								metadata = JSON.parse(jsonReadyString);
							} catch (error) {
								console.log(error);
							}
						}
					} catch (error) {
						console.log(error);
					}
				}

				setMetadataAndUpdateTooltipAndSearchTerms(metadata);

				imageElement.bComplete = true;

				if (fileInfo.bShouldSort) {
					Sorting.sortWithCurrentType();
					fileInfo.bShouldSort = false;
				}

				if (fileInfo.bShouldApplySearch) {
					executeSearchWithEnteredSearchText();
					fileInfo.bShouldApplySearch = false;
				}
			}
			else {
				console.log('Image is still loading.');
			}
		}
	});

	img.forceLoad = function () {
		img.src = img.dataSrc;

		if (bIsVideoFormat) {
			setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate); // This gets reset when src is reset
		}
	}

	img.initVideo = function () {

		img.type = fileInfo.file?.format || undefined;
		img.autoplay = false; // Start false, will autoplay via observer
		img.loop = setting_VideoPlaybackOptions.value.loop;
		img.controls = setting_VideoPlaybackOptions.value.controls;
		img.muted = setting_VideoPlaybackOptions.value.muted;
		setVideoVolume(img, setting_VideoPlaybackOptions.value.defaultVolume);
		setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate);
	}

	imageElement.forceLoad = function () {
		img.forceLoad();
	}

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
		//If we can't properly placehold, load the whole image now instead of later
		imageElement.forceLoad();
	}

	const aElement = $el("a", {
		target: "_blank",
		href: href,
		draggable: false,
		download: fileInfo.filename,
		onclick: async (e) => {
			e.preventDefault();

			if (bIsVideoFormat) {
				if (img && img.togglePlayback) {
					img.togglePlayback();
				}
			} else {
				function createModalContent() {
					const modalImg = $el("img", {
						src: href,
						// Store the image source as a data attribute for easy access
						'data-src': href,
						style: {
							position: 'relative',
							width: '99vw',
							height: '99vh',
							objectFit: 'contain',
							display: 'block',
							margin: 'auto',
						},
					});

					// Create modal content
					const modalContent = document.createElement("div");
					modalContent.style.position = 'absolute';
					modalContent.style.display = "inline-block";
					modalContent.style.left = "50%";
					modalContent.style.top = "50%";
					modalContent.style.transform = "translate(-50%, -50%)";
					modalContent.style.maxWidth = "99%";
					modalContent.style.maxHeight = "99%";
					modalContent.style.overflow = "hidden";

					modalContent.appendChild(modalImg);

					return modalContent;
				}
				createModal(createModalContent());
			}
		},
		ondblclick: async (e) => {
			e.preventDefault();

			if (bIsVideoFormat) {
				if (img) {
					toggleVideoFullscreen(img);
				}
			}
		}
	});

	imageElement.appendChild(aElement);

	if (!imageElement.displayData) {
		imageElement.displayData = {};
	}

	if (bIsVideoFormat) {

		imageElement.addEventListener('wheel', (event) => {
			if (setting_VideoPlaybackOptions.value.useWheelSeek) {
				onScrollVideo(img, event, setting_VideoPlaybackOptions.value.invertWheelSeek);
			}
		});

		img.initVideo();

		imageElement.displayData.DurationInSeconds = fileInfo.file?.duration_in_seconds;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;
		imageElement.displayData.FrameCount = fileInfo.file?.frame_count;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;

		imageElement.bIsVideoFormat = bIsVideoFormat;
	}

	aElement.appendChild(img);

	// Sorting meta information
	imageElement.filename = fileInfo.filename;
	imageElement.fileType = imageElement.filename.split(".")[1];
	imageElement.file_age = fileInfo.file?.file_age || getCurrentSecondsFromEpoch(); // todo: fix for feed images
	imageElement.displayData.FileSize = fileInfo.file?.file_size || -1;

	imageElement.displayData = SortJsonObjectByKeys(imageElement.displayData);

	imageElement.searchTerms = href; // Search terms to start with, onload will add more

	imageElement.draggable = true;
	imageElement.addEventListener('dragstart', function (event) {
		fileInfo.displayData = imageElement.displayData;
		event.dataTransfer.setData('text/jnodes_image_drawer_payload', `${JSON.stringify(fileInfo)}`);
		removeAndHideToolButtonFromImageElement(imageElement);
		hideToolTip();
	});

	return imageElement;
}