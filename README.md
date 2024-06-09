# ComfyUI-JNodes
python and web UX improvements for ComfyUI: 
* Lora/Embedding picker

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/3d091422-e601-4247-9ea8-604fc4d6af22)
  
* web extension manager (enable/disable any extension without disabling python nodes)

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/c1dbefaa-d6aa-4b94-9ff8-d10c8e55273a)
  
* control any parameter with text prompts

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/7abcdf8e-5d5a-46e2-a300-62077de96863)
  
* image and video viewer, metadata viewer
      
  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/545272af-632b-4236-acdb-a734b32ed242)
  
* token counter
 
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/4fa9ca93-3891-434f-8cb1-5e0f0e8ed8ee)
  
* comments in prompts
  
  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/7ff4410b-35f1-492a-b65b-70957edf44e8)
  
* font control, and more!

# Acknowledgement
thank you to:
* [Kosinkadink](https://github.com/Kosinkadink) for the original work in [VHS](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) on which SaveVideo and UploadVideo are based
* [pythongosssss](https://github.com/pythongosssss) for the original [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js) element on which ImageDrawer is based
* [Kijai](https://github.com/Kijai) for various code snippets that went into scripts such as statusTitle
 
# Web Features
* **EditAttention improvements** (undo/redo support, remove spacing)
* **Status (progress) indicators** (percentage in title, custom favicon, progress bar on floating menu)

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/5887a6e3-28e6-4a07-a1a4-5a20faa5f557)
* **Font control** for textareas (see ComfyUI settings > JNodes)
* **Batch Commenting** shortcuts: By default, click in any multiline textarea and press ctrl+shift+/ to comment out a line. Requires the use of a JNodes_RemoveCommentedText node. The key combo and the text used to comment are both configurable in ComfyUI settings > JNodes.
  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/7ff4410b-35f1-492a-b65b-70957edf44e8)
  
  _In this example, the headings enclosed in "##" like "## Basic stuff ##" are commented out entirely.
  In the line "(worst quality, low quality:1.1), ## Works well sometimes, don't go above 1.3 or it will burn. Kills backgrounds ##", "(worst quality, low quality:1.1)," would be used while everything else would be commented out.
  In another line, "# deformed" would be commented out entirely because it's a single "#" at the beginning of the line. Note the node's fields corresponding to the text itself._

* **Pan faster** around the graph by holding ctrl+shift and moving the mouse.

# Installation
* Clone this repo into "ComfyUI/custom_nodes" OR
* Download the zip file and unzip it into "ComfyUI/custom_nodes"

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/56c3f73b-75d8-4cd2-a191-178e03c417dc)

# Settings
Open ComfyUI Settings by clicking the "Cog" icon on the floating toolbar and scroll down to "JNodes Settings." Expand the group by clicking the side-facing arrow beside the text.
* **Batch-commenting Hotkey**: A key combo that, when pressed, will insert text at the beginning of the selected lines in a multiline textarea, assuming it is the active element. If no text is selected, the text will be inserted at the beginning of the line where the cursor currently sits. This text will not automatically dummy out any lines, you will need to pass the resulting text into a custom node that removes lines marked as 'commented'.
* **Batch-commenting Token**: The token that will be inserted/removed when performing a batch comment operation
* **Extension Management**: Deselect any unwanted web extensions to disable them. Select them again to re-enable them. Refresh your browser to see changes. Be extremely careful which extensions you disable.

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/c1dbefaa-d6aa-4b94-9ff8-d10c8e55273a)
  
* **Image Drawer Anchor**: To which part of the screen the screen the drawer should be docked
* **Image Drawer Enabled**: Toggle whether the drawer is enabled. Requires a page refresh. This is distinct from hiding the drawer - this stops the drawer code from loading entirely until re-enabled. 
* **Image Drawer Image & Video Key List Allow/Deny Toggle**: Whether the terms listed in the Key List should be denied or allowed, excluding everything else. True = Allow list, False = Deny list.
* **Image Drawer Image & Video Key List**: A set of comma-separated names to include or exclude from the tooltips applied to images in the drawer. For example, we don't show the "prompt" or "workflow" values by default since they would be too lengthy.
* **Multiline Text Font Family**: A typeface applied to all multiline text areas in the graph.
* **Multiline Text Font Size (%)**: How large, as a percentage, the text in multiline text areas should be.
* **Show Progress Bar Above menu**: If true, a progress bar for the current node will be displayed above the Comfy floating menu.
* **Show Progress in Title**: If true, display progress for the current node in the title/tab of the browser, similar to Automatic1111.
* **Use Custom Favicon**: If true, display a custom favicon in the title/tab of the browser. Stored in "ComfyUI/custom_nodes/ComfyUI-JNodes/web/js/assets/", "favicon.ico" is used when a generation is not in progress while "favicon-active.ico" is used when one is.

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/5887a6e3-28e6-4a07-a1a4-5a20faa5f557)

