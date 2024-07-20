import os

import folder_paths
from .logger import logger
from .utils import any, AnyType


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
    
    
class AnyToString:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"anything": (any,)}}

    def get_string(self, anything):
        return (str(anything),)

NODE_CLASS_MAPPINGS = {
    
    # misc
    "JNodes_GetTempDirectory": GetTempDirectory,
    "JNodes_GetOutputDirectory": GetOutputDirectory,
    "JNodes_GetComfyDirectory": GetComfyDirectory,
    "JNodes_StringLiteral" : StringLiteral,
    "JNodes_IntLiteral": IntLiteral,
    "JNodes_FloatLiteral": FloatLiteral,
    "JNodes_AnyToString" : AnyToString,

}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    # misc
    "JNodes_GetTempDirectory": "Get Temp Directory",
    "JNodes_GetOutputDirectory": "Get Output Directory",
    "JNodes_GetComfyDirectory": "Get Comfy Directory",
    "JNodes_StringLiteral" : "String Literal",
    "JNodes_IntLiteral": "Integer Literal",
    "JNodes_FloatLiteral": "Float Literal",
    "JNodes_AnyToString" : "Anything To String",

}