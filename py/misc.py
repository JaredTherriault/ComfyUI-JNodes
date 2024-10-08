import os

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
    "JNodes_GetCleanFilename": GetCleanFilename,
    "JNodes_GetLeafDirectory": GetLeafDirectory,
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
    "JNodes_GetCleanFilename": "Get Clean Filename",
    "JNodes_GetLeafDirectory": "Get Leaf Directory",

}