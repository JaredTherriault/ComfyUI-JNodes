# ComfyUI-JNodes
 python and web UX improvements for ComfyUI

# Acknowledgement
 thank you to:
 * [Kosinkadink](https://github.com/Kosinkadink) for the original work in [VHS](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) on which SaveVideo and UploadVideo are based
 * [pythongosssss](https://github.com/pythongosssss) for the original [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js) element on which ImageDrawer is based
 * [Kijai](https://github.com/Kijai) for various code snippets that went into scripts such as statusTitle
 
# Web Features
 * ImageDrawer (image feed, lora picker, image history, etc) with search (crawling png_info) 
 * Lora Picker: a context option in ImageDrawer that displays your loras in a grid something like in a1111 and allows you to search for and copy the lora command in a1111 format (use [Coziness](https://github.com/skfoo/ComfyUI-Coziness) or something similar to support text loras) as well as the trained words. Click tag words to automatically search for similar local loras. Works best with loras downloaded with [Civit Downloader](https://www.ayamaru.com/more).

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/141ea856-e9b7-4ece-825d-be0aa1ceedf0)
 * Drag and drop from lora picker to canvas to add lora loaders (for people who don't want to use text loras)
 * EditAttention improvements (undo/redo support, remove spacing)
 * Status (progress) indicators (percentage in title, custom favicon, progress bar on floating menu)

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/5887a6e3-28e6-4a07-a1a4-5a20faa5f557)
 * Font control for textareas (see ComfyUI settings > JNodes)
 * Mouse over images in feed and history to see exif/png_info
 
# Python Nodes
 * Image Ouput Nodes
  
  * JNodes_SaveVideo: minor improvements over VHS_VideoCombine for adding meta data to gif/webp, file name control
  * JNodes_SaveImageWithOutput: Similar to Comfy's SaveImage and PreviewImage but whether it's saved to the output folder is a control, file name control

 * Parameter List Nodes
  * JNodes_GetParameterFromList: Gets a specific parameter as its actual type from a text list of defined parameters. See this [section] for more on text parameters.

 * Prompting Nodes

  * JNodes_TokenCounter: Count tokens in a given string based on the currently loaded model(s).

    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/4fa9ca93-3891-434f-8cb1-5e0f0e8ed8ee)
  * JNodes_AddOrSetMetaDataKey, JNodes_SetPositivePromptInMetaData, JNodes_SetNegativePromptInMetaData, JNodes_RemoveMetaDataKey: png_info manipulation nodes targeting a1111-style png_info
  * JNodes_SyncedStringLiteral: a multiline text node synced with external text files. Put the path in the "path_to_synced_txt" field and save/load from it.
  * JNodes_RemoveParseableDataForInference: Removes parameters from input text so the text alone can be used for inference.
  * JNodes_ParseDynamicPrompts: Yet another dynamic prompts implementation with randomization controls
  * JNodes_ParseWildcards: Yet another Wildcards implementation with some extra options like randomization control.
  * JNodes_RemoveCommentedText: just add # decorator before each line you want to be ignored or encapsulate specific text on a line with ## on either side "## Commented text ##". Decorator is configurable.

    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/05ae496f-94fa-4fb4-9686-b5f27a996d6b)

  * JNodes_SplitAndJoin: Splits input text and rejoins each item with a delimiter. Great for removing extraneous spaces and commas from a display prompt.
  * JNodes_TrimAndStrip: Simply removes whitespace from the head and tail of the given text.
  * JNodes_SearchAndReplace, JNodes_SearchAndReplaceFromList, JNodes_SearchAndReplaceFromFile: Search and replace text in any text, intended for prompts to change certain trigger words, for example an embedding named '3mb3dd1n4' can be changed to 'embedding'. The replacement words can come from a muiltline text or a text file (one per line, ex. 3mb3dd1n4->embedding) or can be entered directly.

 * Selector Nodes (Can be randomized based on seed (e.g. to select a random checkpoint name) and will return the value as a string)
  * JNodes_BooleanSelectorWithString, JNodes_ImageSizeSelector, JNodes_CheckpointSelectorWithString, JNodes_VaeSelectorWithString, JNodes_SamplerSelectorWithString, JNodes_SchedulerSelectorWithString, JNodes_ImageFormatSelector
  * JNodes_SelectRandomFileFromDirectory: Given a directory path, will return a random image or video path that can then be loaded using one of the media nodes

 * Media Nodes
  * JNodes_MediaInfoToString: Format [MediaInfo] as a string.
  * JNodes_BreakMediaInfo: Get the individual components of the [MediaInfo] structure.
  * JNodes_AppendReversedFrames: Takes in frames as an "IMAGE" pin and reverses them, then appends them. Creates a ping-pong style looped "video".
  * JNodes_LoadVisualMediaFromPath: Given a path to an image or video, will output all frames as an "IMAGE" pin. Start point and number of frames can be specified, as well as wther to deal in frames or a number of seconds, so if you know you want 16 frames starting 3 seconds into a video, you can mix and match. Can also skip a number of frames every cycle (to lighten the workload) and discard transparency.
  * JNodes_UploadVisualMedia: Similar to Comfy's LoadImage, but works for images and videos. You can also select where to upload the media, either to "temp" or "input" "/upload_media". Below the preview image is formatted metadata loaded from the image or video. You can drag images from the [ImageDrawer] onto this node or drag them in from your file explorer.

 * Misc Nodes
  * JNodes_GetTempDirectory, JNodes_GetOutputDirectory, JNodes_StringLiteral
  * JNodes_AnyToString: Turn any input into text or string (as python would stringify it for JSON)

# Caveats
 There are some incompatibilities with some Comfy extensions and some popular extensions. They can be optionally disabled with this suite.
 Please use the JNodes Extension Management setting in Settings > JNodes > Extension Management to disable the following extensions by unchecking them:
 * pysssss.ImageFeed should be disabled as ImageDrawer relaces it entirely.
 * mtb.ImageFeed can be disabled if you don't want to see it in addition to ImageDrawer. mtb.ImageFeed is designed to only load if pysssss.ImageFeed is not loaded.
 * pysssss.FaviconStatus can be disabled if you'd like to use your own custom favicons or see the progress percentage in the title or tab. This is optional.
 * Comfy.DynamicPrompts can be disabled if you're using another dynamic prompts solution, such as the one included with this suite. If this is enabled, the included solution can't operate.
 * Comfy.EditAttention can be disabled if you would prefer to use a similar system included in this suite (which supports undo/redo).

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/c1dbefaa-d6aa-4b94-9ff8-d10c8e55273a)

  
# Future updates
 * Implementation of more contexts in ImageDrawer
 * Slideshow for images
 * Squashing UI bugs
 * Improving general UX
 * Civit.ai integration (maybe)
 * Plugin support (maybe)
 
# Issues and Pull Requests
Feel free to add them, but please do not expect regular updates or responses. This project is just for fun. I will add features and fix bugs when I have free time and when they are important for my needs. I'll review pulls of course and integrate anything that looks good.

# Support
Open an issue if you have any problems, but keep in mind I probably won't have a lot of time to look into them. For the most part, a lot of stuff is just not yet implemented, like most of the contexts in ImageDrawer. If something doesn't work, assume I haven't implemented it yet.

# Data Collection and Privacy Policy
Your data is your own. This suite of nodes and web features does not collect any data from you or your machine.

# ComfyUI Manager Support
It'll happen when I've implemented more contexts and features. For now I'm not interested in showcasing the suite since it's only about halfway done.
