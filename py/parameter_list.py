import os

from .logger import logger

from .utils import any, AnyType

import json
import re

import hashlib

import comfy.sd

from typing import Dict, List

JNODES_PARAMETER_LIST = {}

JNODES_PARAMETER_LAST_CACHE = {}

RETURN_TYPES_LIST = ["auto", "string"]

PARAMETER_LIST_HINT_TEXT = "<params:my_string_variable:string>\n<params:my_number_variable: 0.5>"

def parse_parameter_list(parameter_list, parsing_key, break_on_finding_term : str = None):

    key_value_pairs = {}

    if parameter_list and parsing_key:
        regex = r'<' + re.escape(parsing_key) + r':(.+?)>'
        
        matches = re.findall(regex, parameter_list)
        
        for match in matches:
            split = match.split(':')
            key = split.pop(0).strip()
            if key not in key_value_pairs: # take the first value, do not overwrite
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

def return_paramter_from_list(parsed_list, parameter_name, parameter_default = "0", explicit_return_type = None):
    if parsed_list and parameter_name in parsed_list:
        return auto_convert_output(parsed_list[parameter_name], explicit_return_type)
    else:
        logger.info(f"Did not find parameter_name '{parameter_name}' in parameter_list. Using '{parameter_default if len(str(parameter_default)) < 5 else "given default"}'.")
        return auto_convert_output(parameter_default, explicit_return_type)
    
def add_param_to_png_info(extra_pnginfo, parameter_name, param):
    if extra_pnginfo:
        extra_pnginfo[parameter_name] = str(param).strip()

class ParseParametersToGlobalList:
    @classmethod        
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_list": ("STRING", {"multiline": True, "default": PARAMETER_LIST_HINT_TEXT}),
                "parsing_key": ("STRING", {"multiline": False, "default": "params"}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "parse_parameters_to_global_list"

    CATEGORY = "parameter_list"
    
    def parse_parameters_to_global_list(self, parameter_list, parsing_key):
        JNODES_PARAMETER_LIST = parse_parameter_list(parameter_list, parsing_key)
        
        return (parameter_list,)
    
class GetParameterGlobal:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_name": ("STRING", {"multiline": False}),
                "return_type": (RETURN_TYPES_LIST,),
                "add_to_png_info": ("BOOLEAN",{"default": True}),
            },
            "optional": {
                "parameter_default": (any,),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
    }

    RETURN_TYPES = (any,)
    FUNCTION = "get_parameter_global"

    CATEGORY = "parameter_list"
    
    def get_parameter_global(
            self, parameter_name, return_type = None, add_to_png_info = True, 
            parameter_default = None, extra_pnginfo = None):
        
        param = return_paramter_from_list(JNODES_PARAMETER_LIST, parameter_name, parameter_default, return_type)
        
        if add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)
            
        return (param,)
    
    @classmethod
    def IS_CHANGED(s):
        m = hashlib.sha256()
        m.update(JNODES_PARAMETER_LIST)
        return m.digest().hex()

    @classmethod
    def VALIDATE_INPUTS(s):
        return parameter_name in JNODES_PARAMETER_LIST
        
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
        parsed_list = parse_parameter_list(parameter_list, parsing_key, parameter_name) 
        
        param = return_paramter_from_list(parsed_list, parameter_name, parameter_default, return_type)

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
    
NODE_CLASS_MAPPINGS = {
    
    # parameter_list
    # Globals aren't ready yet
    #"JNodes_ParseParametersToGlobalList": ParseParametersToGlobalList,
    #"JNodes_GetParameterGlobal": GetParameterGlobal,
    "JNodes_GetParameterFromList": GetParameterFromList,

}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    # parameter_list
    "JNodes_ParseParametersToGlobalList": "Parse Parameters To Global List",
    "JNodes_GetParameterGlobal": "Get Parameter Global",
    "JNodes_GetParameterFromList": "Get Parameter From List",
    
}