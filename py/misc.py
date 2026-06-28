import os

import json
import math
import torch
import folder_paths
from .logger import logger
from .utils import any, AnyType, get_clean_filename, get_leaf_directory


class GetTempDirectory:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("temp_dir",)
    FUNCTION = "get_dir"

    @classmethod
    def INPUT_TYPES(cls):
        return {}

    def get_dir(self):
        return (folder_paths.get_temp_directory(),)
    
    
class GetOutputDirectory:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output_dir",)
    FUNCTION = "get_dir"

    @classmethod
    def INPUT_TYPES(cls):
        return {}

    def get_dir(self):
        return (folder_paths.get_output_directory(),)
    
    
class GetComfyDirectory:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("comfy_dir",)
    FUNCTION = "get_dir"

    @classmethod
    def INPUT_TYPES(cls):
        return {}

    def get_dir(self):
        return (folder_paths.base_path,)

class SubdirectorySelector:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("out_path",)
    FUNCTION = "get_dir"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "root_directory": ("STRING", {"default": "", "multiline": False}),
            "new_directory": ("STRING", {"default": "", "multiline": True})
            }
        }

    def get_dir(self, root_directory, new_directory):
        return (new_directory,)
    
class StringLiteral:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"string": ("STRING", {"default": "", "multiline": True})}}

    def get_string(self, string):
        return (string,)

class IntLiteral:
    RETURN_TYPES = ("INT",)
    FUNCTION = "get_integer"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"integer": ("INT", {"default": "1", "min": -9223372036854775808, "max": 9223372036854775807})}}

    def get_integer(self, integer):
        return (integer,)

class FloatLiteral:
    RETURN_TYPES = ("FLOAT",)
    FUNCTION = "get_float"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"float": ("FLOAT", {"default": "1.0", "step": 0.01, "min": -3.402823466e+38, "max": 3.402823466e+38})}}

    def get_float(self, float):
        return (float,)

class ModelInOut:
    RETURN_TYPES = ("MODEL",)
    FUNCTION = "output_val"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"model": ("MODEL",)}}

    def output_val(self, model):
        return (model,)

class ConditioningInOut:
    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "output_val"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"conditioning": ("CONDITIONING",)}}

    def output_val(self, conditioning):
        return (conditioning,)
    
class AnyToString:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"anything": (any,)}}

    def get_string(self, anything):
        return (str(anything),)

class PrintString:
    RETURN_TYPES = (any,)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "passthrough": (any,), 
                "in_string": ("STRING",),
                "per_line": ("BOOLEAN",)
            }
        }

    def get_string(self, passthrough, in_string, per_line=False):

        if in_string is not None:
            if per_line:
                for x in str(in_string).splitlines():
                    if x.strip():
                        logger.info(f"JNodes_PrintString: {x}")
            else:
                logger.info(f"JNodes_PrintString: {in_string}")
        return (passthrough,)

class GetCleanFilename:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"file_path":  ("STRING", {"default": "", "multiline": False})}}

    def get_string(self, file_path):
        return (get_clean_filename(file_path),)

class GetLeafDirectory:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"path":  ("STRING", {"default": "", "multiline": False})}}

    def get_string(self, path):
        return (get_leaf_directory(path),)

class EmptyCudaCache:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "passthrough": (any,),
            },
    }

    RETURN_TYPES = (any,)
    FUNCTION = "func"

    def func(self, passthrough):

        torch.cuda.empty_cache()

        return (passthrough,)

    @classmethod
    def IS_CHANGED(s, passthrough):

        return True

class FindMultiple:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("INT", {"default": 0}),
                "multiple": ("INT", {"default": 1, "min": 1}),
                "rounding": (["nearest", "down", "up", "bankers"], {"default": "nearest"}),
            }
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "compute"
    CATEGORY = "utils/math"

    def compute(self, value, multiple, rounding):
        import math

        if multiple == 0:
            return (value,)

        ratio = value / multiple

        if rounding == "down":
            result = multiple * math.floor(ratio)

        elif rounding == "up":
            result = multiple * math.ceil(ratio)

        elif rounding == "bankers":
            # Python's built-in round (ties to even)
            result = multiple * round(ratio)

        else:  # "nearest" (default: .5 rounds UP)
            result = multiple * math.floor(ratio + 0.5)

        return (int(result),)

