import os
import re

import folder_paths
from .logger import logger
from .utils import *

import comfy.sd

from typing import Dict, List, Set


class BooleanSelector:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "boolean": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("BOOLEAN", "STRING",)
    FUNCTION = "return_bool"

    def return_bool(self, boolean):
        return (boolean, f"{boolean}",)
    
class ImageSizeSelector:

    @staticmethod
    def remove_parentheses(resolution_str):
        # Use a regular expression to remove the part in parentheses
        return re.sub(r'\s*\(.*\)', '', resolution_str)

    @staticmethod
    def get_resolution_list():

        hardcoded = [
            # 1:1 Aspect Ratio (Square)
            "128x128 (1:1)", "256x256 (1:1)", "480x480 (1:1)", "512x512 (1:1)", "768x768 (1:1)", "1024x1024 (1:1)", "2048x2048 (1:1)", "4096x4096 (1:1)",  # Square resolutions

            # 16:9 Aspect Ratio (Widescreen HD Resolutions)
            "512x400 (16:9)", "720x480 (16:9)", "768x512 (16:9)",  # Widescreen resolutions (lower resolutions, often used in standard video)
            "854x480 (16:9)", "960x540 (16:9)",  # qHD and WVGA resolutions
            "1280x720 (16:9)",  # HD resolution
            "1600x900 (16:9)",  # HD+ resolution
            "1920x1080 (16:9)", # Full HD resolution (1080p)
            "2560x1440 (16:9)", # 2K resolution (Quad HD)
            "3840x2160 (16:9)", # 4K resolution (Ultra HD)
            "7680x4320 (16:9)", # 8K resolution (Ultra High Definition)
            
            # 16:9 Aspect Ratio (Additional Widescreen Variants)
            "1152x896 (16:9)",  # A variant used in some widescreen monitors (slightly different aspect ratio)

            # 16:9 Aspect Ratio (Other Video Resolutions)
            "512x320 (16:9)", "720x512 (16:9)", "848x480 (16:9)",  # Other popular video resolutions

            # 16:10 Aspect Ratio Resolutions
            "1280x800 (16:10)",  # Standard 16:10 resolution, commonly used in laptops and displays
            "1440x900 (16:10)",  # WXGA+ resolution, often used in older laptops
            "1680x1050 (16:10)", # WSXGA+ resolution, used in some older wide monitors
            "1920x1200 (16:10)", # WUXGA resolution, a common resolution for professional monitors
            "2560x1600 (16:10)", # WQXGA resolution, high-end resolution for large displays
            "3840x2400 (16:10)", # 4K 16:10 resolution

            # 4:3 Aspect Ratio Resolutions
            "640x480 (4:3)",   # VGA resolution (Standard for many older monitors and video displays)
            "800x600 (4:3)",   # SVGA resolution (Common for older PC monitors)
            "1024x768 (4:3)",  # XGA resolution (Standard for many projectors and displays)
            "1280x960 (4:3)",  # SXGA resolution (Used in some mid-range monitors)
            "1400x1050 (4:3)", # SXGA+ resolution (Slightly larger than SXGA)
            "1600x1200 (4:3)", # UXGA resolution (Used in high-end displays)
            "2048x1536 (4:3)", # QXGA resolution (Very high resolution used in professional monitors)
            "2560x1920 (4:3)", # WQXGA resolution (Ultra high resolution)
            
            # Smaller 4:3 Resolutions (for mobile or older systems)
            "320x240 (4:3)",   # QVGA resolution (Common for small devices and early mobile phones)
            "400x300 (4:3)",   # CIF resolution (Used in early video surveillance and mobile devices)
            "960x720 (4:3)",   # 4:3 resolution variant (non-standard, but sometimes used in certain displays)

            # Standard iPhones (non-Retina displays)
            "480x320 (Mobile)",   # iPhone 3G / 3GS (First generation non-Retina display)

            # Retina Displays (High Resolution)
            "960x640 (Mobile)",   # iPhone 4 / 4S (Retina display)
            "1334x750 (Mobile)",  # iPhone 6 / 6S / 7 / 8 (Retina HD display)
            "2436x1125 (Mobile)", # iPhone X / XS / 11 Pro (Super Retina display)
            "2208x1242 (Mobile)", # iPhone 6 Plus / 6S Plus / 7 Plus / 8 Plus (Retina HD display)
            "2778x1284 (Mobile)", # iPhone 12 Pro Max / 13 Pro Max / 14 Pro Max (Super Retina XDR display)
            "1624x750 (Mobile)",  # iPhone 12 / 12 mini / 13 mini / 14 / 14 Plus (Super Retina XDR display)
            "2532x1170 (Mobile)", # iPhone 12 / 12 Pro / 13 / 13 Pro / 14 Pro / 15 Pro (Super Retina XDR display)
            "1778x1284 (Mobile)", # iPhone 12 / 12 mini (Super Retina display, 16:9 aspect ratio)
            "1792x828 (Mobile)",  # iPhone 11 (Liquid Retina display)
            "2224x1668 (Mobile)", # iPhone X (Retina display)
            "2436x1125 (Mobile)", # iPhone XS / iPhone XS Max
            "2160x1180 (Mobile)", # iPhone 6 Plus (landscape)
        ]

        # look for "ImageSizeSelectorResolutions.txt" in JNodes folder
        filepath = resolve_file_path("JNodes/ImageSizeSelectorResolutions.txt")
        if os.path.exists(filepath):
            with open(filepath, "r") as file:
                file_string = file.read()

                if "," in file_string:
                    hardcoded.extend(file_string.split(","))
                else:
                    hardcoded.append(file_string)

        resolution_set = set()

        for x in hardcoded:
            cleaned_string = ImageSizeSelector.remove_parentheses(x.lower().replace(" ", ""))
            split = cleaned_string.split("x")

            if len(split) == 2 and split[0].isdigit() and split[1].isdigit():
                resolution_set.add(x)

        # Return sorted by height
        return sorted(list(resolution_set), key=lambda x: (int(ImageSizeSelector.remove_parentheses(x.split('x')[1])), int(x.split('x')[0])))

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image_size": (s.get_resolution_list(), {"tooltip": "You can add to this list by creating a text file named 'ImageSizeSelectorResolutions.txt' in the 'ComfyUI/JNodes' folder (create it if it doesn't exist) and add new resolutions there in this format: '1280x720 (16:9), 1600x1000 (16:10), 848x480 (16:9)'. Giving an aspect ratio is optional. Ensure you always have at least one comma, even with only one added resolution."},),
                "use_custom_size": ("BOOLEAN", {"default": False, "tooltip": "If you want to hardcode a custom size, set this to True."}),
                "custom_size_x": ("INT", {"default": 512, "minimum": 2, "tooltip": "Hardcoded width"}),
                "custom_size_y": ("INT", {"default": 512, "minimum": 2, "tooltip": "Hardcoded height"}),
                "flip_width_and_height": ("BOOLEAN", {"default": False, "tooltip": "Set to True to flip the dimensions, for instance to create a vertical image instead of a horizontal one."}),
                "multiplier": ("FLOAT", {"default": 1.0, "minimum": 0.0, "tooltip": "Multiply the output width and height by this factor, rounded to the nearest even number."}),
            },
        }

    RETURN_TYPES = ("INT", "INT",)
    RETURN_NAMES = ("width", "height",)
    FUNCTION = "return_size"

    def return_size(self, image_size, use_custom_size, custom_size_x, custom_size_y, flip_width_and_height, multiplier):
        """
        Allows the user to either select a common image size from a list or input their own
        if 'use_custom_size' is true. If 'custom_size_x' is less than 2, it will take the value of 'custom_size_y'
        and vice-versa if the other axis is valid. If neither is valid, custom size is ignored and the selected 
        built-in size is used.
        The return value must be greater than 2 for both x and y. Negative values are made positive.
        A final value less than 2 for either x or y will result in an exception.
        """
        
        def split_size(size_string):
            x_str, y_str = ImageSizeSelector.remove_parentheses(size_string).split("x")
            x = int(y_str if flip_width_and_height else x_str)
            y = int(x_str if flip_width_and_height else y_str)
            return x,y

        def round_up_to_even(n):
            return n if n % 2 == 0 else n + 1

        if use_custom_size:
            x = abs(custom_size_x)
            y = abs(custom_size_y)
            
            # If either axis is invalid, copy the value of the other axis if valid
            if x < 2 and y > 1:
                x = y
            elif y < 2 and x > 1:
                y = x
                
            # If both custom axes are valid, return them
            # If neither is valid, just parse the currently selected built-in value
            if x > 1 and y > 1: 
                return (y if flip_width_and_height else x, x if flip_width_and_height else y,)

        x,y = split_size(image_size)

        x = int(round_up_to_even(x * multiplier))
        y = int(round_up_to_even(y * multiplier))

        assert x > 1 and y > 1, "ImageSizeSelector::return_size: x and y values should be greater than 0!"
        return (x, y,)
    
    
