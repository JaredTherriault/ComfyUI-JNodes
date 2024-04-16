import os

import json
import re

import folder_paths
from .logger import logger

import torch
import random

import numpy as np

from PIL import Image
from typing import Dict, List, Optional, Union

import mimetypes

class AnyType(str):
  """A special class that is always equal in not equal comparisons. Credit to pythongosssss and rgthree"""

  def __ne__(self, __value: object) -> bool:
    return False

any = AnyType("*")

    
VIDEO_FORMATS_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_formats")
VIDEO_FORMATS = []

# Iterate over each file in the directory
for filename in os.listdir(VIDEO_FORMATS_DIRECTORY):
    filepath = os.path.join(VIDEO_FORMATS_DIRECTORY, filename)
    with open(filepath, 'r') as file:
        # Parse the JSON content
        data = json.load(file)
        # Get the value of the "extension" key
        extension = data.get("extension")
        # Add the extension value to the set
        if extension not in VIDEO_FORMATS:
            VIDEO_FORMATS.append(extension)

JNODES_IMAGE_FORMAT_TYPES = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "apng", "mjpeg"] + VIDEO_FORMATS
JNODES_VAE_LIST = ["Baked VAE"] + folder_paths.get_filename_list("vae")

ACCEPTED_UPLOAD_VIDEO_EXTENSIONS = ['webm', 'mp4', 'mkv', 'ogg'] + VIDEO_FORMATS
ACCEPTED_BROWSER_VIDEO_EXTENSIONS = ['webm', 'mp4', 'ogg'] # Extensions of videos that will play in most browsers

ACCEPTED_ANIMATED_IMAGE_EXTENSIONS = ['gif', 'webp', 'apng', 'mjpeg']
ACCEPTED_STILL_IMAGE_EXTENSIONS = ['gif', 'webp', 'png', 'jpg', 'jpeg', 'jfif']
ALL_ACCEPTED_IMAGE_EXTENSIONS = ACCEPTED_STILL_IMAGE_EXTENSIONS + ACCEPTED_ANIMATED_IMAGE_EXTENSIONS

ALL_ACCEPTED_UPLOAD_VISUAL_EXTENSIONS = ACCEPTED_UPLOAD_VIDEO_EXTENSIONS + ALL_ACCEPTED_IMAGE_EXTENSIONS

ALL_ACCEPTED_BROWSER_VISUAL_EXTENSIONS = ACCEPTED_BROWSER_VIDEO_EXTENSIONS + ALL_ACCEPTED_IMAGE_EXTENSIONS



@staticmethod
def return_random_int(min = 1, max = 100000):
    return random.randint(min, max)

def convert_relative_comfyui_path_to_full_path(directory_name = "output"):
    # Get the directory containing this file
    directory = os.path.dirname(os.path.realpath(__file__))
    
    # Find the position of base ComfyUI path
    index = directory.find("custom_nodes")
    
    # Chop off everything after "ComfyUI"
    comfy_path = os.path.join(directory[:index])
    
    return os.path.join(comfy_path, directory_name)

def resolve_file_path(in_file_path):
    if os.path.isabs(in_file_path):
        return in_file_path
    else: # Relative path
        return convert_relative_comfyui_path_to_full_path(in_file_path)

def highest_common_folder(path1, path2):
    # Split the paths into their components
    path1_parts = os.path.normpath(path1).split(os.path.sep)
    path2_parts = os.path.normpath(path2).split(os.path.sep)

    # Find the minimum length of the two paths
    min_length = min(len(path1_parts), len(path2_parts))

    # Initialize the highest common folder
    common_folder = ""

    # Iterate over the components of both paths
    for i in range(min_length):
        if path1_parts[i] == path2_parts[i]:
            # If the components match, add them to the common folder
            common_folder = os.path.join(common_folder, path1_parts[i])
        else:
            # If the components don't match, stop the iteration
            break

    return common_folder

def make_exclusive_list(original_list, items_to_remove):
    return [item for item in original_list if item not in items_to_remove]
    
def get_file_extension(filename):
    _, extension = os.path.splitext(filename)
    return extension

def get_file_extension_without_dot(filename):
    _, extension = os.path.splitext(filename)
    return extension[1:]

def is_webp(filename):
     return get_file_extension_without_dot(filename).lower() == "webp"

def is_gif(filename):
    return get_file_extension_without_dot(filename).lower() == "gif"

def is_video(filename):
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type and mime_type.startswith('video')

def is_image(filename):
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type and mime_type.startswith('image')

def is_acceptable_image_or_video_for_upload(filename):
    return (is_image(filename) or is_video(filename)) and get_file_extension_without_dot(filename) in ALL_ACCEPTED_UPLOAD_VISUAL_EXTENSIONS

def is_acceptable_image_or_video_for_browser_display(filename):
    return (is_image(filename) or is_video(filename)) and get_file_extension_without_dot(filename) in ALL_ACCEPTED_BROWSER_VISUAL_EXTENSIONS

def pil2tensor(image: Union[Image.Image, List[Image.Image]]) -> torch.Tensor:
    if isinstance(image, list):
        return torch.cat([pil2tensor(img) for img in image], dim=0)

    return torch.from_numpy(np.array(image).astype(np.float32) / 255.0).unsqueeze(0)

def search_and_replace_from_dict(text, replacement_dict : Dict, consider_special_characters = True):
    
    def replace(match_text):
        return replacement_dict[match_text.group(0)]

    if consider_special_characters:
        return re.sub('|'.join(map(re.escape, replacement_dict.keys())), replace, text).strip()
    else:
        return re.sub('|'.join(r'\b%s\b' % re.escape(s) for s in replacement_dict.keys()), replace, text).strip()

# Check if an object is a PIL Image
def is_pil_image(obj):
    return isinstance(obj, Image.Image)

# Check if an object is a PyTorch tensor
def is_torch_tensor(obj):
    return isinstance(obj, torch.Tensor)