class StringToBool:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "string": ("STRING", {"default": "", "multiline": False}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "process"
    CATEGORY = "utils/string/conversion"

    def process(self, string):

        if isinstance(string, str) and string.strip().lower() in ["true", "t", "1", "on", "yes", "y"]:
            return (True,)

        return (False,)

class StringToJsonObject:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "string": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("JSON_OBJECT",)
    FUNCTION = "process"
    CATEGORY = "utils/string/conversion"

    def process(self, string):

        parsed = None

        try:
            parsed =json.loads(string)
        except Exception as e:
            logger.error(f"Could not parse json from string: {e}")

        return (parsed,)

class GetVramInfo:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
        }

    RETURN_TYPES = ("INT", "INT", "INT")
    RETURN_NAMES = ("used_mb", "free_mb", "total_mb")

    FUNCTION = "monitor"

    CATEGORY = "utils"

    def monitor(self):
        free_bytes, total_bytes = torch.cuda.mem_get_info()

        free_mb = int(free_bytes / 1024 / 1024)
        total_mb = int(total_bytes / 1024 / 1024)
        used_mb = total_mb - free_mb

        logger.info(
            f"[GetVramInfo] "
            f"Used: {used_mb} MB | "
            f"Free: {free_mb} MB | "
            f"Total: {total_mb} MB"
        )

        return (used_mb, free_mb, total_mb)
    
    @classmethod
    def IS_CHANGED(s,**kwargs):
        return float("nan") # Run every time



NODE_CLASS_MAPPINGS = {
    
    "JNodes_GetTempDirectory": GetTempDirectory,
    "JNodes_GetOutputDirectory": GetOutputDirectory,
    "JNodes_GetComfyDirectory": GetComfyDirectory,
    "JNodes_SubdirectorySelector": SubdirectorySelector,
    "JNodes_StringLiteral" : StringLiteral,
    "JNodes_IntLiteral": IntLiteral,
    "JNodes_FloatLiteral": FloatLiteral,
    "JNodes_ModelInOut": ModelInOut,
    "JNodes_ConditioningInOut": ConditioningInOut,
    "JNodes_AnyToString" : AnyToString,
    "JNodes_PrintString": PrintString,
    "JNodes_GetCleanFilename": GetCleanFilename,
    "JNodes_GetLeafDirectory": GetLeafDirectory,
    "JNodes_EmptyCudaCache": EmptyCudaCache,
    "JNodes_FindMultipleOf": FindMultiple,
    "JNodes_StringToBool": StringToBool,
    "JNodes_StringToJsonObject": StringToJsonObject,
    "JNodes_GetVramInfo": GetVramInfo,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    "JNodes_GetTempDirectory": "Get Temp Directory",
    "JNodes_GetOutputDirectory": "Get Output Directory",
    "JNodes_GetComfyDirectory": "Get Comfy Directory",
    "JNodes_SubdirectorySelector": "Subdirectory Selector",
    "JNodes_StringLiteral" : "String Literal",
    "JNodes_IntLiteral": "Integer Literal",
    "JNodes_FloatLiteral": "Float Literal",
    "JNodes_ModelInOut": "Model In, Model Out",
    "JNodes_ConditioningInOut": "Conditioning In, Conditioning Out",
    "JNodes_AnyToString" : "Anything To String",
    "JNodes_PrintString": "Print String",
    "JNodes_GetCleanFilename": "Get Clean Filename",
    "JNodes_GetLeafDirectory": "Get Leaf Directory",
    "JNodes_EmptyCudaCache": "Empty Cuda Cache",
    "JNodes_FindMultipleOf": "Find Multiple Of",
    "JNodes_StringToBool": "String To Bool",
    "JNodes_StringToJsonObject": "String To Json Object",
    "JNodes_GetVramInfo": "Get VRAM Info",
}