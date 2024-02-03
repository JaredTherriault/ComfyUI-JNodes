import os

import re

import folder_paths
from .logger import logger

import torch
import random

import numpy as np

from PIL import Image
from typing import Dict, List, Optional, Union

class AnyType(str):
  """A special class that is always equal in not equal comparisons. Credit to pythongosssss and rgthree"""

  def __ne__(self, __value: object) -> bool:
    return False

any = AnyType("*")

    
VIDEO_FORMATS_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_formats")
VIDEO_FORMATS = [x[:-5] for x in os.listdir(VIDEO_FORMATS_DIRECTORY)]

JNODES_IMAGE_FORMAT_TYPES = ["jpg", "png", "gif", "webp", "apng", "mjpeg"] + VIDEO_FORMATS
JNODES_VAE_LIST = ["Baked VAE"] + folder_paths.get_filename_list("vae")

ACCEPTED_VIDEO_EXTENSIONS = ['webm', 'mp4', 'mkv']
ACCEPTED_ANIMATED_IMAGE_EXTENSIONS = ['gif', 'webp', 'apng', 'mjpeg']
ACCEPTED_STILL_IMAGE_EXTENSIONS = ['gif', 'webp', 'png', 'jpg', 'jpeg']


@staticmethod
def return_random_int(min = 1, max = 100000):
    return random.randint(min, max)

def make_exclusive_list(original_list, items_to_remove):
    return [item for item in original_list if item not in items_to_remove]
    
def get_file_extension(filename):
    _, extension = os.path.splitext(filename)
    return extension

def get_file_extension_without_dot(filename):
    _, extension = os.path.splitext(filename)
    return extension[1:]

def is_webp(filename):
     return get_extension(filename) == "webp"

def is_gif(filename):
    return get_extension(filename) == "gif"

def is_video(filename):
    return get_extension(filename) in ACCEPTED_VIDEO_EXTENSIONS

def is_acceptable_image_or_video(filename):
    return get_file_extension_without_dot(filename) in JNODES_IMAGE_FORMAT_TYPES


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
