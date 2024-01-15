import os

import folder_paths
from .logger import logger


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

    
class StringLiteral:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"string": ("STRING", {"default": "", "multiline": True})}}

    def get_string(self, string):
        return (string,)
    