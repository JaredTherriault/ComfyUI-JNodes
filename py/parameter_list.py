import os

from .logger import logger

from .utils import any, AnyType

import json
import re

import hashlib

import comfy.sd

from typing import Dict, List

JNODES_PARAMETER_LAST_CACHE = {}

RETURN_TYPES_LIST = ["auto", "string"]

PARAMETER_LIST_HINT_TEXT = "<params:my_string_variable:string>\n<params:my_number_variable: 0.5>"

def parse_parameter_list_to_table(parameter_list, parsing_key, break_on_finding_term : str = None, overwrite = False):

    key_value_pairs = {}

    if parameter_list and parsing_key:
        regex = r'<' + re.escape(parsing_key) + r':(.+?)>'
        
        matches = re.findall(regex, parameter_list)
        
        for match in matches:
            split = match.split(':')
            key = split.pop(0).strip()
            if overwrite or key not in key_value_pairs: # take the first value, do not overwrite unless requested
                if len(split) > 0:
                    value = ":".join(split).strip() # For parameters that may have had a literal ":" in them, like "(dog:1.2)"
                else: # If no parameter specified, assume it's a boolean
                    value = True
                key_value_pairs[key] = value
                if break_on_finding_term != None and break_on_finding_term == key: # early out if we found specified term
                    break

    return key_value_pairs

def auto_convert_output(output, explicit_return_type = None):
    if explicit_return_type == "string":
        return output
    
    # auto
    try:
        return json.loads(str(output))
    except ValueError:
        pass
    
    try:
        return int(output)
    except ValueError:
        pass
    
    try:
        return float(output)
    except ValueError:
        pass

    if output.strip().lower() == "true":
        return True
    elif output.strip().lower() == "false":
        return False

    return output

def return_paramter_from_table(parsed_list, parameter_name, parameter_default = "0", explicit_return_type = None):
    if parsed_list and parameter_name in parsed_list:
        return auto_convert_output(parsed_list[parameter_name], explicit_return_type)
    else:
        parameter_display_value = parameter_default if len(str(parameter_default)) < 5 else "given default"
        logger.info(f"Did not find parameter_name '{parameter_name}' in parameter_list. Using '{parameter_display_value}'.")
        return auto_convert_output(parameter_default, explicit_return_type)
    
def add_param_to_png_info(extra_pnginfo, parameter_name, param):
    if extra_pnginfo:
        extra_pnginfo[parameter_name] = str(param).strip()

class CacheGlobalParameters:
    @classmethod        
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_list": ("STRING", {"multiline": True, "default": PARAMETER_LIST_HINT_TEXT}),
                "group": ("STRING", {"multiline": False, "default": "Default"}),
                "parsing_key": ("STRING", {"multiline": False, "default": "params"}),
        }
    }

    OUTPUT_NODE = True
    RETURN_TYPES = ("STRING",)
    FUNCTION = "parse_parameters_to_global_list"

    CATEGORY = "parameter_list"
    
    def parse_parameters_to_global_list(self, parameter_list, group, parsing_key):   
        def escape_regex(s: str) -> str:
            return re.escape(s)     

        def extract_tagged_params(text: str, prefix: str) -> dict:
            """
            Extract tags of the format: <prefix:key:value>
            Returns {"key": "value", ...}
            """
            if not text:
                return {}

            safe_prefix = re.escape(prefix)
            pattern = rf"<{safe_prefix}:([^:>]+):([^>]+)>"

            matches = re.findall(pattern, text)
            return {key: value for key, value in matches}

        return {"ui": 
            {
                "parameter_map": [extract_tagged_params(parameter_list, parsing_key)],
                "group_name": [group],
            }, 
            "result": (parameter_list,) 
        }

class MakeParameterTable:
    @classmethod        
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_list": ("STRING", {"multiline": True, "default": PARAMETER_LIST_HINT_TEXT}),
                "parsing_key": ("STRING", {"multiline": False, "default": "params"}),
                "overwrite": ("BOOLEAN", { "default": False, "tooltip": "If True, values at the bottom of the list will overwrite those at the top. If False, values at the top will be used." }),
        }
    }

    RETURN_TYPES = ("STRING", "JNODES_PARAMETER_TABLE")
    RETURN_NAMES = ("passthrough", "parameter_table")
    FUNCTION = "parse_parameters_to_table"
    DESCRIPTION = "Takes a string that may have parameters tagged with parsing_key, \
then returns a table. GetParameterFromTable will allow you to retrieve values. \
This has a higher upfront cost than GetParameterFromList but with many parameters \
this paradigm can be much, much faster."

    CATEGORY = "parameter_list"
    
    def parse_parameters_to_table(self, parameter_list, parsing_key, overwrite):   

        parsed_list = parse_parameter_list_to_table(parameter_list, parsing_key, None, overwrite) 

        return (parameter_list, parsed_list,) 
        
