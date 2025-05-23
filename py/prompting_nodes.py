import os

import folder_paths
from .logger import logger

from .utils import any, AnyType, return_random_int, make_exclusive_list, search_and_replace_from_dict

import math
import random
import re

import comfy.sd

from typing import Dict, List

from token_count import *
from aiofiles.os import replace

class SyncedStringLiteral:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_text": ("STRING", {"multiline": True}),
                "path_to_synced_txt": ("STRING", {"default": '', "multiline": False}),
                "serialize_input_text": ("BOOLEAN", {"default": False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"

    CATEGORY = "prompt"
    
    def get_string(self, path_to_synced_txt, input_text, serialize_input_text):
        return (input_text,)
    
class ParseDynamicPrompts:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "mode": (["seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                "use_same_seed_for_all_groups": ("BOOLEAN", {"default":False}),
                "enforce_different_outputs": ("BOOLEAN", {"default":False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "parse_dynamic_prompts"

    CATEGORY = "dynamic prompts"
    
    def find_match(self, input_text):
        #return re.search(r'{([^}]+)}', input_text)
        return re.search(r'{([^{}]+)}', input_text)
    
    def replace_first_occurrence(self, input_string, old_substring, new_substring):
        # Find the index of the first occurrence of old_substring
        index = input_string.find(old_substring)
    
        # If old_substring is found, replace the first occurrence and return the modified string
        if index != -1:
            return input_string[:index] + new_substring + input_string[index + len(old_substring):]
    
        # If old_substring is not found, return the original string
        return input_string
    
    def parse_dynamic_prompts(self, text: str, mode, seed, use_same_seed_for_all_groups, enforce_different_outputs):
        """
        Takes in a string with dynamic prompt notation, e.g. "I like { apple :: 0.7 | orange | banana :: 1.3 }"
        where each choice is separated by a "|" with an optional weight denoted with a double colon "::".
        Spacing is ignored. If the "mode" is "seed", then a choice with a higher weight is more likely to be chosen. 
        A choice without a specified weight has a weight of 1.0.

        In this example, banana is more likely to be chosen than orange, which is more likely to be chosen than apple.
        
        If mode is "seed", always get random index using seed
        If mode is "index", return the option at the given index
        If the index is outside of the bounds of the list, revert to "seed" behaviour.
        
        use_same_seed_for_all_groups: if False, will generate a new random seed for each 
        subsequent dynamic prompts group regardless of group contents. Otherwise, the same index will be chosen for 
        all groups unless the index is out of the bounds of the group's list. Note that deterministic results
        are not possible when this option is set to False and there are multiple dynamic prompt groups in the input text.
        
        enforce_different_outputs: if True, will try to ensure all groups output a different value, if possible. 
        Has no effect if only one group is evaluated or if the mode is not seed.
        All values are tracked per function call to try to ensure that there are no repeated values.
        It will keep getting a new seed until a new value is found or all items have been exhausted. If all items have been 
        exhausted, the last evaluated repeat will be used. Note that deterministic results
        are not possible when this option is set to True and there are multiple dynamic prompt groups in the input text.
        
        Returns the original string with dynamic prompts replaced. 
        """
        
        selected_options = set()
        
        # Extract options and weights using regular expression     
        match_count = 0   
        re_match = self.find_match(text)
        while re_match is not None:
            # Process each option to get a weighted list
            group = re_match.group(0)
            inner_group = group[1:len(group) - 1]
            options = inner_group.split('|')
            
            should_get_index = mode == "index" and seed > -1 and seed < len(options)
            
            weighted_options = []
            for option in options:
                option_components = option.split('::')
                choice = option_components[0].strip()
                weight = float(option_components[1].strip()) if len(option_components) > 1 else 0.1 if should_get_index else 1.0
                weighted_options.extend([choice] * int(weight * 10))  # Multiply weight by 10 for better granularity

            seed_to_use = seed if should_get_index or use_same_seed_for_all_groups else seed + (match_count * return_random_int(0))
            selected_option = weighted_options[seed_to_use if should_get_index else seed_to_use % len(weighted_options)]
            
            if enforce_different_outputs and selected_option in selected_options:
                exclusive_options = make_exclusive_list(weighted_options, selected_options)
                
                if len(exclusive_options) > 0:
                    seed_to_use = return_random_int(0)
                    selected_option = exclusive_options[seed_to_use % len(exclusive_options)]
                    selected_options.add(selected_option)
            else:
                selected_options.add(selected_option)
                
            text = self.replace_first_occurrence(text, group, selected_option)
            re_match = self.find_match(text)
            match_count += 1
            
        return (text,)
    
class RemoveCommentedText:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "starting_line_comment": ("STRING", {"multiline": False, "default": "#"}),
                "enclosed_comment_start": ("STRING", {"multiline": False, "default": "##"}),
                "enclosed_comment_end": ("STRING", {"multiline": False, "default": "##"}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "remove_commented_text"

    CATEGORY = "text"
    
    def remove_commented_text(
            self, text, starting_line_comment, enclosed_comment_start, enclosed_comment_end):
        # Remove text enclosed in comment decorators
        text = re.sub(rf'{re.escape(enclosed_comment_start)}[\s\S]+?{re.escape(enclosed_comment_end)}', '', text)
        
        # Then actually remove the decorators
        text = text.replace(f"{re.escape(enclosed_comment_start)}{re.escape(enclosed_comment_end)}", "")
        
        # Remove lines that start with a single "#"
        lines = text.split("\n")
        
        # Skip lines that are commented out, empty, or just a comma
        non_commented_lines = [line for line in lines if not line.strip().startswith(starting_line_comment)]
        
        # Join the non-commented lines back into a single string
        return_text = "\n".join(non_commented_lines)

        return (return_text,)
    
class SplitAndJoin:
    """
    Splits the text at the given 'split_at' token and removes items that have no text, then rejoins 
    the text using the 'join_with' token. Useful for removing multiple commas, spaces, newlines, etc.
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "split_at": ("STRING", {"multiline": False}),
                "join_with": ("STRING", {"multiline": False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "split_and_join"

    CATEGORY = "text"
        
    def split_and_join(self, text, split_at, join_with):
        if split_at is None or join_with is None:
            return (text,)
        split = text.split(split_at)
        valid_lines = [line for line in split if line.strip() != ""]
        
        return (join_with.join(valid_lines),)
    
class TrimAndStrip:
    """
    Simply removes whitespace from the head and tail of the given text.
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
        }
    }
        
    RETURN_TYPES = ("STRING",)
    FUNCTION = "trim_and_strip"

    CATEGORY = "text"
    
    def trim_and_strip(self, text):        
        return (text.strip(),)
    
class ParseWildcards:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "absolute_path_to_wildcards_directory": ("STRING", {"multiline": False}),
                "mode": (["seed", "index"],),
                "seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
                "use_same_seed_for_multiple_occurrences": ("BOOLEAN", {"default":False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "parse_wildcards"

    CATEGORY = "wildcards"
    
    def find_match(self, input_text):
        return re.search(r"__.*?__", input_text)
    
    def replace_first_occurrence(self, input_string, old_substring, new_substring):
        # Find the index of the first occurrence of old_substring
        index = input_string.find(old_substring)
    
        # If old_substring is found, replace the first occurrence and return the modified string
        if index != -1:
            return input_string[:index] + new_substring + input_string[index + len(old_substring):]
    
        # If old_substring is not found, return the original string
        return input_string
    
    def read_wildcard(self, path, mode, seed):
        with open(path, "r") as file:
            lines = file.readlines()
        
        line_count = len(lines)
        
        if mode == "index" and seed > -1 and seed < line_count:
            return_value = lines[seed]
        else:
            return_value = lines[seed % line_count]
            
        # This allows you to add a name or some notes to a particular line. For example,
        # "Large Tortoise anime, good for dreamlike aesthetic ## tortoise, turtle, huge, big, enormous, anime style"
        # Everything before the commentary divider is pruned and only what comes after is returned
        commentary_divider = " ## "
        if commentary_divider in return_value:
            return_value = return_value.split(commentary_divider)[1]
            
        return return_value.strip()

    def parse_wildcards(
            self, text: str, absolute_path_to_wildcards_directory: str, 
            mode, seed, use_same_seed_for_multiple_occurrences):
        
        """
        Takes in a string with wildcard notation, e.g. "My hair is __HairColors__"
        where HairColors.txt is defined in "absolute_path_to_wildcards_directory"
        and each line is a choice that may be selected either directly or at random, depending on the mode,
        to replace the notated wildcard. For example, you have HairColors.txt set up like this:
        
        blonde
        brown
        red
        black
        grey
        white
        
        so __HairColors__ in the source string will be replaced with one of the choices defined in the txt file.
        
        If mode is "seed", always get random index using seed
        If mode is "index", return the line at the given index
        If the index is outside of the bounds of the list, revert to "seed" behaviour.
        
        use_same_seed_for_multiple_occurrences: if False, will generate a new random seed for each 
        subsequent occurrence of the same wildcard. For example, two instances of "__HairColors__" 
        might both return "brown" if True, or "brown" and "blonde" if False. Note that deterministic results
        are not possible when this option is set to False and there are multiple similar wildcards in the input text.
        
        Returns the original string with wildcards replaced. 
        """
        
        files, folders_all = folder_paths.recursive_search(absolute_path_to_wildcards_directory)
        
        previously_found_wildcards = []

        re_match = self.find_match(text)
        while re_match is not None:
            group = re_match.group(0)
            wildcard_name = group[2:len(group) - 2]
            wildcard_filename = wildcard_name.replace("\\", "/") + ".txt"
            
            if wildcard_filename in files:
                seed_to_use = seed
                
                if not use_same_seed_for_multiple_occurrences:
                    if wildcard_name in previously_found_wildcards:
                        seed_to_use = return_random_int(0)
                    else:
                        previously_found_wildcards.append(wildcard_name)

                wildcard_replacement_text = self.read_wildcard(
                    os.path.join(
                        absolute_path_to_wildcards_directory, wildcard_filename), 
                    mode, seed_to_use)
                
                text = self.replace_first_occurrence(text, group, wildcard_replacement_text)
            else:
                print(f"Wildcard file not found for {group}")
                # Remove the wilcard from the output text so it doesn't get continuously evaluated
                text = self.replace_first_occurrence(text, group, "")
            
            re_match = self.find_match(text)

        return (text.strip(),)
    
class LoraExtractor:
    RETURN_TYPES = ("STRING",)
    FUNCTION = "parse_out_loras_from_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"string": ("STRING", {"default": "", "multiline": True})}}

    def parse_out_loras_from_string(self, string):
       # Use regular expression to find text enclosed in <>
        pattern = r'<(.*?)>'
        
        # Find all matches
        matches = re.findall(pattern, string)
        
        # Add < and > to each match and create a new string with each match on a new line
        new_text = '\n'.join(['<' + re_match + '>' for re_match in matches if "lora" in re_match])
            
        return (new_text,)
    
class RemoveParseableDataForInference:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "in_string": ("STRING", {"default": "", "multiline": True}),
        }
    }
    
    RETURN_TYPES = ("STRING",)
    FUNCTION = "remove_parseable_data_from_string_wrapper"

    def remove_parseable_data_from_string(self, in_string):
        # Use regular expression to find text enclosed in <>
        # and newline characters, and replace double commas
        pattern = r'<(.*?)>|(\n)|(\\n)'
        
        def remove_match(match):
            return ''

        # Use re.sub with a custom replacement function
        result = re.sub(pattern, remove_match, in_string)
        
        # Split the string by commas, remove empty elements, and join back into a string
        result = ','.join(filter(None, result.split(',')))
        
        return result.strip()
    
    def remove_parseable_data_from_string_wrapper(self, in_string):
        return (self.remove_parseable_data_from_string(in_string),)
    
class PromptBuilderSingleSubject:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "subject": ("STRING", {"default": "", "multiline": True}),                             # Focus of the generation
                "hair": ("STRING", {"default": "", "multiline": True}),                                # Hair style/color if applicable
                "clothing": ("STRING", {"default": "", "multiline": True}),                            # Clothing and accessories, if applicable.
                "actions": ("STRING", {"default": "", "multiline": True}),                             # What the subject is doing, best described using natural language
                "extras": ("STRING", {"default": "", "multiline": True}),                              # modifiers like 1girl, 4k, best quality, etc
                "network_definitions_and_triggers": ("STRING", {"default": "", "multiline": True}),    # lora/lycoris/et al definitions and their trigger prompts (<lora:cutedogv3:0.7:1.0> cute dog)
        }
    }
        
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_string"
    
    def get_string(self, subject = "", hair = "", clothing = "", actions = "", extras = "", network_definitions_and_triggers = ""):
        return (f"{subject}\n{hair}\n{clothing}\n{actions}\n{extras}\n{network_definitions_and_triggers}",)
    
class SearchAndReplaceFromList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "list": ("STRING", {"multiline": False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "search_and_replace_from_list"
    
    def search_and_replace_from_list(self, text: str, list: str):
        
        """
        Takes in a string list structured as below, on each line with a -> between the search and replace strings, into a list
        ---
        search0->replace0
        search string->replace string
        ---
        Then replaces all occurrences of the list's search strings with the list's replace strings in one go
        """
        
        replacements = list.split('\n')
    
        replacement_dict = {}
        for line in replacements:
            search, replace = line.strip().split("->")
            replacement_dict[search] = replace

        return (search_and_replace_from_dict(text, replacement_dict),)
    
class SearchAndReplaceFromFile:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "replacements_file_path": ("STRING", {"multiline": False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "search_and_replace_from_file"
    
    def search_and_replace_from_file(self, text: str, replacements_file_path: str):
        
        """
        loads a file with strings structured as below, on each line with a -> between the search and replace strings, into a list
        ---
        search0->replace0
        search string->replace string
        ---
        Then replaces all occurrences of the list's search strings with the list's replace strings in one go
        """
        
        if not os.path.exists(replacements_file_path):
            logging_prompt_control.logger_prompt_control.warning(f"Prompt will not be edited. File not found at '{file_path}'.")
            return text
        
        with open(replacements_file_path, "r", encoding="utf8") as file:
            replacements = file.readlines()
    
        replacement_dict = {}
        for line in replacements:
            search, replace = line.strip().split("->")
            replacement_dict[search] = replace

        return (search_and_replace_from_dict(text, replacement_dict),)
    
class SearchAndReplace:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "search_term": ("STRING", {"multiline": False}),
                "replace_with": ("STRING", {"multiline": False}),
        }
    }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "search_and_replace"
    
    def search_and_replace(self, text : str, search_term : str, replace_with : str):
        
        replacement_dict = {}
        replacement_dict[search_term] = replace_with

        return (search_and_replace_from_dict(text, replacement_dict),)
    
class AddOrSetMetaDataKey:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "key": ("STRING", {"default": '', "multiline": False}),
                "value": ("STRING", {"default": '', "multiline": True}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "add_or_set_metadata_key"
    
    OUTPUT_NODE = True
    
    def add_param_to_png_info(self, extra_pnginfo, parameter_name, param):
        if extra_pnginfo:
            extra_pnginfo[parameter_name] = str(param).strip()

    def add_or_set_metadata_key(self, key, value, extra_pnginfo=None):
        return_true = False
        try:
            self.add_param_to_png_info(extra_pnginfo, key, value)
            return_true = True
        except Exception as e:
            logger.error(f'{e}')
        return (return_true,)
    
    @classmethod
    def IS_CHANGED(s, key, value, extra_pnginfo=None):
        return float("nan") # Run every time
    
class SetPositivePromptInMetaData:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"default": '', "multiline": True}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "set_prompt"
    
    OUTPUT_NODE = True

    def set_prompt(self, prompt, extra_pnginfo=None):
        return AddOrSetMetaDataKey().add_or_set_metadata_key("Positive prompt", prompt, extra_pnginfo)
    
class SetNegativePromptInMetaData:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"default": '', "multiline": True}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "set_prompt"
    
    OUTPUT_NODE = True

    def set_prompt(self, prompt, extra_pnginfo=None):
        return AddOrSetMetaDataKey().add_or_set_metadata_key("Negative prompt", prompt, extra_pnginfo)
    
class RemoveMetaDataKey:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "key": ("STRING", {"default": '', "multiline": False}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "remove_metadata_key"
    
    OUTPUT_NODE = True

    def remove_metadata_key(self, key, extra_pnginfo=None):
        return_true = False
        try:
            if extra_pnginfo and key in extra_pnginfo:
                del extra_pnginfo[key]
                return_true = True
        except Exception as e:
            logger.error(f'{e}')
        return (return_true,)
    
    @classmethod
    def IS_CHANGED(s, key, value, extra_pnginfo=None):
        return float("nan") # Run every time

class SetMetadataA1111:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images_passthrough": ("IMAGE", ),
            },
            "optional": {
                "positive_prompt": ("STRING", {"default": "", "multiline": True}),
                "negative_prompt": ("STRING", {"default": "", "multiline": True}),
                "seed_number": ("INT", {"default": 0, "min": 0}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0}),
                "model_name": ("STRING", {"default": "", "multiline": False}),
                "sampler_name": ("STRING", {"default": "", "multiline": False}),
                "scheduler_name": ("STRING", {"default": "", "multiline": False}),
                "vae_name": ("STRING", {"default": "", "multiline": False}),
                "clip_skip": ("INT", {"default": -1, "max": -1}),
                "image_width": ("INT", {"default": 0}),
                "image_height": ("INT", {"default": 0}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    DESCRIPTION = "A node that adds basic generation data to an image's meta in a manner compatible with A1111. This node runs every generation to ensure the meta is always added, so ensure it's the last node before saving the image or video to avoid unnecessary node execution for any nodes after this node."
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "set_meta"

    def set_meta(
        self, images_passthrough, positive_prompt, negative_prompt, seed_number, steps, cfg, 
        model_name, sampler_name, scheduler_name, vae_name, clip_skip, image_width, image_height, extra_pnginfo=None):
        if len(images_passthrough) > 0:
            shape = images_passthrough[0].shape
            
            parameters = f"{positive_prompt.strip()}\n"

            if negative_prompt:
                parameters += f"Negative prompt: {negative_prompt.strip()}\n"

            if steps:
                parameters += f"Steps: {steps}, "

            if sampler_name:
                parameters += f"Sampler: {sampler_name}{f' {scheduler_name}' if scheduler_name != 'normal' else ''}, "
                
            if cfg:
                parameters += f"CFG Scale: {cfg}, "
                
            if seed_number:
                parameters += f"Seed: {seed_number}, "
                
            parameters += f"Size: {image_width if image_width > 0 else shape[1]}x{image_height if image_height > 0 else shape[0]}, "

            if model_name:
                parameters += f"Model: {model_name}, "

            if vae_name:
                parameters += f"VAE: {vae_name}, "

            if clip_skip:
                parameters += f"Clip skip: {clip_skip * -1}, "

            if parameters.endswith(", "):
                parameters = parameters.strip()[:-1]

            if parameters.strip():
                AddOrSetMetaDataKey().add_or_set_metadata_key("parameters", parameters, extra_pnginfo)

        return (images_passthrough,)
    
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan") # Run every time
  

class TokenCounter:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
                "clip": ("CLIP", ),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    OUTPUT_NODE = True
    RETURN_TYPES = ("INT", "STRING", )
    RETURN_NAMES = ("COUNT", "COUNT_AS_STRING",)
    FUNCTION = "count_tokens_and_display"
    
    def clean_text(self, text):
        # Remove prompt weights
        cleaned_text = re.sub(r':\d+\.*\d*', '', str(text))
        
        # Remove parentheses
        cleaned_text = cleaned_text.replace("(", "").replace(")", "")
        
        # Remove "embedding" decorator
        cleaned_text = cleaned_text.replace("embedding:", "")
        
        # Remove text in <>, newlines and multiple commas
        cleaned_text = RemoveParseableDataForInference().remove_parseable_data_from_string(cleaned_text)
        
        return cleaned_text.strip()
    
    def return_token_count_and_string_representation(self, text, clip):
        tokenization = clip.tokenize(text)
        tokenizer_inner = clip.tokenizer.clip_g if hasattr(clip.tokenizer, 'clip_g') else clip.tokenizer.clip_l
        count = 0
        for key, value in tokenization.items():
            for list in value:
                for token in list:
                    if token[0] != tokenizer_inner.start_token and token[0] != tokenizer_inner.end_token and token[0] != tokenizer_inner.pad_token:
                        count += 1

        if count > 1:
            count = math.ceil(count / len(tokenization))
        raw_number_of_sections = (count / tokenizer_inner.max_length) or 1
        number_of_sections = math.ceil(raw_number_of_sections)
        # Calculate how many tokens out of the max of all combined sections (i.e. 30/75 for 1 section or 120/150 for 2 sections, etc)
        combined_max = tokenizer_inner.max_length * number_of_sections
        count_as_string = f"{count} / {combined_max}"
        
        return count, count_as_string
    
    def count_tokens_and_display(self, text: str, clip, unique_id = None, extra_pnginfo=None):
        
        cleaned_text = self.clean_text(text)
        
        count, count_as_string = self.return_token_count_and_string_representation(cleaned_text, clip)
        
        return {"ui": {"text": (count_as_string,)}, "result": (count, count_as_string,)}

class SeparateStringByDelimiters:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_string": ("STRING", {"forceInput": True}),
                "delimiter_a": ("STRING",),
                "delimiter_b": ("STRING",),
                "delimiter_c": ("STRING",),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING",)
    RETURN_NAMES = ("string_all", "string_a", "string_b", "string_c",)
    FUNCTION = "separate_string_by_delimiters"
    DESCRIPTION = "This function processes a multiline string and separates it into four different strings based on the given delimiters."

    def separate_string_by_delimiters(self, input_string, delimiter_a, delimiter_b, delimiter_c):

        """
        This function processes a multiline string and separates it into four different strings based on 
        the given delimiters. The string is split into lines, and each line is checked to see if it starts 
        with one of the delimiters. The function removes the delimiter from each line and retains the newline 
        character so that the output strings maintain the original formatting.

        Parameters:
        - input_string (str): The multiline string that needs to be processed.
        - delimiter_a (str): The delimiter to check for the first category.
        - delimiter_b (str): The delimiter to check for the second category.
        - delimiter_c (str): The delimiter to check for the third category.

        Returns:
        - tuple: A tuple containing four strings:
            - string_all (str): Lines that do not start with any of the delimiters.
            - string_a (str): Lines that start with delimiter_a, with the delimiter removed.
            - string_b (str): Lines that start with delimiter_b, with the delimiter removed.
            - string_c (str): Lines that start with delimiter_c, with the delimiter removed.
        """

        # Initialize the four result strings
        string_all = ""
        string_a = ""
        string_b = ""
        string_c = ""

        # Split the input string into lines
        lines = input_string.splitlines()

        # Process each line
        for line in lines:
            line = line.strip()
            if line.startswith(delimiter_a):
                string_a += line[len(delimiter_a):] + "\n"  # Remove delimiter_a and retain the newline
            elif line.startswith(delimiter_b):
                string_b += line[len(delimiter_b):] + "\n"  # Remove delimiter_b and retain the newline
            elif line.startswith(delimiter_c):
                string_c += line[len(delimiter_c):] + "\n"  # Remove delimiter_c and retain the newline
            else:
                string_all += line + "\n"  # For lines not starting with any delimiter

        return (string_all, string_a, string_b, string_c,)
    
NODE_CLASS_MAPPINGS = {
    
    "JNodes_SyncedStringLiteral": SyncedStringLiteral,
    "JNodes_ParseDynamicPrompts": ParseDynamicPrompts,
    "JNodes_RemoveCommentedText": RemoveCommentedText,
    "JNodes_SplitAndJoin": SplitAndJoin,
    "JNodes_TrimAndStrip": TrimAndStrip,
    "JNodes_ParseWildcards": ParseWildcards,
    "JNodes_LoraExtractor": LoraExtractor,
    "JNodes_RemoveParseableDataForInference": RemoveParseableDataForInference,
    "JNodes_PromptBuilderSingleSubject": PromptBuilderSingleSubject,
    "JNodes_SearchAndReplaceFromList": SearchAndReplaceFromList,
    "JNodes_SearchAndReplaceFromFile": SearchAndReplaceFromFile,
    "JNodes_SearchAndReplace": SearchAndReplace,
    "JNodes_AddOrSetMetaDataKey" : AddOrSetMetaDataKey,
    "JNodes_SetPositivePromptInMetaData": SetPositivePromptInMetaData,
    "JNodes_SetNegativePromptInMetaData": SetNegativePromptInMetaData,
    "JNodes_RemoveMetaDataKey" : RemoveMetaDataKey,
    "JNodes_SetMetadataA1111": SetMetadataA1111,
    "JNodes_TokenCounter": TokenCounter,
    "JNodes_SeparateStringByDelimiters": SeparateStringByDelimiters,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    "JNodes_SyncedStringLiteral": "Synced String Literal",
    "JNodes_ParseDynamicPrompts": "Parse Dynamic Prompts",
    "JNodes_RemoveCommentedText": "Remove Commented Text",
    "JNodes_SplitAndJoin": "Split And Join",
    "JNodes_TrimAndStrip": "Trim And Strip",
    "JNodes_ParseWildcards": "Parse Wildcards",
    "JNodes_LoraExtractor": "Lora Extractor",
    "JNodes_RemoveParseableDataForInference": "Remove Parseable Data For Inference",
    "JNodes_PromptBuilderSingleSubject": "Prompt Builder Single Subject",
    "JNodes_SearchAndReplaceFromList": "Search And Replace From List",
    "JNodes_SearchAndReplaceFromFile": "Search And Replace From File",
    "JNodes_SearchAndReplace": "Search And Replace",
    "JNodes_AddOrSetPngInfoKey" : "Add Or Set Png Info Key",
    "JNodes_SetPositivePromptInMetaData": "Set Positive Prompt In MetaData",
    "JNodes_SetNegativePromptInMetaData": "Set Negative Prompt In MetaData",
    "JNodes_RemoveMetaDataKey" : "Remove Metadata Key",
    "JNodes_SetMetadataA1111": "Set Metadata For A1111",
    "JNodes_TokenCounter": "Token Counter",
    "JNodes_SeparateStringByDelimiters": "Separate String By Delimiters",

}