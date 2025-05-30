import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";
import { utilitiesInstance } from "../../common/Utilities.js"

import { 
	setting_CopyLoraTextPattern_Default, setting_ModelCardAspectRatio, 
	setting_CopyModelTrainedWordsEndCharacter_Default as setting_CopyModelTrainedWordsEndCharacter_Default, 
	setting_ModelRules
} from "../../common/SettingsManager.js";

import { ModalManager } from "../../common/ModalManager.js";
import { ModelEditForm, FormObject, FormInfo } from "../../common/ModelEditForm.js";
import { findFirstImageDrawerInstanceWithGivenContext } from "../Core/ImageDrawerModule.js";

const NoImagePlaceholder = new URL(`../../assets/NoImage.png`, import.meta.url);

let cachedLorasObject = undefined;
let cachedEmbeddingsObject = undefined;

/**
 * Gets a list of lora names
 * @returns An array of script urls to import
 */
export async function getLoras(bForceRefresh = false) {
	if (bForceRefresh || !cachedLorasObject) {
		const resp = await api.fetchApi("/jnodes_model_items?type=loras", { cache: "no-store" });
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
		const resp = await api.fetchApi("/jnodes_model_items?type=embeddings", { cache: "no-store" });
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

export async function createExtraNetworkCard(nameText, familiars, type, imageDrawerInstance) {

	if (!nameText) {
		return;
	}

	// console.log(familiars);

	const bIsLora = type == "loras";

	const modelElement =
		$el("div.extraNetworksCard", {
			id: "extra-networks-card",
			style: {
				textAlign: "center",
				objectFit: "var(--div-fit, contain)",
				borderRadius: "4px",
				position: "relative",
				aspectRatio: setting_ModelCardAspectRatio.value,
			},
		});

	modelElement.fileInfo = {};

	let cardInfo = {
		nameText: nameText,
		trainedWords: "",
		tags: [],
		modelId: undefined, // The base model ID for civit.ai. Not specific to any version of the model.
		modelVersionId: undefined, // The model version ID, specific to a certain version of the model.
		lastViewedImageIndex: 0,
	}

	let userCardInfoOverrides = {
		friendlyName: "",
		userTags: "",
		overrideWithUserTags: false,
		userTrainedWords: "",
		overrideWithUserTrainedWords: false,
		preferredDefaultPreviewIndex: 1,
		defaultWeightModel: 1.0,
		defaultWeightClip: 1.0,
		loraTextPatternOverride: "",
		linkOverride: "",
	}

	function getModelRules() {

		if (setting_ModelRules.value?.length > 0) {

			for (const rules of setting_ModelRules.value) {

				if (rules.MatchingDirectoryRegex) {

					try {
						const regex = utilitiesInstance.parseRegexFromInputWidget(rules.MatchingDirectoryRegex);
						if (regex?.test(familiars.full_name)) {
							return rules;
						}
					} catch (e) {
						console.warn("Invalid regex in model rule:", rules.MatchingDirectoryRegex, e);
					}
				}
			}
		}
		return null;
	}

	function getCopyLoraTextPattern() {

		const rules = getModelRules();

		if (rules?.CopyLoraTextPattern) {

			return rules.CopyLoraTextPattern;
		}

		return setting_CopyLoraTextPattern_Default.value;
	}

	function getUserCardInfoFormObjects() {

		const getDefaultValueFromData = (key, defaultValue) => {

			if (userCardInfoOverrides[key]) {

				return userCardInfoOverrides[key];
			}

			return defaultValue;
		}

		const formObjects = [
			new FormObject(
				"friendlyName", "text", "", 
				"",
				"The name to display in the card"
			),
			new FormObject(
				"userTags", "text", "", 
				"",
				"Tags that aid with search and organization, separated by comma."
			),
			new FormObject(
				"overrideWithUserTags", "checkbox", false, 
				"",
				"Whether to replace the tags from Civit.ai with entered user tags (true) or add to them (false)"
			),
			new FormObject(
				"userTrainedWords", "text", "", 
				"",
				"Words or whole prompts that trigger the model to work"
			),
			new FormObject(
				"overrideWithUserTrainedWords", "checkbox", false, 
				"",
				"Whether to replace the trained words from Civit.ai with entered user trained words (true) or add to them (false)"
			),
			new FormObject(
				"preferredDefaultPreviewIndex", "number", 1, 
				"",
				"The index of the preview image or video you want to show on the model card by default. Values lower than 1 or higher than the number of total previews will be clamped",
				{min: 1, max: familiars.familiar_images.length}
			),
			new FormObject(
				"defaultWeightModel", "number", 1.0, 
				"",
				"The weight used for the model when copying a lora as text",
				{step: 0.01}
			),
			new FormObject(
				"defaultWeightClip", "number", 1.0, 
				"",
				"The weight used for the clip when copying a lora as text",
				{step: 0.01}
			),
			new FormObject(
				"loraTextPatternOverride", "text", "", 
				"",
				"Define the way text loras are constructed when copied to the clipboard for this specific lora. DOES NOT APPLY TO OTHER MODEL TYPES. " +
					"put variable names in double braces '{{}}'. Variables are 'modelName', 'strengthModel', and 'strengthClip'. " +
					`For example, '${setting_CopyLoraTextPattern_Default.getDefaultValue()}'`,
				{},
				(inputWidget) => { 
					inputWidget.value = getCopyLoraTextPattern() || "<lora:{{modelName}}:{{strengthModel}}:{{strengthClip}}>";;
				 }
			),
			new FormObject(
				"linkOverride", "text", "", 
				"",
				"A hyperlink to the resource, if it was downloaded. Leave blank to construct a link from other info sources automatically."
			),
		];

		for (let formObject of formObjects) {
			formObject._defaultValue = 
				getDefaultValueFromData(formObject._name, formObject._defaultValue);
		}

		return formObjects;
	}

	function getNameToUse() {

		if (userCardInfoOverrides.friendlyName) {
			return `${userCardInfoOverrides.friendlyName} (${cardInfo.lora_meta_name ? cardInfo.lora_meta_name : cardInfo.nameText})`;
		} else if (cardInfo.lora_meta_name) {
			return cardInfo.lora_meta_name;
		} else if (cardInfo.civit_model_name) {
			return cardInfo.civit_model_name;
		}

		return cardInfo.nameText;
	}

	function getTags() {

		function commaSeparatedStringToTags(inString) {
			const split = inString.split(",");

			return split.map(element => element.trim());
		}

		if (userCardInfoOverrides.userTags) {
			const asArray = commaSeparatedStringToTags(userCardInfoOverrides.userTags);
			if (userCardInfoOverrides.overrideWithUserTags) {
				return asArray;
			} else if (cardInfo.tags) {
				return [...new Set(cardInfo.tags.concat(asArray))];
			}
		} else if (cardInfo.tags) {
			return cardInfo.tags;
		}
	}

	function getTrainedWords() {

		let trainedWords = 
			userCardInfoOverrides.overrideWithUserTrainedWords ? 
			userCardInfoOverrides.userTrainedWords :
			cardInfo.trainedWords + userCardInfoOverrides.userTrainedWords;

		if (trainedWords) {
			trainedWords = trainedWords.trim()

			function getEndCharacter() {

				const rules = getModelRules();

				if (rules?.CopyModelTrainedWordsEndCharacter) {

					return rules.CopyModelTrainedWordsEndCharacter;
				}

				return setting_CopyModelTrainedWordsEndCharacter_Default.value;
			}

			const endCharacter = getEndCharacter();

			if (!trainedWords.endsWith(endCharacter.trim())) {
				trainedWords += endCharacter;
			}
			trainedWords = trainedWords.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\"/g, '"');
		}

		return trainedWords;
	}

	function getModelLink() {

		if (userCardInfoOverrides.linkOverride) {
			return userCardInfoOverrides.linkOverride;
		}

		let href = `https://civitai.com/models/${cardInfo.modelId}`;
		if (cardInfo.modelVersionId) {
			href = href + `?modelVersionId=${cardInfo.modelVersionId}`;
		}

		return href;
	}

	// Load the first image as the object cover image. 
	// If one does not exist, fall back to placeholder image.
	function getHrefForFamiliarImage(index) {
		if (familiars?.familiar_images?.length > 0 && familiars.familiar_images[index]) {

			if (familiars.familiar_images[index].hasOwnProperty("file_name")) {

				const file_name = familiars.familiar_images[index].file_name;
				return `/jnodes_view_image?filename=${encodeURIComponent(file_name)}&type=${type}`;
			}
		}
		return NoImagePlaceholder;
	}

	async function parseUserCardInfo(infoString) {
		try {
			const loadedJson = JSON.parse(infoString);

			if (loadedJson) {
				for (const key in userCardInfoOverrides) {
					if (key in loadedJson) {
						userCardInfoOverrides[key] = loadedJson[key];
					}
				}
			}
		} catch {
			console.log(`Could nat parse user card info from text, are you adding a trailing comma to the last member of the json? ${infoString}`);
		}
	}

	async function parseFamiliarInfos() {
		let infoMap = {};
		if (familiars?.metadata) {
			infoMap["lora_meta"] = familiars.metadata;
		}
		if (familiars?.familiar_infos?.length > 0) {
			for (const familiar_info of familiars.familiar_infos) {
				try {

					if (familiar_info.file_name.includes(".user.info")) {
						parseUserCardInfo(familiar_info.loaded_text);
						continue;
					}

					const bIsFullInfo = familiar_info.file_name.includes("civit.full.info");
					let loadedJson = JSON.parse(familiar_info.loaded_text);
					if (loadedJson) {
						let jsonKeys = Object.keys(loadedJson);

						for (const key of jsonKeys) {

							let keyTouse = key;

							if (key == "id") {
								if (bIsFullInfo) {
									keyTouse = "modelId";
								} else {
									keyTouse = "modelVersionId";
								}
							}
							infoMap[keyTouse] = loadedJson[key];
						}
					}
				} catch (jsonError) {

					// pass
				}
			}
		}

		// Prefer user set friendlyName over meta or data from civit.ai
		if (infoMap.lora_meta) {
			if (infoMap.lora_meta?.modelspec?.title
				&& infoMap.lora_meta.modelspec.title.trim() != ""
				&& infoMap.lora_meta.modelspec.title.trim() != cardInfo.nameText.trim()
			) {
				cardInfo.lora_meta_name = `${infoMap.lora_meta.modelspec.title} (${cardInfo.nameText})`;
			} else if (infoMap.ss_output_name 
				&& infoMap.ss_output_name.trim() != ""
				&& infoMap.ss_output_name.trim() != cardInfo.nameText.trim()
			) {
				cardInfo.lora_meta_name = `${infoMap.ss_output_name} (${cardInfo.nameText})`;
			}
		} else if (infoMap.model && infoMap.model.name) {
			if (infoMap.model.name.trim() != cardInfo.nameText.trim()) {
				cardInfo.civit_model_name = `${infoMap.model.name} (${cardInfo.nameText})`;
			}
		}

		// Prefer user set cardInfo.tags over data from civit.ai
		if (infoMap.tags) {
			for (const tag of infoMap.tags) {
				cardInfo.tags.push(tag.trim());
			}
		}

		// Prefer user set cardInfo.trainedWords over data from civit.ai over meta
		if (infoMap.trainedWords && infoMap.trainedWords.length > 0) {
			
			if (Array.isArray(infoMap.trainedWords)) {
				cardInfo.trainedWords = infoMap.trainedWords.join(", ")
			} else {
				cardInfo.trainedWords = infoMap.trainedWords;
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

				cardInfo.trainedWords += ` ${tag},`;
			}
		}

		cardInfo.modelVersionId = infoMap.modelVersionId || undefined;
		cardInfo.modelId = infoMap.modelId || cardInfo.modelVersionId || undefined;

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

			let newHref = modelElement.fileInfo.imageHref = getHrefForFamiliarImage(backgroundImageContainer.lastViewedImageIndex);
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

		return $el("button", {
			style: {
				position: "absolute",
				top: "50%",
				left: bIsLeft ? "5%" : "85%",
				transformOrigin: "center",
				fontSize: getLoraTextFontSize(1),
			},
			onclick: bIsLeft ? onClickLeft : onClickRight,
		}, [
			$el("label", {
				textContent: bIsLeft ? "<" : ">",
			}),
		]);
	}

	const startIndex = utilitiesInstance.clamp(
		userCardInfoOverrides.preferredDefaultPreviewIndex ? 
		userCardInfoOverrides.preferredDefaultPreviewIndex - 1: 
		cardInfo.lastViewedImageIndex,
		0, familiars.familiar_images.length - 1);
	const backgroundImageContainer =
		$el("div", {
				id: "backgroundImageContainer",
				lastViewedImageIndex: startIndex,
				style: {
					width: "100%",
					height: "100%",
				}
			},
		);
	modelElement.fileInfo.imageHref = backgroundImageContainer.dataSrc = getHrefForFamiliarImage(startIndex);

	backgroundImageContainer.backgroundImage = $el("img");
	backgroundImageContainer.appendChild(backgroundImageContainer.backgroundImage);
	Object.assign(backgroundImageContainer.backgroundImage.style, {
		objectFit: "cover",
		width: "100%",
		height: "100%",
		display: "none"
	});

	backgroundImageContainer.backgroundVideo = $el("video");
	backgroundImageContainer.backgroundVideo.setAttribute("NoVideoControl", "");
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

			imageCounterLabel.textContent =
				`${backgroundImageContainer.lastViewedImageIndex + 1}/${familiars.familiar_images.length}`
		}
	}

	const setPreferredDefaultPreviewIndexToCurrent = () => {

		if (familiars.familiar_images.length < 1) {
			return;
		}

		userCardInfoOverrides.preferredDefaultPreviewIndex = backgroundImageContainer.lastViewedImageIndex + 1;

		saveUserModelInfo(JSON.stringify(userCardInfoOverrides));
	};

	function createImageCounterElement() {

		imageCounterLabel = $el("label", {
			textContent: "No preview images found",
		});

		const imageCounterElement = utilitiesInstance.createDarkContainer();

		imageCounterElement.style.top = "2%";
		imageCounterElement.style.right = "2%";
		imageCounterElement.appendChild(imageCounterLabel);
		imageCounterElement.title = familiars.familiar_images.length > 0 ? "Click to set default image" : "No preview images found";
		imageCounterElement.classList.add("JNodes-interactive-container");

		// Click to set default image
		imageCounterElement.addEventListener("click", setPreferredDefaultPreviewIndexToCurrent);

		updateImageCounterText();

		return imageCounterElement;
	}

	async function saveUserModelInfo(infoJson) {

		const response = await api.fetchApi(
			"/jnodes_save_model_user_info", { 
				method: "POST", 
				body: JSON.stringify(
					{ "type": type, "item_name": familiars.full_name, "text": infoJson }
				), 
				cache: "no-store" 
			}
		);

		try {
			// Decode into a string
			const decodedString = await utilitiesInstance.decodeReadableStream(response.body);

			const asJson = JSON.parse(decodedString);

			if (asJson?.success) {
				parseUserCardInfo(infoJson);
				modelElement.reinstantiate();
			}

		} catch (e) {
			console.error(`Could not save user info for "${familiars.full_name}" because ${e}: ${infoJson}`)
		}
	}

	function createButtonToolbar() {

		function createButtons() {
			if (!buttonsRow) { return; }

			function createButton(foregroundElement, tooltipText, onClickFunction, dragText) {
				const buttonElement = $el("button.JNodes-extra-networks-toolbar-button", {
					title: tooltipText,
					style: {
						background: "none",
						border: "none",
						padding: 0,
					}
				}, [
					foregroundElement
				]);

				if (onClickFunction) {
					buttonElement.addEventListener("click", onClickFunction);
				}

				if (dragText) {
					buttonElement.draggable = true;
					buttonElement.addEventListener("dragstart", function (event) {
						// Set data to be transferred during drag
						event.dataTransfer.setData("text/plain", dragText);
					});
				}

				buttonElement.classList.add("JNodes-interactive-container"); // Creates highlighting and mouse down color changes for feedback

				return buttonElement;
			}

			const getModelInfo = (nameOverride = undefined) => {

				return {
					modelName: nameOverride ? nameOverride : cardInfo.nameText, // Dynamic model name
					strengthModel: userCardInfoOverrides.defaultWeightModel,    // Default model weight
					strengthClip: userCardInfoOverrides.defaultWeightClip      // Default clip weight
				};
			};

			const getModelText = () => {
				// Check if Lora is enabled
				if (!bIsLora) {
					return `(embedding:${cardInfo.nameText}:1)`; // Non-Lora text pattern
				}

				// Define replacement values
				const replacements = getModelInfo();
			
				// Access the template pattern
				// local model override is the first priority, then model rules, then settings default, then fallback pattern

				const settingPattern = 
					userCardInfoOverrides.loraTextPatternOverride || 
					getCopyLoraTextPattern() ||
					"<lora:{{modelName}}:{{strengthModel}}:{{strengthClip}}>";
				
				// Replace placeholders with values
				const formatted = settingPattern.replace(/{{(.*?)}}/g, (match, key) => {
					return replacements[key] !== undefined ? replacements[key] : match; // Fallback to original placeholder if no match
				});
			
				return formatted; // Return the formatted string
			};

			let trainedWords = getTrainedWords();

			if (bIsLora && trainedWords && trainedWords.length > 0) {
				const getCopyAllText = () => {
					return getModelText() + " " + trainedWords;
				};

				// Copy Lora text + trained words button
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📋",
							style: {
								cursor: "pointer",
							}
						}),
						`Copy lora as a1111-style text + trained words (${getCopyAllText()})`,
						function (e) {

							utilitiesInstance.copyToClipboard(getCopyAllText());
							e.preventDefault();
						},
						JSON.stringify({modelInsertText: getCopyAllText()})
					)
				);

				// Copy trained words button
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: "📝",
							style: {
								cursor: "pointer",
							}
						}),
						`Copy trained words (${trainedWords})`,
						function (e) {
							utilitiesInstance.copyToClipboard(trainedWords)
							e.preventDefault();
						},
						JSON.stringify({modelInsertText: trainedWords})
					)
				);
			}

			// Copy model text button
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "📜",
						style: {
							cursor: "pointer",
						}
					}),
					bIsLora ? `Copy lora as a1111-style text (${getModelText()})` : `Copy embedding as comfy-style text (${getModelText()})`,
					function (e) {
						utilitiesInstance.copyToClipboard(getModelText())
						e.preventDefault();
					},
					JSON.stringify({modelInsertText: getModelText()})
				)
			);

			if (bIsLora) {
				// Drag node button
				buttonsRow.appendChild(createButton(
					$el("label", {
						textContent: "📓",
						style: {
							cursor: "grab",
						}
					}),
					`Drag the current model into the graph to create a node with the name ${familiars.full_name}`,
					undefined,
					JSON.stringify({modelInfo: getModelInfo(familiars.full_name)})
				));
			}

			// Go to model link
			if (cardInfo.modelId || userCardInfoOverrides.linkOverride) {
				const href = getModelLink();
				buttonsRow.appendChild(
					createButton(
						$el("a", {
							target: "_blank",
							href,
							textContent: "🔗",
							style: {
								cursor: "pointer",
							}
						}),
						`View model in browser (${href})`
					)
				);
			}

			// Paste image/video URI
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "🖼️",
						style: {
							cursor: "pointer",
						}
					}),
					`Paste image or video URI/URL from the clipboard to add a new preview image and set it as default. ` +
					`Any unsecured image or video should work, just right-click->Copy image/video address`,
					modelElement.pasteImageOrVideoLinkAsPreview
				)
			);

			// Edit model user data button
			buttonsRow.appendChild(
				createButton(
					$el("label", {
						textContent: "✏️",
						style: {
							cursor: "pointer",
						}
					}),
					`Edit user-set model information`,
					function (e) {
						const modelEditForm = new ModelEditForm(imageDrawerInstance);
						const modalManager = new ModalManager(imageDrawerInstance);
						const formInfo = new FormInfo();
						formInfo.itemToEdit = cardInfo.nameText;
						formInfo.buttonText = "Save";
						formInfo.onButtonClickFunction = async (formResponse) => {

							if (formResponse) {
								await saveUserModelInfo(formResponse);
								modalManager.closeModal();
							}
						};

						modalManager.createModal(modelEditForm.createForm(getUserCardInfoFormObjects(), formInfo));

						// Remove focus from the currently focused element
						document.activeElement.blur();

						modelEditForm.focusFirstTextElement();
					}
				)
			);

			// Open in file manager
            {
                const baseLabelText = "📂";
                buttonsRow.appendChild(
                    createButton(
                        $el("label", {
                            textContent: baseLabelText,
							style: {
								cursor: "pointer",
							}
                        }),
                        "Open this file's containing directory in your OS's default file manager.",
                        (e) => {
                            modelElement.showInFileManager();
                        }
                    )
                );
            }
			
			// ✉️ Send current image to metadata viewer
			{
				const baseLabelText = "✉️";
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: baseLabelText,
							style: {
								cursor: "pointer",
							}
						}),
						"Send Current Image to Metadata Viewer: Send this to any drawer instance with the 'Metadata Viewer' context currently selected. If it's in a sidebar, you may have to switch manually. " +
						"If no drawer instance is using the 'Metadata Viewer' context, the current instance will change to it. " +
						"Note that not all items will have metadata to show, so when switching it may seem that nothing has happened.",
						async function (e) {

							const metaDataContextName = "Metadata Viewer";
							let metadataViewerInstance = findFirstImageDrawerInstanceWithGivenContext(metaDataContextName);
							
							if (!metadataViewerInstance) { // Need to switch to it

								const imageDrawerContextSelectorInstance = imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
								imageDrawerContextSelectorInstance.setOptionSelected(metaDataContextName);
								metadataViewerInstance = imageDrawerInstance;
							}

							if (metadataViewerInstance) {

								const imageDrawerContextSelectorInstance = metadataViewerInstance.getComponentByName("ImageDrawerContextSelector");
								const metadataViewerContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();

								const response = await fetch(modelElement.fileInfo.imageHref);
								let blob = await response.blob();

								if (blob.type === "application/octet-stream" && modelElement.fileInfo.file?.format) {
									blob = new Blob([blob], { type: modelElement.fileInfo.file.format });
								}

								metadataViewerContextObject.setImageOrVideo(blob, true);
							}
						}
					)
				);
			}

			// ✉️ Send model info to metadata viewer
			{
				const baseLabelText = "📦";
				buttonsRow.appendChild(
					createButton(
						$el("label", {
							textContent: baseLabelText,
							style: {
								cursor: "pointer",
							}
						}),
						"Send Model Info to Metadata Viewer: Send this to any drawer instance with the 'Metadata Viewer' context currently selected. If it's in a sidebar, you may have to switch manually. " +
						"If no drawer instance is using the 'Metadata Viewer' context, the current instance will change to it. " +
						"Note that not all items will have metadata to show, so when switching it may seem that nothing has happened.",
						async function (e) {

							const metaDataContextName = "Metadata Viewer";
							let metadataViewerInstance = findFirstImageDrawerInstanceWithGivenContext(metaDataContextName);
							
							if (!metadataViewerInstance) { // Need to switch to it

								const imageDrawerContextSelectorInstance = imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
								imageDrawerContextSelectorInstance.setOptionSelected(metaDataContextName);
								metadataViewerInstance = imageDrawerInstance;
							}

							if (metadataViewerInstance) {

								const imageDrawerContextSelectorInstance = metadataViewerInstance.getComponentByName("ImageDrawerContextSelector");
								const metadataViewerContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();

								const response = await fetch(modelElement.fileInfo.imageHref);
								let blob = await response.blob();

								if (blob.type === "application/octet-stream" && modelElement.fileInfo.file?.format) {
									blob = new Blob([blob], { type: modelElement.fileInfo.file.format });
								}

								let modelInfo = modelElement.fileInfo;
								modelInfo.familiars = familiars; 
								modelInfo.name = getNameToUse();

								metadataViewerContextObject.setModel(modelInfo, blob, true);
							}
						}
					)
				);
			}
		}

		const buttonsRow = $el("div", {
			style: {
				width: "100%",
				display: "flex",
				flexDirection: "row",
			}
		});

		const buttonToolbarContainerElement = utilitiesInstance.createDarkContainer();

		buttonToolbarContainerElement.style.top = "2%";
		buttonToolbarContainerElement.style.left = "2%";
		buttonToolbarContainerElement.appendChild(buttonsRow);

		createButtons();

		return buttonToolbarContainerElement;
	}

	function createNameAndTagContainer() {

		function createTagButton(tagName) {
			const buttonElement = $el("button", {
				title: `Click to search "${tagName}"`,
				style: {
					background: "none",
					border: "none",
					padding: "0",
				}
			}, [
				$el("label", {
					textContent: tagName,
					style: {
						fontSize: getLoraTextFontSize(1),
						color: "rgb(250,250,250)",
						wordBreak: "keep-all",
					}
				})
			]);

			buttonElement.addEventListener("click", async () => {
				const imageDrawerSearchInstance = imageDrawerInstance.getComponentByName("ImageDrawerSearch");
				imageDrawerSearchInstance.setSearchTextAndExecute(tagName);
			});

			return buttonElement;
		}

		const tagButtonContainer = $el("div", {
			id: "tag-container",
			style: {
				display: "flex",
				flexWrap: "wrap",
				justifyContent: "center",
				gap: "3.5%",
				width: "90%",
			}
		});

		const mainContainer = $el("div", {
			id: "darkened-text-bg",
			style: {
				position: "absolute",
				bottom: 0,
				left: 0,
				width: "100%",
				backgroundColor: utilitiesInstance.getDarkColor(),
				minHeight: "15%",
				maxHeight: "90%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}
		}, [
			$el("label", {
				textContent: getNameToUse(),
				style: {
					fontSize: getLoraTextFontSize(1.3),
					top: "5%",
					wordBreak: "break-all",
				}
			}),
			tagButtonContainer
		]);

		for (const tag of getTags()) {
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

	modelElement.onObserverIntersect = function () {
		modelElement.forceLoad();
	}

	modelElement.reinstantiate = async function() {

		let bFoundUserInfo = false;
		for (let familar_info of familiars.familiar_infos) {

			if (familar_info.file_name.includes(".user.info")) {

				familar_info.loaded_text = JSON.stringify(userCardInfoOverrides);
				bFoundUserInfo = true;
			}
		}

		if (!bFoundUserInfo) {

			familiars.familiar_infos.push( 
				{ file_name: `${cardInfo.nameText}.user.info`, loaded_text: JSON.stringify(userCardInfoOverrides) } );
		}

		const newModelElement = await createExtraNetworkCard(cardInfo.nameText, familiars, type, imageDrawerInstance);

		const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
		imageDrawerListInstance.replaceImageListChild(this, newModelElement);

		delete this;
	}

	modelElement.showInFileManager = async function () {

		const call = `/jnodes_request_open_file_manager?filename=${encodeURIComponent(familiars.full_name)}&type=${type}`;
		api.fetchApi(call, { method: "POST" });
	}

	modelElement.pasteImageOrVideoLinkAsPreview = async () => {
		try {
			const clipboardText = await navigator.clipboard.readText();
			if (!clipboardText) {
				console.error("Error reading clipboard");
				return;
			}
	
			// Send the URL to the backend for processing
			const response = await api.fetchApi(
				`/jnodes_save_image_as_model_preview?filename=${encodeURIComponent(familiars.full_name)}&type=${type}`, 
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url: clipboardText }),
				}
			);
	
			const result = await response.json();

			if (result.success) {
				const newFilename = result.file_name;

				familiars.familiar_images.push({file_name: `${familiars.containing_directory}/${newFilename}`});

				backgroundImageContainer.lastViewedImageIndex = familiars.familiar_images.length - 1;

				setPreferredDefaultPreviewIndexToCurrent();

				modelElement.reinstantiate();
			} else {
				console.error(result.error);
			}
		} catch (error) {
			console.error("Error receiving result from jnodes_save_image_as_model_preview:", error);
		}
	};

	modelElement.appendChild(backgroundImageContainer);
	const leftImageSwitchButton = createImageSwitchButton(true);
	if (leftImageSwitchButton) { modelElement.appendChild(leftImageSwitchButton); }
	const rightImageSwitchButton = createImageSwitchButton(false);
	if (rightImageSwitchButton) { modelElement.appendChild(rightImageSwitchButton); }
	modelElement.appendChild(createImageCounterElement());
	modelElement.appendChild(createButtonToolbar());
	modelElement.appendChild(createNameAndTagContainer());

	modelElement.title = JSON.stringify(infoMap, null, "\t");
	modelElement.imageDrawerInstance = imageDrawerInstance;

	// Sorting meta information
	modelElement.filename = cardInfo.nameText;
	modelElement.friendlyName = getNameToUse();
	modelElement.file_age = familiars.file_age;
	modelElement.lora_meta = familiars.metadata;
	modelElement.path = familiars.full_name;

	modelElement.searchTerms = 
		`${familiars.full_name} ${modelElement.filename} ${modelElement.friendlyName} ${getTrainedWords()} ${getTags().join(" ")} ${modelElement.lora_meta}`;

	modelElement.draggable = true; // Made draggable to allow image drag and drop onto canvas / nodes / file explorer

	modelElement.addEventListener('dragstart', function (event) {
		event.dataTransfer.setData('text/jnodes_image_drawer_payload', `${JSON.stringify(modelElement.fileInfo)}`);
	});

	return modelElement;
}