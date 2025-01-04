import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";
import { utilitiesInstance } from "../../common/Utilities.js"

import { setting_ModelCardAspectRatio } from "../../common/SettingsManager.js";
import { imageDrawerComponentManagerInstance } from "../Core/ImageDrawerModule.js";

const NoImagePlaceholder = new URL(`../../assets/NoImage.png`, import.meta.url);

let cachedLorasObject = undefined;
let cachedEmbeddingsObject = undefined;

/**
 * Gets a list of lora names
 * @returns An array of script urls to import
 */
export async function getLoras(bForceRefresh = false) {
	if (bForceRefresh || !cachedLorasObject) {
		const resp = await api.fetchApi('/jnodes_model_items?type=loras', { cache: "no-store" });
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
		const resp = await api.fetchApi('/jnodes_model_items?type=embeddings', { cache: "no-store" });
		const asJson = await resp.json();
		//console.log("Size of embeddings info: " + JSON.stringify(asJson).length)
		cachedEmbeddingsObject = asJson;
		return asJson;
	}

	return cachedEmbeddingsObject;
}

function getLoraTextFontSize(emMultiplier) {
	const out = `${emMultiplier}em`;
	//console.log(out);
	return out;
}

export async function createExtraNetworkCard(nameText, familiars, type) {

	if (!nameText) {
		return;
	}

	// console.log(familiars);

	let nameToUse = nameText;
	let trainedWords = "";
	let tags = [];
	let modelId; // The base model ID for civit.ai. Not specific to any version of the model.
	let lastViewedImageIndex = 0;

	const bIsLora = type == "loras";

	const modelElement =
		$el("div.extraNetworksCard", {
			id: "extra-networks-card",
			"data-name": nameToUse,
			style: {
				textAlign: 'center',
				objectFit: 'var(--div-fit, contain)',
				borderRadius: '4px',
				position: "relative",
				aspectRatio: setting_ModelCardAspectRatio.value,
			},
		});

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
		if (familiars?.metadata) {
			infoMap["lora_meta"] = familiars.metadata;
		}
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

		// Prefer user set friendlyName over meta or data from civit.ai
		if (infoMap.friendlyName) {
			if (infoMap.friendlyName.trim() != nameToUse.trim()) {
				nameToUse = `${infoMap.friendlyName} (${nameToUse})`;
			}
		} else if (infoMap.lora_meta) {
			if (infoMap.lora_meta?.modelspec?.title
				&& infoMap.lora_meta.modelspec.title.trim() != ""
				&& infoMap.lora_meta.modelspec.title.trim() != nameToUse.trim()
			) {
				nameToUse = `${infoMap.friendlyName.modelspec.title} (${nameToUse})`;
			} else if (infoMap.ss_output_name 
				&& infoMap.ss_output_name.trim() != ""
				&& infoMap.ss_output_name.trim() != nameToUse.trim()
			) {
				nameToUse = `${infoMap.ss_output_name} (${nameToUse})`;
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

		// Prefer user set trainedWords over data from civit.ai over meta
		if (infoMap.userTrainedWords) {

			if (Array.isArray(infoMap.userTrainedWords)) {
				trainedWords = infoMap.userTrainedWords.join(", ")
			} else {
				trainedWords = infoMap.userTrainedWords;
			}

		} else if (infoMap.trainedWords && infoMap.trainedWords.length > 0) {
			
			if (Array.isArray(infoMap.trainedWords)) {
				trainedWords = infoMap.trainedWords.join(", ")
			} else {
				trainedWords = infoMap.trainedWords;
			}

		} else {

			let tagMap = {};

			if (infoMap.lora_meta?.ss_tag_frequency) {
				const tagObject = JSON.parse(infoMap.lora_meta.ss_tag_frequency)
				for (const key of Object.keys(tagObject)) {
					for (const tag of Object.keys(tagObject[key])) {
						let trimmedTag = tag.trim();
						if (trimmedTag != "") {
							let frequency = tagObject[key][tag];
							tagMap[trimmedTag] = frequency;
						}
					}
				}
			} 

			if (Object.keys(tagMap).length > 1) {
				Object.entries(tagMap).sort(([keyA, valueA], [keyB, valueB]) => {
					// First, sort by value (numeric)
					if (valueA !== valueB) {
						return valueA - valueB;
					}
					// If values are the same, sort by key (alphabetically)
					return keyA.localeCompare(keyB);
				});
			}

			for (const tag of Object.keys(tagMap)) {

				trainedWords += ` ${tag},`;
			}
		}

		if (trainedWords) {
			trainedWords = trainedWords.trim()

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

		function updateBackgroundImageContainer() {

			backgroundImageContainer.backgroundImage.style.display = "none";
			backgroundImageContainer.backgroundVideo.style.display = "none";

			let newHref = getHrefForFamiliarImage(backgroundImageContainer.lastViewedImageIndex);
			let bIsVideoPreview = utilitiesInstance.isHrefVideo(newHref);

			if (bIsVideoPreview) {

				backgroundImageContainer.backgroundVideo.style.display = "block";
				backgroundImageContainer.backgroundVideo.src = newHref;
			} else {

				backgroundImageContainer.backgroundImage.style.display = "block";
				backgroundImageContainer.backgroundImage.src = newHref;
			}

			updateImageCounterText();
		}

		function onClickLeft(e) {
			backgroundImageContainer.lastViewedImageIndex -= 1;
			if (backgroundImageContainer.lastViewedImageIndex < 0) {
				backgroundImageContainer.lastViewedImageIndex = familiars.familiar_images.length - 1;
			}
		
			updateBackgroundImageContainer();
		}


		function onClickRight(e) {
			backgroundImageContainer.lastViewedImageIndex += 1;
			if (backgroundImageContainer.lastViewedImageIndex == familiars.familiar_images.length) {
				backgroundImageContainer.lastViewedImageIndex = 0;
			}
		
			updateBackgroundImageContainer();
		}

		return $el('button', {
			style: {
				position: "absolute",
				top: '50%',
				left: bIsLeft ? '5%' : '85%',
				transformOrigin: 'center',
				fontSize: getLoraTextFontSize(1),
			},
			onclick: bIsLeft ? onClickLeft : onClickRight,
		}, [
			$el("label", {
				textContent: bIsLeft ? "<" : ">",
			}),
		]);
	}

	const backgroundImageContainer =
		$el("div", {
				id: "backgroundImageContainer",
				lastViewedImageIndex: lastViewedImageIndex,
				style: {
					width: "100%",
					height: "100%",
				}
			},
		);
	backgroundImageContainer.dataSrc = getHrefForFamiliarImage(lastViewedImageIndex);

	backgroundImageContainer.backgroundImage = $el("img");
	backgroundImageContainer.appendChild(backgroundImageContainer.backgroundImage);
	Object.assign(backgroundImageContainer.backgroundImage.style, {
		objectFit: "cover",
		width: "100%",
		height: "100%",
		display: "none"
	});

	backgroundImageContainer.backgroundVideo = $el("video");
	backgroundImageContainer.appendChild(backgroundImageContainer.backgroundVideo);
	Object.assign(backgroundImageContainer.backgroundVideo.style, {
		objectFit: "cover",
		width: "100%",
		height: "100%",
		display: "none"
	});

	let imageCounterLabel;

	function updateImageCounterText() {
		if (imageCounterLabel) {
			if (familiars.familiar_images.length < 1) {
				return;
			}
			const CurrentImageIndex =
				parseInt(backgroundImageContainer.lastViewedImageIndex);
			imageCounterLabel.textContent =
				`${CurrentImageIndex + 1}/${familiars.familiar_images.length}`
		}
	}

	function createImageCounterElement() {

		imageCounterLabel = $el("label", {
			textContent: 'No preview images found',
		});

		const imageCounterElement = utilitiesInstance.createDarkContainer();

		imageCounterElement.style.top = '2%';
		imageCounterElement.style.right = '2%';
		imageCounterElement.appendChild(imageCounterLabel);

		updateImageCounterText();

		return imageCounterElement;
	}

	function createButtonToolbar() {

		function createButtons() {
			if (!buttonsRow) { return; }

			function createButton(foregroundElement, tooltipText, onClickFunction, dragText) {
				const buttonElement = $el("button.JNodes-extra-networks-toolbar-button", {
					title: tooltipText,
					style: {
						background: 'none',
						border: 'none',
						padding: 0,
					}
				}, [
					foregroundElement
				]);

				if (onClickFunction) {
					buttonElement.addEventListener('click', onClickFunction);
				}

				if (dragText) {
					buttonElement.draggable = true;
					buttonElement.addEventListener("dragstart", function (event) {
						// Set data to be transferred during drag
						event.dataTransfer.setData('text/plain', dragText);
					});
				}

				buttonElement.classList.add("JNodes-interactive-container"); // Creates highlighting and mouse down color changes for feedback

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
							style: {
								cursor: 'pointer',
							}
						}),
						`Copy lora as a1111-style text + trained words (${copyAllText})`,
						function (e) {
							utilitiesInstance.copyToClipboard(copyAllText)
							e.preventDefault();
						},
						`modelInsertText=${copyAllText}`
					)
				);

				// Copy trained words button
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📝",
							style: {
								cursor: 'pointer',
							}
						}),
						`Copy trained words (${trainedWords})`,
						function (e) {
							utilitiesInstance.copyToClipboard(trainedWords)
							e.preventDefault();
						},
						`modelInsertText=${trainedWords}`
					)
				);
			}

			// Copy model text button
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "📜",
						style: {
							cursor: 'pointer',
						}
					}),
					bIsLora ? `Copy lora as a1111-style text (${copyModelText})` : `Copy embedding as comfy-style text (${copyModelText})`,
					function (e) {
						utilitiesInstance.copyToClipboard(copyModelText)
						e.preventDefault();
					},
					`modelInsertText=${copyModelText}`
				)
			);


			if (bIsLora) {
				// Drag node button
				buttonsRow.appendChild(createButton(
					$el("label", {
						textContent: "📓",
						style: {
							cursor: 'grab',
						}
					}),
					`Drag the current model into the graph to create a node with the name ${familiars.full_name}`,
					undefined,
					`loraNodeName=${familiars.full_name}`
				));
			}

			// Go to civit.ai link
			if (modelId) {
				const href = `https://civitai.com/models/${modelId}`;
				buttonsRow.appendChild(
					createButton(
						$el("a", {
							target: "_blank",
							href,
							textContent: "🔗",
							style: {
								cursor: 'pointer',
							}
						}),
						`View model on civit.ai (${href})`
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

		const buttonToolbarContainerElement = utilitiesInstance.createDarkContainer();

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
						fontSize: getLoraTextFontSize(1),
						color: 'rgb(250,250,250)',
						wordBreak: 'keep-all',
					}
				})
			]);

			buttonElement.addEventListener('click', async () => {
				const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
				imageDrawerListInstance.setSearchTextAndExecute(tagName);
			});

			return buttonElement;
		}

		const tagButtonContainer = $el("div", {
			id: 'tag-container',
			style: {
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'center',
				gap: '3.5%',
				width: '90%',
			}
		});

		const mainContainer = $el("div", {
			id: 'darkened-text-bg',
			style: {
				position: "absolute",
				bottom: 0,
				left: 0,
				width: "100%",
				backgroundColor: utilitiesInstance.getDarkColor(),
				minHeight: '15%',
				maxHeight: '90%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			}
		}, [
			$el("label", {
				textContent: nameToUse,
				style: {
					fontSize: getLoraTextFontSize(1.3),
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

	backgroundImageContainer.backgroundImage.forceLoad = function () {

		backgroundImageContainer.backgroundVideo.style.display = "none";
		backgroundImageContainer.backgroundImage.src = backgroundImageContainer.dataSrc;
		backgroundImageContainer.backgroundImage.style.display = "block";
	}

	backgroundImageContainer.backgroundVideo.forceLoad = function () {

		backgroundImageContainer.backgroundImage.style.display = "none";
		backgroundImageContainer.backgroundVideo.src = backgroundImageContainer.dataSrc;
		backgroundImageContainer.backgroundVideo.style.display = "block";
	}

	backgroundImageContainer.initVideo = function () {

		backgroundImageContainer.backgroundVideo.autoplay = true;
		backgroundImageContainer.backgroundVideo.loop = true;
		backgroundImageContainer.backgroundVideo.controls = false;
		backgroundImageContainer.backgroundVideo.muted = true;
	}
	backgroundImageContainer.initVideo();

	modelElement.forceLoad = function () {

		if (utilitiesInstance.isHrefVideo(backgroundImageContainer.dataSrc)) {
			backgroundImageContainer.backgroundVideo.forceLoad();
		} else {
			backgroundImageContainer.backgroundImage.forceLoad();
		}
	}

	modelElement.onObserve = function () {
		modelElement.forceLoad();
	}

	//console.log("nameToUse: " + nameToUse);

	modelElement.appendChild(backgroundImageContainer);
	const leftImageSwitchButton = createImageSwitchButton(true);
	if (leftImageSwitchButton) { modelElement.appendChild(leftImageSwitchButton); }
	const rightImageSwitchButton = createImageSwitchButton(false);
	if (rightImageSwitchButton) { modelElement.appendChild(rightImageSwitchButton); }
	modelElement.appendChild(createImageCounterElement());
	modelElement.appendChild(createButtonToolbar());
	modelElement.appendChild(createNameAndTagContainer());

	modelElement.title = JSON.stringify(infoMap, null, "\t");

	// Sorting meta information
	modelElement.filename = nameText;
	modelElement.friendlyName = nameToUse;
	modelElement.file_age = familiars.file_age;
	modelElement.lora_meta = familiars.metadata

	modelElement.searchTerms = `${familiars.full_name} ${trainedWords} ${tags.join(' ')} ${modelElement.lora_meta}`;

	modelElement.draggable = true; // Made draggable to allow image drag and drop onto canvas / nodes / file explorer

	return modelElement;
}