class GetParameterFromList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_list": ("STRING", {"multiline": True, "default": PARAMETER_LIST_HINT_TEXT}),
                "parsing_key": ("STRING", {"multiline": False, "default": "params"}),
                "parameter_name": ("STRING", {"multiline": False}),
                "return_type": (RETURN_TYPES_LIST,),
                "add_to_png_info": ("BOOLEAN",{"default": True}),
            },
            "optional": {
                "parameter_default": (any,),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
    }

    RETURN_TYPES = (any,)
    FUNCTION = "get_parameter_from_list"

    CATEGORY = "parameter_list"

    OUTPUT_NODE = True

    @staticmethod
    def get_param(parameter_list, parsing_key, parameter_name, return_type = None, parameter_default = None):

        # early out when finding first instance of parameter_name
        parsed_list = parse_parameter_list_to_table(parameter_list, parsing_key, parameter_name) 
        
        param = return_paramter_from_table(parsed_list, parameter_name, parameter_default, return_type)

        return param
    
    def get_parameter_from_list(
            self, parameter_list, parsing_key, parameter_name, 
            return_type = None, add_to_png_info = True, parameter_default = None, unique_id = None, extra_pnginfo = None):

        param = GetParameterFromList.get_param(parameter_list, parsing_key, parameter_name, return_type, parameter_default)
        JNODES_PARAMETER_LAST_CACHE[unique_id] = param
        
        if add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)
            
        return (param,)
    
    @classmethod
    def IS_CHANGED(s, parameter_list, parsing_key, parameter_name, 
            return_type = None, add_to_png_info = True, parameter_default = None, unique_id = None, extra_pnginfo = None):
        
        return_value = True

        default = parameter_default
        cached = None
        if unique_id and unique_id in JNODES_PARAMETER_LAST_CACHE and JNODES_PARAMETER_LAST_CACHE[unique_id] is not None:
            cached = JNODES_PARAMETER_LAST_CACHE[unique_id]
            default = cached
        else:
            return False
        
        param = None
        try:
            param = GetParameterFromList.get_param(parameter_list, parsing_key, parameter_name, return_type, default)

            if param == cached:
                return_value = False
        except:
            if cached:
                param = cached
                return_value = False

        if param is not None and add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)

        return return_value

class GetParameterFromTable:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_table": ("JNODES_PARAMETER_TABLE",),
                "parameter_name": ("STRING", {"multiline": False}),
                "return_type": (RETURN_TYPES_LIST,),
                "add_to_png_info": ("BOOLEAN",{"default": True}),
            },
            "optional": {
                "parameter_default": (any,),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
    }

    RETURN_TYPES = (any,)
    FUNCTION = "get_parameter_from_table"

    CATEGORY = "parameter_list"
    DESCRIPTION = "Takes a table generated by MakeParameterTable and returns a \
value for the given parameter name from that table. Using MakeParameterTable has \
a higher upfront cost than GetParameterFromList but with many parameters \
this paradigm can be much, much faster."

    OUTPUT_NODE = True

    @staticmethod
    def get_param(parameter_table, parameter_name, return_type = None, parameter_default = None):
        
        param = return_paramter_from_table(parameter_table, parameter_name, parameter_default, return_type)

        return param

    def get_parameter_from_table(
            self, parameter_table, parameter_name, 
            return_type = None, add_to_png_info = True, parameter_default = None, unique_id = None, extra_pnginfo = None):

        param = GetParameterFromTable.get_param(parameter_table, parameter_name, return_type, parameter_default)
        JNODES_PARAMETER_LAST_CACHE[unique_id] = param
        
        if add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)
            
        return (param,)
    
    @classmethod
    def IS_CHANGED(s, parameter_table, parameter_name, 
            return_type = None, add_to_png_info = True, parameter_default = None, unique_id = None, extra_pnginfo = None):
        
        return_value = True

        default = parameter_default
        cached = None
        if unique_id and unique_id in JNODES_PARAMETER_LAST_CACHE and JNODES_PARAMETER_LAST_CACHE[unique_id] is not None:
            cached = JNODES_PARAMETER_LAST_CACHE[unique_id]
            default = cached
        else:
            return False
        
        param = None
        try:
            param = return_paramter_from_table(parameter_table, parameter_name, parameter_default, return_type)

            if param == cached:
                return_value = False
        except:
            if cached:
                param = cached
                return_value = False

        if param is not None and add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)

        return return_value
    
NODE_CLASS_MAPPINGS = {
    
    # parameter_list
    # Globals aren't ready yet
    "JNodes_CacheGlobalParameters": CacheGlobalParameters,
    "JNodes_MakeParameterTable": MakeParameterTable,
    "JNodes_GetParameterFromList": GetParameterFromList,
    "JNodes_GetParameterFromTable": GetParameterFromTable,

}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    # parameter_list
    "JNodes_CacheGlobalParameters": "Cache Global Parameters",
    "JNodes_MakeParameterTable": "Make Parameter Table",
    "JNodes_GetParameterFromList": "Get Parameter From List",
    "JNodes_GetParameterFromTable": "Get Parameter From Table",
    
}