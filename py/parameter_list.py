import os

from .logger import logger

from .utils import any, AnyType

import json
import re

import comfy.sd

from typing import Dict, List

JNODES_PARAMETER_LIST = {}

RETURN_TYPES = ["auto", "string"]

PARAMETER_LIST_HINT_TEXT = "<jnodes_param:my_string_variable:string>\n<jnodes_param:my_number_variable: 0.5>"

def parse_parameter_list(parameter_list, parsing_key, break_on_finding_term : str = None):
    regex = r'<' + re.escape(parsing_key) + r':(.+?)>'
    
    matches = re.findall(regex, parameter_list)
    key_value_pairs = {}
    
    for match in matches:
        pair = match.split(':')
        key = pair[0].strip()
        if key not in key_value_pairs: # take the first value, do not overwrite
            if len(pair) > 1:
                value = pair[1].strip()
            else: # If no parameter specified, assume it's a boolean
                value = True;
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

def return_paramter_from_list(list, parameter_name, parameter_default, explicit_return_type = None):
    if parameter_name in list:
        return auto_convert_output(list[parameter_name], explicit_return_type)
    else:
        logger.warning(f"Did not find parameter_name ({parameter_name}) in parameter_list. Using parameter_default (or 0).")
        return auto_convert_output(parameter_default if parameter_default is not None else "0", explicit_return_type)
    
def add_param_to_png_info(extra_pnginfo, parameter_name, param):
    if extra_pnginfo:
        extra_pnginfo[parameter_name] = str(param)

class ParseParametersToGlobalList:
    @classmethod        
    def INPUT_TYPES(s):
        return {
            "required": {
                "parameter_list": ("STRING", {"multiline": True, "default": PARAMETER_LIST_HINT_TEXT}),
                "parsing_key": ("STRING", {"multiline": False, "default": "params"}),
        }
    }

    OUTPUT_NODE = True
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
                "return_type": (RETURN_TYPES,),
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
                "return_type": (RETURN_TYPES,),
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
    FUNCTION = "get_parameter_from_list"

    CATEGORY = "parameter_list"
    
    def get_parameter_from_list(
            self, parameter_list, parsing_key, parameter_name, 
            return_type = None, add_to_png_info = True, parameter_default = None, extra_pnginfo = None):
        
        # early out when finding first instance of parameter_name
        list = parse_parameter_list(parameter_list, parsing_key, parameter_name) 
        
        param = return_paramter_from_list(list, parameter_name, parameter_default, return_type)
        
        if add_to_png_info:
            add_param_to_png_info(extra_pnginfo, parameter_name, param)
            
        return (param,)
    