# ImageDrawer: Overview
Similar to [pythongosssss](https://github.com/pythongosssss)'s [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js), but with a larger feature set. Searchable. Change Contexts with the Context Selector. Mouse over images in drawer to see exif/png_info.
* **On the top left of the drawer, find**:
  * A "Hide" button (❌) that "closes" the drawer. It can be restored with the "Image" button (🖼️) next to the ComfyUI Settings "Cog" button on the floating toolbar. 
  * The View Options flyout allows you to control how many images appear in a row and how large those images apppear. You can adjust them via sliders or click each underlined name to set a number directly. You'll also find a place to adjust the drawer's anchor point so you can adjust it to a position that feels comfortable for you.
  * The "Sync" button (🔄) which will restart all playing videos so that they may sync up better.
 
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/64285b1b-3739-4f7f-9c51-2d80aa65a21c)

* **On the top right you'll find**:
  * A down-facing arrow. If you click it, many of the controls above the list will be hidden. Clicking it again will show the controls again.
  * Select all/none
    * If any images are selected (see [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer)), some extra controls will be shown. You can recycle/delete all selected items with the Batch Recycle Button (♻️) or hide all selected with the Batch Removal Button (❌, not to be confused with the hide button on the left side). Note that Batch Removal only hides the images from view and does not delete them.
   
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/c0f8f446-6e13-48ae-a52a-589a8d6c7dc1)

* **Context Selector**: Allows you to select different contexts to show different images, videos and models. See [Contexts](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contexts).
* **Sort Type**: Different contexts have different ways of being sorted, such as Date (file age), file size, filename, etc. Not all contexts support all sort types, so they will change between shifting of contexts. Of note is the Shuffle type. Shuffle will semi-randomly sort items in the list and enables a button (🔀) beside the Sort Type dropdown. Click it to shuffle again. Click and hold to set an automatic shuffle every x milliseconds. When in auto mode, click the button again or change the sort type to stop shuffling automatically.

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/76300611-a2a1-413f-bf08-13f9a186e50f)
  
* **Search bar**: A search filter for for items in the list, crawling metadata and filename. For generated images you can search for prompts and other parameters. For models you can search for civit.ai info. For everything else you can search for filename, subdirectory, and other things. Items that don't meet the criteria are temporarily hidden. You can clear the search (❌), swap between matching ALL search tokens or matching ANY of the search tokens (separated by space), or randomize search tokens (🎲).

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/296b8519-3bec-4b9e-b426-1a56a636125e)

* **Context Toolbar**: Here you can find controls specific to the currently selected context. See [Contexts](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contexts) for more information about the controls in each toolbar.