class BaseListSelector: 
    def return_array_element_by_index_or_seed(self, mode, index_or_seed, array):
        index = index_or_seed % len(array)
        if mode == "index" and index_or_seed > -1 and index_or_seed < len(array):
            index = index_or_seed
        return (array[index], f"{array[index]}",)
    
    
class CheckpointSelector(BaseListSelector):
    RETURN_TYPES = (folder_paths.get_filename_list("checkpoints"), "STRING",)
    RETURN_NAMES = ("ckpt_name", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name": (folder_paths.get_filename_list("checkpoints"), ),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_names(self, ckpt_name, mode, seed):
        if mode == "select":
            return (ckpt_name, f"{ckpt_name}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, folder_paths.get_filename_list("checkpoints"))

class DiffusionModelSelector(BaseListSelector):
    RETURN_TYPES = (folder_paths.get_filename_list("diffusion_models"), "STRING",)
    RETURN_NAMES = ("unet_name", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "unet_name": (folder_paths.get_filename_list("diffusion_models"), ),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_names(self, unet_name, mode, seed):
        if mode == "select":
            return (unet_name, f"{unet_name}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, folder_paths.get_filename_list("diffusion_models"))

class VaeSelector(BaseListSelector):
    
    RETURN_TYPES = (folder_paths.get_filename_list("vae"), "STRING",)
    RETURN_NAMES = ("vae_name", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vae_name": (JNODES_VAE_LIST,),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }
    

    def get_names(self, vae_name, mode, seed):
        if mode == "select":
            return (vae_name, f"{vae_name}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, JNODES_VAE_LIST)


class SamplerSelector(BaseListSelector):
    RETURN_TYPES = (comfy.samplers.KSampler.SAMPLERS, "STRING",)
    RETURN_NAMES = ("sampler_name", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS,),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_names(self, sampler_name, mode, seed):
        if mode == "select":
            return (sampler_name, f"{sampler_name}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, comfy.samplers.KSampler.SAMPLERS)


class SchedulerSelector(BaseListSelector):
    RETURN_TYPES = (comfy.samplers.KSampler.SCHEDULERS, "STRING",)
    RETURN_NAMES = ("scheduler", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS,),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_names(self, scheduler, mode, seed):
        if mode == "select":
            return (scheduler, f"{scheduler}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, comfy.samplers.KSampler.SCHEDULERS)
  
class ImageFormatSelector(BaseListSelector):
    RETURN_TYPES = (JNODES_IMAGE_FORMAT_TYPES, "STRING",)
    RETURN_NAMES = ("format", "STRING",)
    FUNCTION = "get_names"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "format": (JNODES_IMAGE_FORMAT_TYPES,),
                "mode": (["select", "seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_names(self, format, mode, seed):
        if mode == "select":
            return (format, f"{format}",)
        else:
            return self.return_array_element_by_index_or_seed(
                mode, seed, JNODES_IMAGE_FORMAT_TYPES)

class SelectRandomFileFromDirectory:

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("PATH",)
    FUNCTION = "get_random_file"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "base_directory": ("STRING", {"multiline": False}),
                "include_subdirectories": ("BOOLEAN", {"default": True}),
                "optional_file_type": ("STRING", {"multiline": False}),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                }
            }

    def get_random_file(self, base_directory, include_subdirectories, optional_file_type, seed):   
        # List to store the paths of all the files
        file_paths = []

        # Convert comma-separated string into a list of file types (extensions), lowercase and stripped
        optional_file_type = [
            x.strip().lower() if x.strip().startswith(".") else f".{x.strip().lower()}"
            for x in optional_file_type.split(",") if x.strip()
        ]

        # Walk through the directory
        for root, dirs, files in os.walk(resolve_file_path(base_directory)):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                file_path = os.path.join(root, file)

                # Append file based on optional file type filtering
                if not optional_file_type or ext in optional_file_type:
                    file_paths.append(file_path)

            # If not including subdirectories, break after the first iteration
            if not include_subdirectories:
                break

        # If no files were found, return None or handle as needed
        if not file_paths:
            return ("")

        # Select a random file from the list
        # Initialize the random seed
        random.seed(seed)
        selected_file = random.choice(file_paths)
        
        return (selected_file,)

NODE_CLASS_MAPPINGS = {
    
    # selector_nodes
    "JNodes_BooleanSelectorWithString": BooleanSelector,
    "JNodes_ImageSizeSelector": ImageSizeSelector,
    "JNodes_CheckpointSelectorWithString": CheckpointSelector,
    "JNodes_DiffusionModelSelector": DiffusionModelSelector,
    "JNodes_VaeSelectorWithString": VaeSelector,
    "JNodes_SamplerSelectorWithString": SamplerSelector,
    "JNodes_SchedulerSelectorWithString": SchedulerSelector,
    "JNodes_ImageFormatSelector": ImageFormatSelector,
    "JNodes_SelectRandomFileFromDirectory": SelectRandomFileFromDirectory,

}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    # selector_nodes
    "JNodes_BooleanSelectorWithString": "Boolean Selector + String",
    "JNodes_ImageSizeSelector": "Image Size Selector",
    "JNodes_CheckpointSelectorWithString": "Checkpoint Selector + String",
    "JNodes_DiffusionModelSelector": "Diffusion Model Selector + String",
    "JNodes_VaeSelectorWithString": "Vae Selector + String",
    "JNodes_SamplerSelectorWithString": "Sampler Selector + String",
    "JNodes_SchedulerSelectorWithString": "Scheduler Selector + String",
    "JNodes_ImageFormatSelector": "Image Format Selector",
    "JNodes_SelectRandomFileFromDirectory": "Select Random File From Directory",

}