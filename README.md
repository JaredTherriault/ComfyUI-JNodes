# ComfyUI-JNodes
python and web UX improvements for ComfyUI

# Acknowledgement
thank you to:
* [Kosinkadink](https://github.com/Kosinkadink) for the original work in [VHS](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) on which SaveVideo and UploadVideo are based
* [pythongosssss](https://github.com/pythongosssss) for the original [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js) element on which ImageDrawer is based
* [Kijai](https://github.com/Kijai) for various code snippets that went into scripts such as statusTitle
 
# Web Features
* EditAttention improvements (undo/redo support, remove spacing)
* Status (progress) indicators (percentage in title, custom favicon, progress bar on floating menu)

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/5887a6e3-28e6-4a07-a1a4-5a20faa5f557)
* Font control for textareas (see ComfyUI settings > JNodes)
* Batch Commenting shortcuts: By default, click in any multiline textarea and press ctrl+shift+/ to comment out a line. Requires the use of a JNodes_RemoveCommentedText node. The key combo and the text used to comment are both configurable in ComfyUI settings > JNodes.
* Pan faster around the graph by holding ctrl+shift and moving the mouse.

# Settings
Open ComfyUI Settings by clicking the "Cog" icon on the floating toolbar and scroll down to "JNodes Settings." Expand the group by clicking the side-facing arrow beside the text.
* Batch-commenting Hotkey: A key combo that, when pressed, will insert text at the beginning of the selected lines in a multiline textarea, assuming it is the active element. If no text is selected, the text will be inserted at the beginning of the line where the cursor currently sits. This text will not automatically dummy out any lines, you will need to pass the resulting text into a custom node that removes lines marked as 'commented'.
* Batch-commenting Token: The token that will be inserted/removed when performing a batch comment operation
* Extension Management: Deselect any unwanted web extensions to disable them. Select them again to re-enable them. Refresh your browser to see changes. Be extremely careful which extensions you disable.
* Image Drawer Anchor: To which part of the screen the screen the drawer should be docked
* Image Drawer Enabled: Toggle whether the drawer is enabled. Requires a page refresh. This is distinct from hiding the drawer - this stops the drawer code from loading entirely until re-enabled. 
* Image Drawer Image & Video Key List Allow/Deny Toggle: Whether the terms listed in the Key List should be denied or allowed, excluding everything else. True = Allow list, False = Deny list.
* Image Drawer Image & Video Key List: A set of comma-separated names to include or exclude from the tooltips applied to images in the drawer. For example, we don't show the "prompt" or "workflow" values by default since they would be too lengthy.
* Multiline Text Font Family: A typeface applied to all multiline text areas in the graph.
* Multiline Text Font Size (%): How large, as a percentage, the text in multiline text areas should be.
* Show Progress Bar Above menu: If true, a progress bar for the current node will be displayed above the Comfy floating menu.
* Show Progress in Title: If true, display progress for the current node in the title/tab of the browser, similar to Automatic1111.
* Use Custom Favicon: If true, display a custom favicon in the title/tab of the browser. Stored in "ComfyUI/custom_nodes/ComfyUI-JNodes/web/js/assets/", "favicon.ico" is used when a generation is not in progress while "favicon-active.ico" is used when one is.

# ImageDrawer: Overview
Similar to [pythongosssss](https://github.com/pythongosssss)'s [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js), but with a larger feature set. Searchable. Change Contexts with the Context Selector. Mouse over images in drawer to see exif/png_info.
* On the top left of the drawer, find:
  * A "Hide" button (❌) that "closes" the drawer. It can be restored with the "Image" button (🖼️) next to the ComfyUI Settings "Cog" button on the floating toolbar. 
  * The View Options flyout allows you to control how many images appear in a row and how large those images apppear. You can adjust them via sliders or click each underlined name to set a number directly. You'll also find a place to adjust the drawer's anchor point so you can adjust it to a position that feels comfortable for you.
  * The "Sync" button (🔄) which will restart all playing videos so that they may sync up better.
* On the top right you'll find:
  * A down-facing arrow. If you click it, many of the controls above the list will be hidden. Clicking it again will show the controls again.
  * Select all/none
    * If any images are selected (see [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer)), some extra controls will be shown. You can recycle/delete all selected items with the Batch Recycle Button (♻️) or hide all selected with the Batch Removal Button (❌, not to be confused with the hide button on the left side). Note that Batch Removal only hides the images from view and does not delete them.
* Context Selector: Allows you to select different contexts to show different images, videos and models. See [Contexts](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contexts).
* Sort Type: Different contexts have different ways of being sorted, such as Date (file age), file size, filename, etc. Not all contexts support all sort types, so they will change between shifting of contexts. Of note is the Shuffle type. Shuffle will semi-randomly sort items in the list and enables a button (🔀) beside the Sort Type dropdown. Click it to shuffle again. Click and hold to set an automatic shuffle every x milliseconds. When in auto mode, click the button again or change the sort type to stop shuffling automatically.
* Search bar: A search filter for for items in the list, crawling metadata and filename. For generated images you can search for prompts and other parameters. For models you can search for civit.ai info. For everything else you can search for filename, subdirectory, and other things. Items that don't meet the criteria are temporarily hidden. You can clear the search (❌), swap between matching ALL search tokens or matching ANY of the search tokens (separated by space), or randomize search tokens (🎲).

# ImageDrawer: Contexts
* Image Feed: A stream of your latest stable diffusion generations. Supports most image types and some video types like mp4. ContextFeed is not A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer), but most of the same information applies excepting the subdirectory selector, the Refresh button and the video controls. See below.
* Temp/History:  A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "temp" directory. This directory is cleared when comfy is restarted. Supports subdirectories.
* Input: A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "input" directory.
* Output:  A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "output" directory.
* Lora/Lycoris: A [ContextModel](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextmodel) that displays your loras in a grid something like in a1111 and allows you copy the lora command in a1111 format as well as the trained words. Works best with loras downloaded with [Civit Downloader](https://www.ayamaru.com/more). Loras are stored in "models/loras".

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/141ea856-e9b7-4ece-825d-be0aa1ceedf0)

* Embeddings/Textual Inversions: A [ContextModel](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextmodel) similar to Loras, but what's in the "embeddings" directory.

# ImageDrawer: ContextSubdirectoryExplorer
ContextSubdirectoryExplorer is a context type that displays the images and videos in a specific directory. 
* When one of these contexts is selected, the "root" directory's images are loaded first, but you can select any child directory using the subdirectory selector below the search field. 
* You can load all of the images and videos in the child directories of the current subdirectory by clicking "Include subdirectories", but be careful - it's dependent on your system, but trying to load too many images could cause a hard lock or out-of-memory errors if you run out of RAM. VRAM is managed by the drawer, but system RAM is not. This option is automatically disabled when switching subdirectories for safety.
* A flyout of video options sits beside the "Include Subdirectories" checkbox - hover over it to reveal some controls for video pplayback such as autoplay, loopiing, control visibility, muting, volume, and playback rate. There's also the option to seek throuugh videos using the mouse wheel, but this can be deisabled through this menu if you don't like this function.
* The Refresh button can be used to reload the current set of images and videos in case some are added or removed. 
* The Jump button at the end can be used to automatically scroll to the top of the list of images and videos.
* Mouse over any image or video in the list to see metadata in a tooltip as well as a couple of controls listed below.
  * The top left of an image will have a checkbox to allow for selecting multiple images at once which can then be hidden or recycled using the Batch Buttons (see below).
  * The top right of an image will have an overflow menu that when hovered will display some extra controls:
    * The filename, which when hovered will display file information like its subdirectory, file size, dimensions, and, if available, fps, frame count and duration.
    * A control to recycle/delete the item.
    * A control to remove the item from the current view which will be restored when refreshing the context list view.
    * A control to open the containing directory
    * A control for each item in the metadata that can be copied
* Images and videos can be dragged and dropped onto any JNodes_UploadVisualMedia node 

# ImageDrawer: ContextModel
ContextModel is a context type similar to ContextSubdirectoryExplorer but for loras and embeddings. There is no subdirectory selection support - all models within subdirectories are automatically found along with their images and info files if they are named similarly. 
* The model cards can have their aspect ratio edited using the toolbar.
* The Refresh button can be used to reload the current set of models and images in case some are added or removed. 
* The Jump button at the end can be used to automatically scroll to the top of the list.
* Each card displays an image relating to the model and these images can be switched by clicking the left/right arrows (if multiple images exist relting to a given model). The top right of the card displays a number corresponding to the image currently being viewed.
* The bottom of each card displays the friendly name (defined by the info file) and the model's actual filename as well as some tags defined by the model's info file. Click these tags to find other models with similar tags.
* On the top left you can find controls relating to the model defined in the model's info file, if applicable. From right to left: 1) a link to the model on civit.ai 2) a button that can be dragge donto the canvas to create a load lora node 3) a button to copy the lora or embedding in a1111 text form 4) a button to copy the trained words for the model and 5) a button to copy the contents of both 3 and 4. Buttons may not exist if the data they correspond to doesn't exist in the model's info file.
  * Text form loras should be familiar to anyone who has used a1111 aside from a second number scaler. This maps to the Comfy lora loader. Each number maps to style and CLIP, respectively. 
  * To use text loras, try a solution like [Coziness](https://github.com/skfoo/ComfyUI-Coziness). 
  * Text embeddings are supported natively by ComfyUI.

# Python Nodes
* Image Ouput Nodes
  
  * JNodes_SaveVideo: minor improvements over VHS_VideoCombine for adding meta data to gif/webp, file name control
  * JNodes_SaveImageWithOutput: Similar to Comfy's SaveImage and PreviewImage but whether it's saved to the output directory is a control, file name control

* Parameter List Nodes
  * JNodes_GetParameterFromList: Gets a specific parameter as its actual type from a text list of defined parameters. See this [section](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#parameter-lists) for more on text parameters.

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
  * JNodes_UploadVisualMedia: Similar to Comfy's LoadImage, but works for images and videos. You can also select where to upload the media, either to "temp" or "input" "/upload_media". Below the preview image is formatted metadata loaded from the image or video. You can drag images from the [ImageDrawer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-overview) onto this node or drag them in from your file explorer.

* Misc Nodes
  * JNodes_GetTempDirectory, JNodes_GetOutputDirectory, JNodes_StringLiteral
  * JNodes_AnyToString: Turn any input into text or string (as python would stringify it for JSON)

# Parameter Lists
JNodes includes a feature that allows for text parameters in prompts. With this feature you can add something like <params: image_size_y: 512> to your text prompt to make your image have a height of 512. Anything can be parameterized including model names, numbers, even booleans. That means you can have different parameters for individual prompts. Imagine that you normally like to generate images at 512x768 but you want to do an XL generation. Instead of manually changing the latent size to 1024x1024, you can simply add <params: image_size_x: 1024> <params: image_size_y: 1024> to your prompt.

This is not exactly automatic though, and requires some manual set up the first time. 

# Caveats
There are some incompatibilities with some Comfy extensions and some popular extensions. They can be optionally disabled with this suite.
Please use the JNodes Extension Management setting in Settings > JNodes > Extension Management to disable the following extensions by unchecking them:
* pysssss.ImageFeed should be disabled as ImageDrawer relaces it entirely.
* mtb.ImageFeed can be disabled if you don't want to see it in addition to ImageDrawer. mtb.ImageFeed is designed to only load if pysssss.ImageFeed is not loaded.
* pysssss.FaviconStatus can be disabled if you'd like to use your own custom favicons or see the progress percentage in the title or tab. This is optional.
* Comfy.DynamicPrompts can be disabled if you're using another dynamic prompts solution, such as the one included with this suite. If this is enabled, the included solution can't operate.
* Comfy.EditAttention can be disabled if you would prefer to use a similar system included in this suite (which supports undo/redo).

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/c1dbefaa-d6aa-4b94-9ff8-d10c8e55273a)
 
# Issues and Pull Requests
Feel free to add them, but please do not expect regular updates or responses. This project is just for fun. I will add features and fix bugs when I have free time and when they are important for my needs. I'll review pulls of course and integrate anything that looks good.

# Support
Open an issue if you have any problems, but keep in mind I probably won't have a lot of time to look into them. For the most part, a lot of stuff is just not yet implemented, like most of the contexts in ImageDrawer. If something doesn't work, assume I haven't implemented it yet.

# Data Collection and Privacy Policy
Your data is your own. This suite of nodes and web features does not collect any data from you or your machine.

# ComfyUI Manager Support
It'll happen when I've implemented more contexts and features. For now I'm not interested in showcasing the suite since it's only about halfway done.