# ImageDrawer: Contexts
* **Image Feed**: A stream of your latest stable diffusion generations. Supports most image types and some video types like mp4. ContextFeed is not A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer), but most of the same information applies excepting the subdirectory selector, the Refresh button and the video controls. See below.
* **Temp/History**:  A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "temp" directory. This directory is cleared when comfy is restarted. Supports subdirectories.
* **Input**: A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "input" directory.
* **Output**:  A [ContextSubdirectoryExplorer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextsubdirectoryexplorer). Everything currently in the "output" directory.
* **Lora/Lycoris**: A [ContextModel](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextmodel) that displays your loras in a grid something like in a1111 and allows you copy the lora command in a1111 format as well as the trained words. Works best with loras downloaded with [Civit Downloader](https://www.ayamaru.com/more). Loras are stored in "models/loras".
* **Embeddings/Textual Inversions**: A [ContextModel](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-contextmodel) similar to Loras, but what's in the "embeddings" directory.

# ImageDrawer: ContextSubdirectoryExplorer
ContextSubdirectoryExplorer is a context type that displays the images and videos in a specific directory. 
* When one of these contexts is selected, the "root" directory's images are loaded first, but you can select any child directory using the subdirectory selector below the search field. 
* You can load all of the images and videos in the child directories of the current subdirectory by clicking "**Include subdirectories**", but be careful - it's dependent on your system, but trying to load too many images could cause a hard lock or out-of-memory errors if you run out of RAM. VRAM is managed by the drawer, but system RAM is not. This option is automatically disabled when switching subdirectories for safety.
* **A flyout of video options** sits beside the "Include Subdirectories" checkbox - hover over it to reveal some controls for video pplayback such as autoplay, loopiing, control visibility, muting, volume, and playback rate. There's also the option to seek throuugh videos using the mouse wheel, but this can be deisabled through this menu if you don't like this function.
* **The Refresh button** can be used to reload the current set of images and videos in case some are added or removed. 
* **The Jump button** at the end can be used to automatically scroll to the top of the list of images and videos.
* **Mouse over** any image or video in the list to see metadata in a tooltip as well as a couple of controls listed below.
  * The top left of an image will have a checkbox to allow for selecting multiple images at once which can then be hidden or recycled using the Batch Buttons (see below).
  * The top right of an image will have an overflow menu that when hovered will display some extra controls:
    * The filename, which when hovered will display file information like its subdirectory, file size, dimensions, and, if available, fps, frame count and duration.
    * A control to recycle/delete the item.
    * A control to remove the item from the current view which will be restored when refreshing the context list view.
    * A control to open the containing directory
    * A control for each item in the metadata that can be copied
   
      _The metadata tooltip appears when hovering over an image and shows all key-value pairs except those blocked in JNodes Settings_
      
      ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/545272af-632b-4236-acdb-a734b32ed242)

      _The overflow menu toolbutton displays controls relating to this individual image and its metadata_
      
      ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/33aa80e0-40e8-46ec-bc3d-033d2a75fd15)
      
      _The image on the left is selected which causes the batch deletion/removal buttons to appear. The batch selection button now displays 1 item is selected._
      
      ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/ef4ee0f9-dab7-426e-b12f-77cc1f61ad45)

* **Images and videos can be dragged and dropped** onto any JNodes_UploadVisualMedia node 

# ImageDrawer: ContextModel
ContextModel is a context type similar to ContextSubdirectoryExplorer but for loras and embeddings. There is no subdirectory selection support - all models within subdirectories are automatically found along with their images and info files if they are named similarly. 
* The **model cards** can have their aspect ratio edited using the toolbar.
* **The Refresh button** can be used to reload the current set of models and images in case some are added or removed. 
* **The Jump button** at the end can be used to automatically scroll to the top of the list.
* **Each card** displays an image relating to the model and these images can be switched by clicking the left/right arrows (if multiple images exist relting to a given model). The top right of the card displays a number corresponding to the image currently being viewed.
* **The bottom of each card** displays the friendly name (defined by the info file) and the model's actual filename as well as some tags defined by the model's info file. Click these tags to find other models with similar tags.
* **On the top left** you can find controls relating to the model defined in the model's info file, if applicable. From right to left: 1) a link to the model on civit.ai 2) a button that can be dragge donto the canvas to create a load lora node 3) a button to copy the lora or embedding in a1111 text form 4) a button to copy the trained words for the model and 5) a button to copy the contents of both 3 and 4. Buttons may not exist if the data they correspond to doesn't exist in the model's info file.
  * Text form loras should be familiar to anyone who has used a1111 aside from a second number scaler. This maps to the Comfy lora loader. Each number maps to style and CLIP, respectively. 
  * To use text loras, try a solution like [Coziness](https://github.com/skfoo/ComfyUI-Coziness). 
  * Text embeddings are supported natively by ComfyUI.

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/3d091422-e601-4247-9ea8-604fc4d6af22)

# Python Nodes
* Image Ouput Nodes
  
  * **JNodes_SaveVideo**: minor improvements over VHS_VideoCombine for adding meta data to gif/webp, file name control
  * **JNodes_SaveImageWithOutput**: Similar to Comfy's SaveImage and PreviewImage but whether it's saved to the output directory is a control, file name control

