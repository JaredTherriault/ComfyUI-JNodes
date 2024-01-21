import { $el } from "/scripts/ui.js";
import { getPngMetadata } from "/scripts/pnginfo.js";

import { defaultKeyList, getVal } from "./imageDrawer.js";
// getValue only prepends 'JNodes.', getVal also prepends 'ImageDrawer.'.
import {
	getValue, setSearchTermsOnElement, getMaxZIndex, getLastMousePosition,
	createDarkContainer, copyToClipboard,
} from "../common/utils.js";
import ExifReader from '../common/ExifReader-main/src/exif-reader.js';
import { createModal } from "../common/modal.js";

let toolTip;

const toolTipOffsetX = 10; // Adjust the offset from the mouse pointer
const toolTipOffsetY = 10;

function createToolTip(imageElement) {

	const zIndex = imageElement ? getMaxZIndex(imageElement) : 1001;
	const fontSize = getValue("Customization.MultilineText.Font.Size", 80);

	toolTip = $el("div", {
		style: {
			position: "fixed",
			fontSize: fontSize.toString() + '%',
			fontFamily: getValue("Customization.MultilineText.Font.Family", 'monospace'),
			lineHeight: "20px",
			padding: "5px",
			background: "#444",
			border: "1px solid #222",
			visibility: "hidden",
			opacity: "0",
			boxShadow: "-2px 2px 5px rgba(0, 0, 0, 0.2)",
			transition: "opacity 0.3s, visibility 0s",
			color: "white",
			maxWidth: "20vw",
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

export async function createImageElementFromImgSrc(src) {
	if (!src) { return; }
	const href = `/jnodes_view_image?filename=${encodeURIComponent(src.filename)}&type=${src.type}&subfolder=${encodeURIComponent(src.subfolder)}&t=${+new Date()}`;
	const bIsVideoFormat = src.format?.startsWith("video");

	const imageElement =
		$el("div.imageElement", {
			style: {
				//				textAlign: 'center',
				//				objectFit: 'var(--div-fit, contain)',
				//				height: 'calc(var(--max-size) * 1vh)',
				//				borderRadius: '4px',
				//				position: "relative",
				maxWidth: 'fit-content',
			}
		});

	function createButtonToolbar() {

		function createButtons() {
			if (!buttonsRow) { return; }

			let contextMenu;

			function createButton(foregroundElement, tooltipText, onClickFunction) {
				const buttonElement = $el("button", {
					title: tooltipText,
					style: {
						background: 'none',
						border: 'none',
						padding: 0,
					}
				}, [
					foregroundElement
				]);

				buttonElement.addEventListener('click', onClickFunction);

				return buttonElement;
			}

			function removeOptionsMenu() {
				if (contextMenu) {
					const parentElement = contextMenu.parentNode;
					parentElement.removeChild(contextMenu);
					contextMenu = null;
				}
			}

			function createOptionsMenu() {

				contextMenu = $el("div", {
					id: "context-menu-image-elements",
					style: {
						width: 'fit-content',
						display: 'flex',
						flexDirection: 'column',
						//						position: 'absolute',
					}
				});

				contextMenu.appendChild(
					createButton(
						$el("label", {
							textContent: "📋 Copy Positive Prompt",
							style: {
								color: 'rgb(250,250,250)',
							}
						}),
						'Copy positive prompt',
						function(e) {
							let positive_prompt = imageElement?.metadata?.positive_prompt;
							if (positive_prompt.startsWith('"')) { positive_prompt = positive_prompt.slice(1); }
							if (positive_prompt.endsWith('"')) { positive_prompt = positive_prompt.slice(0, positive_prompt.length - 1); }
							copyToClipboard(positive_prompt);
							removeOptionsMenu();
							e.preventDefault();
						}
					)
				);

				return contextMenu;
			}

			const optionsContainer = $el("div", [
				createButton(
					$el("label", {
						textContent: "⋮",
						style: {
							fontSize: '200%',
							color: 'rgb(250,250,250)',
						}
					}),
					'Options',
					function(e) {
						if (contextMenu) {
							removeOptionsMenu();
						} else {
							optionsContainer.appendChild(createOptionsMenu());
						}
						e.preventDefault();
					}
				)]
			);

			// Options button
			buttonsRow.appendChild(optionsContainer);
		}

		const buttonsRow = $el("div", {
			style: {
				width: '100%',
				display: 'flex',
				flexDirection: 'row',
			}
		});

		const buttonToolbarContainerElement = createDarkContainer();

		buttonToolbarContainerElement.style.top = '2%';
		buttonToolbarContainerElement.style.left = '2%';
		buttonToolbarContainerElement.style.visibility = "hidden";
		buttonToolbarContainerElement.appendChild(buttonsRow);

		createButtons();

		return buttonToolbarContainerElement;
	}

	const aElement = $el("a", {
		target: "_blank",
		href,
		onclick: async (e) => {

			function createModalContent() {
				const modalImg = $el(bIsVideoFormat ? "video" : "img", {
					src: href,
					// Store the image source as a data attribute for easy access
					'data-src': href,
					style: {
						position: 'relative',
						width: '99vw',
						height: '99vh',
						maxWidth: 'fit-content',
						maxHeight: 'fit-content',
						display: "block",
						margin: "auto",
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
			e.preventDefault();
			createModal(createModalContent());
		}
	});

	imageElement.appendChild(aElement);

	const img = $el(bIsVideoFormat ? "video" : "img", {
		src: href,
		// Store the image source as a data attribute for easy access
		'data-src': href,
		style: {
			objectFit: 'var(--div-fit, contain)',
			maxWidth: '100%',
			maxHeight: 'calc(var(--max-size) * 1vh)',
			borderRadius: '4px',
		},
		onload: async function() {
			if (img.complete) {
				//console.log('Image has been completely loaded.');

				function getDisplayTextFromMetadata(metadata) {
					const positivePromptKey = 'positive_prompt';
					const negativePromptKey = 'negative_prompt';

					const allowDenyList = getVal("ImageVideo.KeyList",
						defaultKeyList)?.split(",")?.map(item => item.trim());
					const bIsAllowList = getVal("ImageVideo.KeyListAllowDenyToggle", false);

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
					const positivePromptKey = 'positive_prompt';
					const negativePromptKey = 'negative_prompt';

					const allowDenyList = getVal("ImageVideo.KeyList",
						defaultKeyList)?.split(",")?.map(item => item.trim());
					const bIsAllowList = getVal("ImageVideo.KeyListAllowDenyToggle", false);

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
											width: '50%',
										}
									}, [
										$el('label', {
											textContent: `${key}:`,
											style: {
												wordBreak: 'break-all', // Break on any character to avoid overflow outside the container
											}
										})
									]),
									$el('td', {
										style: {
											width: '50%',
										}
									}, [
										$el('label', {
											textContent: `${formattedValue}`,
											style: {
												wordBreak: 'break-all',
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

						function mouseOverEvent() {

							updateAndShowTooltip(imageElement.tooltipWidget, imageElement);
							buttonToolbar.style.visibility = "visible";
						}

						function mouseOutEvent() {

							if (!toolTip) { return; }
							toolTip.style.visibility = "hidden";
							toolTip.style.opacity = "0";

							buttonToolbar.style.visibility = "hidden";
						}

						const lastMousePosition = getLastMousePosition();
						const elementUnderMouse = document.elementFromPoint(lastMousePosition[0], lastMousePosition[1]);
						if (elementUnderMouse && elementUnderMouse == img) {
							mouseOverEvent();
						}

						// Show/Hide tooltip
						imageElement.addEventListener("mouseover", mouseOverEvent);

						imageElement.addEventListener("mouseout", mouseOutEvent);

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

				// Hover mouse over image to show meta
				//console.log(href);
				if (href.includes(".png")) {
					const response = await fetch(href);
					const blob = await response.blob();
					const pnginfo = await getPngMetadata(blob);

					imageElement.metadata = pnginfo;

					const toolTipWidget = makeTooltipWidgetFromMetadata(pnginfo);

					setTooltipFromWidget(toolTipWidget);

					// Optionally, set search terms on the element
					setSearchTermsOnElement(imageElement, getDisplayTextFromMetadata(pnginfo));
				}
				else if (href.includes(".webp")) {
					const response = await fetch(href);
					const blob = await response.blob();
					const webpArrayBuffer = await blob.arrayBuffer();

					// Use the exif library to extract Exif data
					const exifData = ExifReader.load(webpArrayBuffer);
					//console.log("exif: " + JSON.stringify(exifData));

					const metadata = exifData['UserComment'];

					// Convert the byte array to a Uint16Array
					const uint16Array = new Uint16Array(metadata.value);

					// Create a TextDecoder for UTF-16 little-endian
					const textDecoder = new TextDecoder('utf-16le');

					// Decode the Uint16Array to a string
					const decodedString = textDecoder.decode(uint16Array);

					// Remove null characters
					const cleanedString = decodedString.replace(/\u0000/g, '');
					const jsonReadyString = cleanedString.replace("UNICODE", "")

					const asJson = JSON.parse(jsonReadyString);

					imageElement.metadata = asJson;

					const toolTipWidget = makeTooltipWidgetFromMetadata(asJson);

					setTooltipFromWidget(toolTipWidget);

					// Optionally, set search terms on the element
					setSearchTermsOnElement(imageElement, getDisplayTextFromMetadata(asJson));
				}
			}
			else {
				console.log('Image is still loading.');
			}
		}
	});

	if (bIsVideoFormat) {

		img.type = src.format;
		img.autoplay = true;
		img.loop = true;
	}

	aElement.appendChild(img);
	const buttonToolbar = createButtonToolbar(imageElement)
	imageElement.appendChild(buttonToolbar);

	return imageElement;
}