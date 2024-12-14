import os

import folder_paths
from .logger import logger
from .utils import *

import comfy.sd

from typing import Dict, List


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
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image_size": ([
                    "128x128", "256x256", "480x480", "512x512", "768x768", "1024x1024", "2048x2048", "4096x4096", 
                    "512x400", "720x480", "768x512", 
                    "854x480", "960x540", "1280x720", "1600x900", "1920x1080", "2560x1440", "3840x2160", "7680x4320",
                    "1152x896"],),
                "use_custom_size": ("BOOLEAN", {"default": False}),
                "custom_size_x": ("INT", {"default": 512, "minimum": 2}),
                "custom_size_y": ("INT", {"default": 512, "minimum": 2}),
                "flip_width_and_height": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ("INT", "INT",)
    RETURN_NAMES = ("width", "height",)
    FUNCTION = "return_size"

    def return_size(self, image_size, use_custom_size, custom_size_x, custom_size_y, flip_width_and_height):
        """
        Allows the user to either select a common image size from a list or input their own
        if 'use_custom_size' is true. If 'custom_size_x' is less than 2, it will take the value of 'custom_size_y'
        and vice-versa if the other axis is valid. If neither is valid, custom size is ignored and the selected 
        built-in size is used.
        The return value must be greater than 2 for both x and y. Negative values are made positive.
        A final value less than 2 for either x or y will result in an exception.
        """
        
        def split_size(size_string):
            x_str, y_str = size_string.split("x")
            x = int(y_str if flip_width_and_height else x_str)
            y = int(x_str if flip_width_and_height else y_str)
            return x,y
        
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

        # Walk through the directory
        for root, dirs, files in os.walk(resolve_file_path(base_directory)):
            for file in files:
                if optional_file_type:
                    if file.lower().endswith(optional_file_type.lower()):
                        file_paths.append(os.path.join(root, file))
                else:
                    file_paths.append(os.path.join(root, file))

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
    "JNodes_VaeSelectorWithString": "Vae Selector + String",
    "JNodes_SamplerSelectorWithString": "Sampler Selector + String",
    "JNodes_SchedulerSelectorWithString": "Scheduler Selector + String",
    "JNodes_ImageFormatSelector": "Image Format Selector",
    "JNodes_SelectRandomFileFromDirectory": "Select Random File From Directory",

}