* Parameter List Nodes
  * **JNodes_GetParameterFromList**: Gets a specific parameter as its actual type from a text list of defined parameters. See this [section](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#parameter-lists) for more on text parameters.

* Prompting Nodes

  * **JNodes_TokenCounter**: Count tokens in a given string based on the currently loaded model(s).
 
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/4fa9ca93-3891-434f-8cb1-5e0f0e8ed8ee)
    
  * **JNodes_AddOrSetMetaDataKey**, **JNodes_SetPositivePromptInMetaData**, **JNodes_SetNegativePromptInMetaData**, **JNodes_RemoveMetaDataKey**: png_info manipulation nodes targeting a1111-style png_info
  * **JNodes_SyncedStringLiteral**: a multiline text node synced with external text files. Put the path in the "path_to_synced_txt" field and save/load from it.
  * **JNodes_RemoveParseableDataForInference**: Removes parameters from input text so the text alone can be used for inference.
  * **JNodes_ParseDynamicPrompts**: Yet another dynamic prompts implementation with randomization controls
  * **JNodes_ParseWildcards**: Yet another Wildcards implementation with some extra options like randomization control.
  * **JNodes_RemoveCommentedText**: just add # decorator before each line you want to be ignored or encapsulate specific text on a line with ## on either side "## Commented text ##". Decorator is configurable.
 
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/05ae496f-94fa-4fb4-9686-b5f27a996d6b)
 
  * **JNodes_SplitAndJoin**: Splits input text and rejoins each item with a delimiter. Great for removing extraneous spaces and commas from a display prompt.
  * **JNodes_TrimAndStrip**: Simply removes whitespace from the head and tail of the given text.
  * **JNodes_SearchAndReplace**, **JNodes_SearchAndReplaceFromList**, **JNodes_SearchAndReplaceFromFile**: Search and replace text in any text, intended for prompts to change certain trigger words, for example an embedding named '3mb3dd1n4' can be changed to 'embedding'. The replacement words can come from a muiltline text or a text file (one per line, ex. 3mb3dd1n4->embedding) or can be entered directly.

* Selector Nodes (Can be randomized based on seed (e.g. to select a random checkpoint name) and will return the value as a string)
  * **JNodes_BooleanSelectorWithString**, **JNodes_ImageSizeSelector**, **JNodes_CheckpointSelectorWithString**, **JNodes_VaeSelectorWithString**, **JNodes_SamplerSelectorWithString**, **JNodes_SchedulerSelectorWithString**, **JNodes_ImageFormatSelector**
  * **JNodes_SelectRandomFileFromDirectory**: Given a directory path, will return a random image or video path that can then be loaded using one of the media nodes

* Media Nodes
  * **JNodes_MediaInfoToString**: Format [MediaInfo] as a string. See **JNodes_BreakMediaInfo** for more information on the MediaInfo structure.
  * **JNodes_AppendReversedFrames**: Takes in frames as an "IMAGE" pin and reverses them, then appends them. Creates a ping-pong style looped "video".
  * **JNodes_UploadVisualMedia**: Similar to Comfy's LoadImage, but works for images and videos and returns a path to the uploaded media. The path should then be plugged into a node like **JNodes_LoadVisualMediaFromPath**. You can also select where to upload the media, either to "temp" or "input" "/upload_media". Below the preview image is formatted metadata loaded from the image or video. You can drag images from the [ImageDrawer](https://github.com/JaredTherriault/ComfyUI-JNodes?tab=readme-ov-file#imagedrawer-overview) onto this node or drag them in from your file explorer.
  * **JNodes_LoadVisualMediaFromPath**: Given a path to an image or video, will output all frames as an "IMAGE" pin. Start point ("start_at_n") and number of frames ("sample_next_n") can be specified, as well as whether to deal in frames or a number of seconds ("start_at_unit", "sample_next_unit"), so if you know you want 16 frames starting 3 seconds into a video, you can mix and match. A "sample_next_n" value of 0 means to get all remaining frames after "start_an_n". Can also skip a number of frames every cycle (to lighten the workload) and discard transparency. Other outputs are MediaInfo outputs, one for the original media and one for the output images. See **JNodes_BreakMediaInfo** for more information on the MediaInfo structure.
    
    ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/cedd88e4-69a2-41fd-8986-f6d72609b8fe)

  * **JNodes_BreakMediaInfo**: Get the individual components of the MediaInfo structure:
    * **start_frame**: Always 0 for original_media_info, but could be different for output_media_info if start_at_n is set to something other than 0.
    * **frame_count**: The number of frames in the media. 
    * **fps**: The rate at which playback occurs with the given media. Usually the same between original_media_info and output_media_info. 
    * **duration**: A product of frame_count * fps. Output is in seconds.
    * **frame_time**: The number of seconds between frames. Usually a small number. A dividend of duration / frame_count.
    * **width**: The width in pixels of each frame.
    * **height**: The height in pixels of each frame.
    
    Example:
     ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/54af7f5b-e989-4c17-812b-82284e6dc4d0)

* Misc Nodes
  * **JNodes_GetTempDirectory**, **JNodes_GetOutputDirectory**, **JNodes_StringLiteral**
  * **JNodes_AnyToString**: Turn any input into text or string (as python would stringify it for JSON)

