# ComfyUI-JNodes
 python and web UX improvements for ComfyUI

# Acknowledgement
 thank you to:
 * [Kosinkadink](https://github.com/Kosinkadink) for the original work in [VHS](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) on which SaveVideo and UploadVideo are based
 * [pythongosssss](https://github.com/pythongosssss) for the original [ImageFeed](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/imageFeed.js) element on which ImageDrawer is based
 * [Kijai](https://github.com/Kijai) for various code snippets that went into scripts such as statusTitle
 
# Python Nodes
 * Token count node

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/4fa9ca93-3891-434f-8cb1-5e0f0e8ed8ee)
 * png_info manipulation nodes (add positive prompt, add negative prompt, targeting a1111-style png_info)
 * Synced string literals with external text files
 * Parameter lists (set parameters by text to control variables and nodes in your prompt)
 * Save Video (minor improvements over VHS Video Combine for adding meta data to gif/webp, file name control)
 * Yet another dynamic prompts implementation with randomization controls
 * Yet another Wildcards implementation
 * Commenting out prompts support (just add # decorator before each line you want to be ignored or encapsulate specific text on a line with ## on either side "## Commented text ##"). Decorator is configurable.

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/05ae496f-94fa-4fb4-9686-b5f27a996d6b)
 * Prompt Editor (search and replace text in any text, intended for prompts to change certain trigger words, for example an embedding named '3mb3dd1n4' can be changed to 'embedding')
 * Selector nodes that can be randomized based on seed (e.g. to select a random checkpoint name)
 * Get Temp Directory, Get Output Directory
 
# Web Features
 * ImageDrawer (image feed, lora picker, image history, etc) with search (crawling png_info) 
 * Lora Picker: a context option in ImageDrawer that displays your loras in a grid something like in a1111 and allows you to search for and copy the lora command in a1111 format (use [Coziness](https://github.com/skfoo/ComfyUI-Coziness) or something similar to support text loras) as well as the trained words. Click tag words to automatically search for similar local loras. Works best with loras downloaded with [Civit Downloader](https://www.ayamaru.com/more).

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/141ea856-e9b7-4ece-825d-be0aa1ceedf0)
 * EditAttention improvements (undo/redo support, remove spacing)
 * Status (progress) indicators (percentage in title, custom favicon, progress bar on floating menu)

   ![image](https://github.com/JaredTherriault/ComfyUI-JNodes/assets/8760446/5887a6e3-28e6-4a07-a1a4-5a20faa5f557)
 * Font control for textareas (see ComfyUI settings > JNodes)
 * Mouse over images in feed and history to see exif/png_info
 
# Caveats
 * Not compatible with pythongosssss ImageFeed, you'll need to manually delete it
 * Not compatible with pythongosssss favicon.js, you'll need to manually delete it
 * Not compatible with ComfyUI DynamicPrompts.js, you'll need to manually delete it
 * Not compatible with ComfyUI EditAttention.js, you'll need to manually delete it
 
 The python nodes will all still work fine, but if you don't delete the files above you won't be able to use many web features.
 
# Known Issues
 * Mouse Over a lora card with no preview images near the scroll bar results 
in a graphical overlay issue
 
# Future updates
 * Implementation of more contexts in ImageDrawer
 * Slideshow for images
 * Squashing UI bugs
 * Improving general UX
 * Drag and drop from lora picker to canvas to add lora loaders (for people who don't want to use text loras)
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
