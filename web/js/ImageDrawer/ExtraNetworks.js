import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";
import { copyToClipboard, setSearchTermsOnElement, createDarkContainer, getDarkColor } from "../common/utils.js"

import { setSearchTextAndExecute } from "./imageDrawer.js";

const NoImagePlaceholder = new URL(`../assets/NoImage.png`, import.meta.url);

let cachedLorasObject = undefined;
/**
 * Gets a list of embedding names
 * @returns An array of script urls to import
 */
export async function getLoras(bForceRefresh = false) {
	if (bForceRefresh || cachedLorasObject == undefined) {
		const resp = await api.fetchApi(
			'/jnodes_folder_items', { "type": "loras", cache: "no-store" });
		const asJson = await resp.json();
		//console.log("Size of loras info: " + JSON.stringify(asJson).length)
		cachedLorasObject = asJson;
		return asJson;
	}

	return cachedLorasObject;
}

export async function createExtraNetworkCard(loraNameText, familiars) {

	if (!loraNameText) {
		return;
	}

	let loraNameToUse = loraNameText;
	let trainedWords = [];
	let tags = [];

	// Load the first image as the object cover image. 
	// If one does not exist, fall back to placeholder image.
	function getHrefForFamiliarImage(index) {
		if (familiars?.familiar_images?.length > 0) {
			return `/jnodes_view_image?filename=${encodeURIComponent(familiars.familiar_images[index])}&type=${"loras"}`;
		}
		return NoImagePlaceholder;
	}

	async function parseFamiliarInfos() {
		let infoMap = {};
		if (familiars?.familiar_infos?.length > 0) {
			for (const familiar_info of familiars.familiar_infos) {
				try {
					let loadedJson = JSON.parse(familiar_info);
					if (loadedJson) {
						let jsonKeys = Object.keys(loadedJson);

						for (const key of jsonKeys) {
							infoMap[key] = loadedJson[key];
						}
					}
				} catch (jsonError) {
					console.error(`Error parsing JSON: ${jsonError}`);
				}
			}
		}

		if (infoMap['model'] && infoMap['model']['name']) {
			loraNameToUse = `${infoMap['model']['name']} (${loraNameToUse})`;
		}

		if (infoMap['tags']) {
			for (const tag of infoMap['tags']) {
				tags.push(tag.trim());
			}
		}

		if (infoMap['trainedWords']) {
			trainedWords = infoMap['trainedWords'];
		}

		return infoMap;
	}

	const infoMap = await parseFamiliarInfos();

	function createImageSwitchButton(bIsLeft) {

		if (familiars.familiar_images.length < 2) {
			return;
		}

		function onClickLeft(e) {
			backgroundImage.lastViewedImageIndex -= 1;
			if (backgroundImage.lastViewedImageIndex < 0) {
				backgroundImage.lastViewedImageIndex = familiars.familiar_images.length - 1;
			}
			backgroundImage.src = getHrefForFamiliarImage(backgroundImage.lastViewedImageIndex);

			updateImageCounterText();
		}

		function onClickRight(e) {
			backgroundImage.lastViewedImageIndex += 1;
			if (backgroundImage.lastViewedImageIndex == familiars.familiar_images.length) {
				backgroundImage.lastViewedImageIndex = 0;
			}
			backgroundImage.src = getHrefForFamiliarImage(backgroundImage.lastViewedImageIndex);

			updateImageCounterText();
		}

		return $el('button', {
			style: {
				position: "absolute",
				top: '50%',
				left: bIsLeft ? '5%' : '85%',
				transformOrigin: 'center',
				fontSize: 'calc(var(--max-size) * 0.02vw)',
			},
			onclick: bIsLeft ? onClickLeft : onClickRight,
		}, [
			$el("label", {
				textContent: bIsLeft ? "<" : ">",
			}),
		]);
	}

	const backgroundImage =
		$el("img", {
			lastViewedImageIndex: 0,
			style: {
				objectFit: "cover",
				width: "100%",
				height: "100%",
			}
		});
	backgroundImage.src = getHrefForFamiliarImage(backgroundImage.lastViewedImageIndex);

	let imageCounterLabel;

	function updateImageCounterText() {
		if (imageCounterLabel) {
			if (familiars.familiar_images.length < 1) {
				return;
			}
			const CurrentImageIndex =
				parseInt(backgroundImage.lastViewedImageIndex);
			imageCounterLabel.textContent =
				`${CurrentImageIndex + 1}/${familiars.familiar_images.length}`
		}
	}

	function createImageCounterElement() {

		imageCounterLabel = $el("label", {
			textContent: 'No preview images found',
		});

		const imageCounterElement = createDarkContainer();

		imageCounterElement.style.top = '2%';
		imageCounterElement.style.right = '2%';
		imageCounterElement.appendChild(imageCounterLabel);

		updateImageCounterText();

		return imageCounterElement;
	}

	function createButtonToolbar() {

		function createButtons() {
			if (!buttonsRow) { return; }

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
			
			let copyLoraText = `<lora:${loraNameText}:1:1>`;

			if (trainedWords.length > 0) {
				//Copy all
				let copyAllText = copyLoraText + ", " + trainedWords;
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📋",
						}),
						`Copy lora as a1111-style text + trained words (${copyAllText})`,
						function(e) {
							copyToClipboard(copyAllText)
							e.preventDefault();
						}
					)
				);

				// Copy trained words button
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📝",
						}),
						`Copy trained words (${trainedWords})`,
						function(e) {
							copyToClipboard(trainedWords)
							e.preventDefault();
						}
					)
				);
			}

			// Copy text lora button
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "📜",
					}),
					`Copy lora as a1111-style text (${copyLoraText})`,
					function(e) {
						copyToClipboard(copyLoraText)
						e.preventDefault();
					}
				)
			);
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
		buttonToolbarContainerElement.appendChild(buttonsRow);

		createButtons();

		return buttonToolbarContainerElement;
	}

	function createNameAndTagContainer() {

		function createTagButton(tagName) {
			const buttonElement = $el("button", {
				title: `Click to search "${tagName}"`,
				style: {
					background: 'none',
					border: 'none',
					padding: '0',
				}
			}, [
				$el("label", {
					textContent: tagName,
					style: {
						fontSize: 'calc(var(--max-size) * 0.01vw)',
						color: 'rgb(250,250,250)',
						wordBreak: 'keep-all',
					}
				})
			]);

			buttonElement.addEventListener('click', () => {
				setSearchTextAndExecute(tagName);
			});

			return buttonElement;
		}

		const tagButtonContainer = $el("div", {
			id: 'tag-container',
			style: {
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'center',
				gap: '10px',
				width: '90%'
			}
		});

		const mainContainer = $el("div", {
			id: 'darkened-text-bg',
			style: {
				position: "absolute",
				top: '85%',
				left: 0,
				width: "100%",
				backgroundColor: getDarkColor(),
				height: '15%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			}
		}, [
			$el("label", {
				textContent: loraNameToUse,
				style: {
					fontSize: 'calc(var(--max-size) * 0.02vw)',
					top: '5%',
					wordBreak: 'break-all',
				}
			}),
			tagButtonContainer
		]);

		for (const tag of tags) {
			tagButtonContainer.appendChild(createTagButton(tag));
		}

		return mainContainer;
	}

	//console.log("loraNameToUse: " + loraNameToUse);

	const loraElement =
		$el("div", {
			id: "extra-networks-card",
			"data-name": loraNameToUse,
			style: {
				textAlign: 'center',
				objectFit: 'var(--div-fit, contain)',
				height: 'calc(var(--max-size) * 1vh)',
				borderRadius: '4px',
				position: "relative",
				aspectRatio: '0.67',
			},
		});

	loraElement.appendChild(backgroundImage);
	const leftImageSwitchButton = createImageSwitchButton(true);
	if (leftImageSwitchButton) { loraElement.appendChild(leftImageSwitchButton); }
	const rightImageSwitchButton = createImageSwitchButton(false);
	if (rightImageSwitchButton) { loraElement.appendChild(rightImageSwitchButton); }
	loraElement.appendChild(createImageCounterElement());
	loraElement.appendChild(createButtonToolbar());
	loraElement.appendChild(createNameAndTagContainer());

	loraElement.title = JSON.stringify(infoMap);

	setSearchTermsOnElement(loraElement, `${loraNameToUse}, ${trainedWords}, ${tags.join(', ')}`);

	return loraElement;
}