# Parameter Lists
JNodes includes a feature that allows for text parameters in prompts. With this feature you can add something like <params: image_size_y: 512> to your text prompt to make your image have a height of 512. Anything can be parameterized including model names, numbers, even booleans. That means you can have different parameters for individual prompts. Imagine that you normally like to generate images at 512x768 but you want to do an XL generation. Instead of manually changing the latent size to 1024x1024, you can simply add <params: image_size_x: 1024> <params: image_size_y: 1024> to your prompt.

This is not exactly automatic though, and requires some manual set up the first time. 

  1. Think of a name for your parameter. It doesn't mnatter what name you use, as long as you can remember it and what it does. "image_size_x" is just a name I chose - there are no built-in parameter names. It can be anything you want.
  2. Add the parameter to your prompt in this format: <param: {parameter_name}: {parameter_value}>. This can go in any text you'd like and doesn't have to be a part of your prompt so you can create something like a control panel if you prefer.
  3. Add a **JNodes_GetParameterFromList** node to your graph. 
  4. Copy the parameter name that you had added to your prompt and paste it into the "parameter_name" field.
  5. A bit above the parameter_name field you should see a multiline text area with some hint text in it. Right click the node and convert widget to input > parameter_list. Plug your prompt into the new pin named parameter_list.
  6. If you'd like you can plug something into "parameter_default" that will be used in the event that the parameter is not found in your prompt. Any pin type is compatible.
  7. The output of the node can go into any other node. It should be compatible with any other node. Just be sure that the "parameter_value" is actually parseable by python JSON. For example, don't try to plug into a number pin when the value you set is "omega." It will result in a graph error. If the pin is a number, the parameter_value should be a number too, like "5.0" for example.
  8. Other fields on the node are optional: 
    * **parsing_key**: This determines what tag to look for in the prompt. So if your parameter is marked like "<params: image_size_x: 1024>", then "params" is the parsing key. This can be whatever you want.
    * **return_type**: This should usually be on "auto" but in some cases you may want a string instead of automatically converting the parameter. For example, you have a node with a string input and your parameter is "5.0". You intend this to be hooked up this way, but normally the node would output 5.0 as a number. In this case, set "return_type" to "string".
    * **add_to_png_info**: If true, the parameter_name and output value will be added to the png_info of the current generation as a key-value pair. Turn this off if you don't want your parameters crowding up your generations' metadata.

  ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/7abcdf8e-5d5a-46e2-a300-62077de96863)

  _In this example, we have a **JNodes_GetParameterFromList** node with a random seed (from the rgthree suite) plugged into parameter_default. This means that if we don't specify a parameter in parameter_list, we will use the random seed. Hooked into parameter_list is the current prompt which does specify a seed with "<params:seed:8675309>" meaning we will use this number instead of the randomly generated one from the default input. The parsing_key and parameter_name fields match up with the prompt's parameter and return type is "auto" which means it will be automatically converted to the correct type (number) Finally, note that we plug the prompt into a **JNodes_RemoveParseableDataForInference** node before being passed into the CLIP Conditioning happens. This removes instances of parameters from the text like "<params:seed:8675309>". You do not need to make a new parameter list for every parameter, you can put them all in the same single prompt._


# Caveats
There are some incompatibilities with some Comfy extensions and some popular extensions. They can be optionally disabled with this suite.
Please use the JNodes Extension Management setting in [Settings](https://github.com/JaredTherriault/ComfyUI-JNodes/tree/main?tab=readme-ov-file#settings) > JNodes > Extension Management to disable the following extensions by unchecking them:
* pysssss.ImageFeed should be disabled as ImageDrawer relaces it entirely.
* mtb.ImageFeed can be disabled if you don't want to see it in addition to ImageDrawer. mtb.ImageFeed is designed to only load if pysssss.ImageFeed is not loaded.
* pysssss.FaviconStatus can be disabled if you'd like to use your own custom favicons or see the progress percentage in the title or tab. This is optional.
* Comfy.DynamicPrompts can be disabled if you're using another dynamic prompts solution, such as the one included with this suite. If this is enabled, the included solution can't operate.
* Comfy.EditAttention can be disabled if you would prefer to use a similar system included in this suite (which supports undo/redo).

# Known Issues
* Batch Selection doesn't work in ContextModel contexts like loras or embeddings

# Data Collection and Privacy Policy
**Your data is your own**. This suite of nodes and web features does not collect any data from you or your machine.
