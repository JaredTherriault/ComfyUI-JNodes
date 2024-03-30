import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";
import { $el } from "/scripts/ui.js";
import { copyToClipboard, createDarkContainer, getDarkColor } from "../common/Utilities.js"

import { setSearchTextAndExecute } from "./imageDrawer.js";

const NoImagePlaceholder = new URL(`../assets/NoImage.png`, import.meta.url);

let cachedLorasObject = undefined;
let cachedEmbeddingsObject = undefined;

/**
 * Gets a list of lora names
 * @returns An array of script urls to import
 */
export async function getLoras(bForceRefresh = false) {
	if (bForceRefresh || !cachedLorasObject) {
		const resp = await api.fetchApi('/jnodes_model_items?type=loras');
		const asJson = await resp.json();
		//console.log("Size of loras info: " + JSON.stringify(asJson).length)
		cachedLorasObject = asJson;
		return asJson;
	}

	return cachedLorasObject;
}

/**
 * Gets a list of embedding names
 * @returns An array of script urls to import
 */
export async function getEmbeddings(bForceRefresh = false) {
	if (bForceRefresh || !cachedEmbeddingsObject) {
		const resp = await api.fetchApi('/jnodes_model_items?type=embeddings');
		const asJson = await resp.json();
		//console.log("Size of embeddings info: " + JSON.stringify(asJson).length)
		cachedLorasObject = asJson;
		return asJson;
	}

	return cachedLorasObject;
}

export async function createExtraNetworkCard(nameText, familiars, type) {

	if (!nameText) {
		return;
	}

	let nameToUse = nameText;
	let trainedWords = [];
	let tags = [];
	let modelId; // The base model ID for civit.ai. Not specific to any version of the model.
	let lastViewedImageIndex = 0;

	const bIsLora = type == "loras";

	// Load the first image as the object cover image. 
	// If one does not exist, fall back to placeholder image.
	function getHrefForFamiliarImage(index) {
		if (familiars?.familiar_images?.length > 0) {
			return `/jnodes_view_image?filename=${encodeURIComponent(familiars.familiar_images[index])}&type=${type}`;
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
					console.error(`Error parsing JSON: ${jsonError}, orginal text: ${familiar_info}`);
				}
			}
		}

		// Prefer user set friendlyName over data from civit.ai
		if (infoMap.friendlyName) {
			if (infoMap.friendlyName.trim() != nameToUse.trim()) {
				nameToUse = `${infoMap.friendlyName} (${nameToUse})`;
			}
		} else if (infoMap.model && infoMap.model.name) {
			if (infoMap.model.name.trim() != nameToUse.trim()) {
				nameToUse = `${infoMap.model.name} (${nameToUse})`;
			}
		}

		// Prefer user set tags over data from civit.ai
		if (infoMap.userTags) {
			for (const tag of infoMap.userTags) {
				tags.push(tag.trim());
			}
		} else if (infoMap.tags) {
			for (const tag of infoMap.tags) {
				tags.push(tag.trim());
			}
		}

		// Prefer user set trainedWords over data from civit.ai
		if (infoMap.userTrainedWords) {
			trainedWords = (`${infoMap.userTrainedWords}`).trim();
			if (!trainedWords.endsWith(",")) {
				trainedWords += ",";
			}
			trainedWords = trainedWords.replace("\\(", "(").replace("\\)", ")").replace('\\"', '"');
		} else if (infoMap.trainedWords) {
			trainedWords = (`${infoMap.trainedWords}`).trim();
			if (!trainedWords.endsWith(",")) {
				trainedWords += ",";
			}
			trainedWords = trainedWords.replace("\\(", "(").replace("\\)", ")").replace('\\"', '"');
		}

		if (infoMap.lastViewedImageIndex) {
			lastViewedImageIndex = infoMap.lastViewedImageIndex;
		}

		modelId = infoMap.modelId || infoMap.id || undefined;

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
			lastViewedImageIndex: lastViewedImageIndex,
			draggable: false,
			style: {
				objectFit: "cover",
				width: "100%",
				height: "100%",
			}
		});
	backgroundImage.src = getHrefForFamiliarImage(lastViewedImageIndex);

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

			let copyModelText = bIsLora ? `<lora:${nameText}:1:1>` : `(embedding:${nameText}:1)`;

			if (bIsLora && trainedWords.length > 0) {
				//Copy all
				let copyAllText = copyModelText + " " + trainedWords;
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📋",
						}),
						`Copy lora as a1111-style text + trained words (${copyAllText})`,
						function (e) {
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
						function (e) {
							copyToClipboard(trainedWords)
							e.preventDefault();
						}
					)
				);
			}

			// Copy model text button
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "📜",
					}),
					bIsLora ? `Copy lora as a1111-style text (${copyModelText})` : `Copy embedding as comfy-style text (${copyModelText})`,
					function (e) {
						copyToClipboard(copyModelText)
						e.preventDefault();
					}
				)
			);

			// Go to civit.ai link
			if (modelId) {
				const href = `https://civitai.com/models/${modelId}`;
				buttonsRow.appendChild(
					createButton(
						$el("a", {
							target: "_blank",
							href,
							textContent: "🔗",
						}),
						`View model on civit.ai (${href})`,
						function (e) { } // Empty function, link handled by href
					)
				);
			}
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
				textContent: nameToUse,
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

	//console.log("nameToUse: " + nameToUse);

	const modelElement =
		$el("div", {
			id: "extra-networks-card",
			"data-name": nameToUse,
			style: {
				textAlign: 'center',
				objectFit: 'var(--div-fit, contain)',
				height: 'calc(var(--max-size) * 1vh)',
				borderRadius: '4px',
				position: "relative",
				aspectRatio: '0.67',
			},
		});

	modelElement.appendChild(backgroundImage);
	const leftImageSwitchButton = createImageSwitchButton(true);
	if (leftImageSwitchButton) { modelElement.appendChild(leftImageSwitchButton); }
	const rightImageSwitchButton = createImageSwitchButton(false);
	if (rightImageSwitchButton) { modelElement.appendChild(rightImageSwitchButton); }
	modelElement.appendChild(createImageCounterElement());
	modelElement.appendChild(createButtonToolbar());
	modelElement.appendChild(createNameAndTagContainer());

	modelElement.title = JSON.stringify(infoMap);

	// Sorting meta information
	modelElement.filename = nameText;
	modelElement.friendlyName = nameToUse;
	modelElement.file_age = familiars.file_age;

	modelElement.searchTerms = `${nameToUse}, ${trainedWords}, ${tags.join(', ')}`;

	modelElement.draggable = true;
	modelElement.addEventListener("dragstart", function (event) {
		const bTakeAlternatePath = event.ctrlKey;
		// Set data to be transferred during drag
		if (bTakeAlternatePath) {
			console.log ('bTakeAlternatePath');
		} else {
			event.dataTransfer.setData('text/plain', `${type}=${familiars.full_name}`);
		}
	});

	return modelElement;
}