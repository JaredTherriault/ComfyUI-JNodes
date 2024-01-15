import os

import folder_paths
from .logger import logger
from .utils import *

import comfy.sd

from typing import Dict, List
from numba.tests.test_typeof import Custom


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
    
    RETURN_TYPES = (JNODES_VAE_LIST, "STRING",)
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
            
