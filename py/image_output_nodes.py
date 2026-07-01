import os
import sys
from pathlib import Path

import folder_paths
from .logger import logger
from .misc import *
from .utils import *

from datetime import datetime
import locale

import copy
import cv2
import json
import math
import random
import re
import shutil
import subprocess
import torch
import piexif
import piexif.helper

import numpy as np

import comfy.sd
from nodes import SaveImage
from comfy_extras.nodes_video import CreateVideo as ComfyCreateVideo
from comfy_extras.nodes_video import SaveVideo as ComfySaveVideo
from comfy_api.latest import io, ui, Input, InputImpl, Types
from comfy.cli_args import args
from fractions import Fraction
from comfy.utils import common_upscale

from PIL import Image, ImageSequence
from PIL.PngImagePlugin import PngInfo
from typing import Dict, List

FFMPEG_PATH = shutil.which("ffmpeg")
if FFMPEG_PATH is None:
    logger.info("ffmpeg could not be found. Using ffmpeg from imageio-ffmpeg.")
    from imageio_ffmpeg import get_ffmpeg_exe
    try:
        FFMPEG_PATH = get_ffmpeg_exe()
    except:
        logger.warning("ffmpeg could not be found. Outputs that require it have been disabled")

class SaveVideo():
    '''
    Based on work done by Kosinkadink as a part of the Video Helper Suite.
    '''
    @classmethod
    def INPUT_TYPES(s):
        # Get the list of filenames (including .json files) in the directory
        file_names = os.listdir(VIDEO_FORMATS_DIRECTORY)

        # Filter out only the JSON files (those ending with .json)
        json_files = [filename for filename in file_names if filename.endswith(".json")]

        # Generate the video format names by removing ".json" and prefixing with "video/"
        video_formats = ["video/" + filename[:-5] for filename in json_files]

        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("INT", {"default": 8, "min": 1, "step": 1},),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "filename_format": ("STRING", {"default": "Comfy%counter%"}),
                "output_format": (["image/gif", "image/webp", "image/apng"] + video_formats,),
                "save_to_output_dir": ("BOOLEAN", {"default": True}),
                "quality": ("INT", {"default": 95, "min": 0, "max": 100, "step": 1}),
                "save_metadata": ("BOOLEAN", {"default": True}),
                "save_workflow": ("BOOLEAN", {"default": True}),
                "audio_file": ("STRING", {"default": ""}),
                "batch_size": ("INT", {"default": 128, "min": 32, "step": 1}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    OUTPUT_NODE = True
    FUNCTION = "combine_video"

    def combine_video(
        self,
        images,
        frame_rate: int,
        loop_count: int,
        filename_format="Comfy%counter%",
        output_format="image/webp",
        save_to_output_dir=True,
        quality=95,
        save_metadata=True,
        save_workflow=True,
        audio_file="",
        batch_size=128,
        prompt=None,
        extra_pnginfo=None
    ):

        
        audio_options = {}
        audio_options["audio_input_path"] = audio_file
        audio_options["clip_audio"] = False

        return SaveVideoWithOptions().combine_video(
            images, frame_rate, loop_count,
            filename_format, output_format,
            save_to_output_dir, quality,
            save_metadata, save_workflow,
            batch_size, audio_options,
            prompt, extra_pnginfo
        )

class SaveVideoWithOptions():
    
    # A store for subclasses to read (for example, to upload the resulting file)
    # Does nothing on its own, this was just an extension point I needed for a project
    LAST_FILE_PATH = ""

    '''
    Based on work done by Kosinkadink as a part of the Video Helper Suite.
    '''
    @classmethod
    def INPUT_TYPES(s):
        # Get the list of filenames (including .json files) in the directory
        file_names = os.listdir(VIDEO_FORMATS_DIRECTORY)

        # Filter out only the JSON files (those ending with .json)
        json_files = [filename for filename in file_names if filename.endswith(".json")]

        # Generate the video format names by removing ".json" and prefixing with "video/"
        video_formats = ["video/" + filename[:-5] for filename in json_files]

        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("INT", {"default": 8, "min": 1, "step": 1},),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "filename_format": ("STRING", {"default": "Comfy_%date%_%time%_%counter%"}),
                "output_format": (["image/gif", "image/webp", "image/apng"] + video_formats,),
                "save_to_output_dir": ("BOOLEAN", {"default": True}),
                "quality": ("INT", {"default": 95, "min": 0, "max": 100, "step": 1}),
                "save_metadata": ("BOOLEAN", {"default": True}),
                "save_workflow": ("BOOLEAN", {"default": True}),
                "batch_size": ("INT", {"default": 128, "min": 32, "step": 1}),
                "save_prompt_server_prompt": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "audio_options": ("AUDIO_INPUT_OPTIONS",),
                "additional_metadata_json": ("STRING", {"tooltip": "Optionally add a secondary set of metadata key-value pairs from a stringified json. Will overwrite keys in extra_pnginfo if a key has the same name."}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "combine_video"

    @staticmethod
    def determine_file_name(filename, full_output_folder, output_format):

        format_type, format_ext_mime = output_format.split("/")
        format_ext = format_ext_mime

        for ext in ACCEPTED_IMAGE_AND_VIDEO_EXTENSIONS_COMPENDIUM:
            if ext in format_ext_mime:
                format_ext = ext 
                break
 
        file_path = os.path.join(full_output_folder, f"{filename}.{format_ext}")

        new_filename = filename

        locale.setlocale(locale.LC_TIME, '')
        local_time = datetime.now()

        date_token = "%date%"
        if date_token in new_filename:
            safe_date_str = local_time.strftime('%Y-%m-%d')
            new_filename = new_filename.replace(date_token, str(safe_date_str))

        time_token = "%time%"
        if time_token in new_filename:
            safe_time_str = local_time.strftime('%H-%M-%S')
            new_filename = new_filename.replace(time_token, str(safe_time_str))

        if "%counter%" in new_filename:
            counter = 1
            candidate_filename = new_filename.replace("%counter%", str(counter).zfill(5))
            file_path = os.path.join(full_output_folder, f"{candidate_filename}.{format_ext}")

            while os.path.exists(file_path):
                counter += 1
                candidate_filename = new_filename.replace("%counter%", str(counter).zfill(5))
                file_path = os.path.join(full_output_folder, f"{candidate_filename}.{format_ext}")
        else:
            file_path = os.path.join(full_output_folder, f"{new_filename}.{format_ext}")

        return file_path, format_type, format_ext_mime, format_ext

    def combine_video(
        self,
        images,
        frame_rate: int,
        loop_count: int,
        filename_format="Comfy%counter%",
        output_format="image/webp",
        save_to_output_dir=True,
        quality=95,
        save_metadata=True,
        save_workflow=True,
        batch_size=128,
        save_prompt_server_prompt=True,
        audio_options=None,
        additional_metadata_json=None,
        prompt=None,
        extra_pnginfo=None
    ):

        # get output information
        output_dir = (
            folder_paths.get_output_directory()
            if save_to_output_dir
            else folder_paths.get_temp_directory()
        )
        (
            full_output_folder,
            filename,
            _,
            subfolder,
            _,
        ) = folder_paths.get_save_image_path(filename_format, output_dir)
                
        file_path, format_type, format_ext_mime, format_ext = self.determine_file_name(
            filename, full_output_folder, output_format
        )

        self.LAST_FILE_PATH = file_path

        metadata = PngInfo()
        video_metadata = {}
        if extra_pnginfo is not None:
            for key in extra_pnginfo:
                if not save_workflow and key == "workflow":
                    continue
                
                value = extra_pnginfo[key]    
                metadata.add_text(key, json.dumps(value))
                video_metadata[key] = value

        if additional_metadata_json is not None:
            try:
                as_json_object = json.loads(additional_metadata_json)
                for key in as_json_object:                    
                    value = as_json_object[key]    
                    metadata.add_text(key, json.dumps(value))
                    video_metadata[key] = value
            except:
                pass
        
        if save_prompt_server_prompt and prompt:
            if isinstance(prompt, str):
                try:
                    prompt = json.loads(prompt)
                except Exception:
                    pass  # leave as plain string if not JSON

            metadata.add_text("prompt", json.dumps(prompt))
            video_metadata["prompt"] = prompt
            
        if format_type == "image":
            
            frames = [tensor2pil(f)[0] for f in images]
            
            args = {
                "format":format_ext.upper(),
                "save_all":True,
                "append_images":frames[1:],
                "duration":round(1000 / frame_rate),
                "loop":loop_count,
                }   
            
            # Add metadata to images
            if format_ext == "gif":
                if save_metadata:
                    args["comment"] = json.dumps(video_metadata, indent=2, sort_keys=True)                
                    
            elif format_ext == "apng":
                compress_level = quality // 11
                args["compress_level"] = compress_level
                if save_metadata:
                    args["pnginfo"] = metadata
                    
            elif format_ext == "webp":
                args["quality"] = quality
                args["minimize_size"] = False
                if save_metadata:
                    exif_bytes = piexif.dump({
                            "Exif":{
                                piexif.ExifIFD.UserComment:piexif.helper.UserComment.dump(json.dumps(video_metadata, indent=2, sort_keys=True), encoding="unicode")}})
                    args["exif"] = exif_bytes 
                    
            frames[0].save(file_path, **args)
        else:
            # Use ffmpeg to save a video
            if FFMPEG_PATH is None:
                #Should never be reachable
                raise ProcessLookupError("Could not find ffmpeg")

            video_format_path = os.path.join(VIDEO_FORMATS_DIRECTORY, format_ext_mime + ".json")
            with open(video_format_path, 'r') as stream:
                video_format = json.load(stream)
                if "extension" in video_format:
                    format_ext = video_format["extension"]
            dimensions = f"{len(images[0][0])}x{len(images[0])}"
            output_quality = map_to_range(quality, 0, 100, 50, 1) # ffmpeg quality maps from 50 (worst) to 1 (best)

            env=os.environ.copy()
            if  "environment" in video_format:
                env.update(video_format["environment"])

            # Resolve audio
            audio_path_to_use = None
            audio_trim_start = 0
            audio_trim_duration = 0
            join_instance = JoinVideosInDirectory()
            if audio_options:
                audio_input_path = audio_options.get("audio_input_path")
                if audio_input_path and os.path.isfile(audio_input_path) and join_instance.has_audio_track(audio_input_path):
                    clip_audio = audio_options.get("clip_audio", False)
                    audio_clip_start_seconds = audio_options.get("audio_clip_start_seconds", 0)
                    audio_clip_duration = audio_options.get("audio_clip_duration", 0)
                    use_whole_audio = audio_clip_start_seconds == 0 and audio_clip_duration == 0
                    if clip_audio and not use_whole_audio:
                        audio_duration = join_instance.get_audio_duration(audio_input_path)
                        if audio_clip_duration == 0 or audio_clip_start_seconds + audio_clip_duration > audio_duration:
                            audio_clip_duration = audio_duration - audio_clip_start_seconds
                        audio_trim_start = audio_clip_start_seconds
                        audio_trim_duration = audio_clip_duration
                    audio_path_to_use = audio_input_path

            audio_codec = 'aac'
            if audio_path_to_use and file_path.endswith(".webm"):
                audio_codec = 'libopus'

            # Write metadata once
            metadata_json = json.dumps(
                video_metadata if save_metadata else "",
                separators=(",", ":")
            )

            def escape_ffmetadata_value(value: str) -> str:
                return (
                    value
                    .replace("\\", "\\\\")
                    .replace("\n", r"\n")
                    .replace(";", r"\;")
                    .replace("#", r"\#")
                    .replace("=", r"\=")
                    .replace("NaN", "0")
                )

            escaped = escape_ffmetadata_value(metadata_json)

            os.makedirs(folder_paths.get_temp_directory(), exist_ok=True)
            metadata_path = os.path.join(
                folder_paths.get_temp_directory(),
                "metadata.txt"
            )

            with open(metadata_path, "w", encoding="utf-8") as f:
                f.write(";FFMETADATA1\n")
                f.write("comment=" + escaped)

            # Build ffmpeg command
            cmd = [
                FFMPEG_PATH,
                "-v", "error",
                "-i", metadata_path,
                "-f", "rawvideo",
                "-pix_fmt", "rgb24",
                "-loglevel", "quiet",
                "-s", dimensions,
                "-r", str(frame_rate),
                "-i", "-",
            ]

            if audio_path_to_use:
                if audio_trim_start > 0:
                    cmd.extend(["-ss", str(audio_trim_start)])
                if audio_trim_duration > 0:
                    cmd.extend(["-t", str(audio_trim_duration)])
                cmd.extend(["-i", audio_path_to_use])

            cmd.extend(["-crf", str(output_quality)])
            cmd.extend(video_format['main_pass'])

            if audio_path_to_use:
                cmd.extend(["-map", "1:v", "-map", "2:a", "-c:a", audio_codec, "-strict", "experimental"])

            cmd.extend(["-n", file_path])

            # Stream all frames in a single ffmpeg process
            total_frames = len(images)
            logger.info(f"SaveVideo: Encoding {total_frames} frames...")

            try:
                process = subprocess.Popen(
                    cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE, env=env
                )

                for start in range(0, total_frames, batch_size):
                    end = min(start + batch_size, total_frames)
                    image_batch = images[start:end]
                    image_batch = (image_batch.cpu().numpy() * 255.0).astype(np.uint8)
                    process.stdin.write(image_batch.tobytes())

                process.stdin.close()
                _, stderr = process.communicate()

                if process.returncode != 0:
                    print(stderr.decode("utf-8"), end="", file=sys.stderr)
                    logger.warn("An error occurred when saving video")
            except Exception as e:
                logger.warn(f"An error occurred when saving video: {e}")

        previews = [
            {
                "filename": f"{get_clean_filename(file_path)}.{format_ext}",
                "subfolder": subfolder,
                "type": "output" if save_to_output_dir else "temp",
                "format": output_format,
            }
        ]
        return {"ui": {"images": previews}}

class AudioInputOptions:

    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {
                        "audio_input_path": ("STRING", {"default": "/path/"}),
                        "clip_audio": ("BOOLEAN", {"default": False}),
                        "audio_clip_start_seconds": ("FLOAT", {"default": 0, "min": 0, "max": 3.402823466e+38}),
                        "audio_clip_duration": ("FLOAT", {"default": 0, "min": 0, "max": 3.402823466e+38}),
                     },
                "optional":
                    {
                        "audio": ("AUDIO",),
                    },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }
        
    RETURN_TYPES = ("AUDIO_INPUT_OPTIONS",)
    FUNCTION = "execute"

    def execute(self, audio_input_path="/path/", clip_audio=False,
                audio_clip_start_seconds=0, audio_clip_duration=0,
                audio=None, **kwargs):
        import wave

        audio_input_path = resolve_file_path(audio_input_path)

        if audio is not None:
            waveform = audio.get("waveform")
            sample_rate = audio.get("sample_rate")
            if waveform is not None and sample_rate is not None:
                try:
                    waveform = waveform.float().cpu()

                    if waveform.dim() == 1:
                        waveform = waveform.unsqueeze(0)
                    elif waveform.dim() == 3:
                        waveform = waveform.squeeze(0)

                    channels = waveform.shape[0]
                    num_samples = waveform.shape[1]

                    temp_dir = folder_paths.get_temp_directory()
                    os.makedirs(temp_dir, exist_ok=True)
                    slug = ''.join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(8))
                    temp_wav_path = os.path.join(temp_dir, f"jnodes_audio_input_{slug}.wav")

                    waveform_np = waveform.numpy()

                    if waveform_np.min() < -1.0 or waveform_np.max() > 1.0:
                        waveform_np = np.clip(waveform_np, -1.0, 1.0)

                    int_data = np.clip(waveform_np * 32767, -32768, 32767).astype(np.int16)
                    int_data = np.ascontiguousarray(int_data.T)

                    with wave.open(temp_wav_path, 'wb') as wf:
                        wf.setnchannels(channels)
                        wf.setsampwidth(2)
                        wf.setframerate(int(sample_rate))
                        wf.writeframes(int_data.tobytes())

                    audio_input_path = temp_wav_path
                    logger.info(f"AudioInputOptions: Saved AUDIO waveform to {temp_wav_path} ({channels}ch, {sample_rate}Hz, {num_samples} samples)")
                except Exception as e:
                    logger.warning(f"AudioInputOptions: Failed to save AUDIO waveform to file: {e}. Falling back to audio_input_path.")

        return ({
            "audio_input_path": audio_input_path,
            "clip_audio": clip_audio,
            "audio_clip_start_seconds": audio_clip_start_seconds,
            "audio_clip_duration": audio_clip_duration,
        },)

class JoinVideosInDirectory:

    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {
                        "directory_containing_videos": ("STRING", {"default": "/path/"}),
                        "output_file_path": ("STRING", {"default": "/path/"}),
                        "audio_input_options": ("AUDIO_INPUT_OPTIONS",),
                        "delete_directory_containing_videos": ("BOOLEAN", {"default": False}),
                     },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }
        
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "join_videos_in_directory"

    def join_videos_in_directory(
        self, directory_containing_videos, output_file_path, audio_input_options, delete_directory_containing_videos=False
    ):

        directory_containing_videos = resolve_file_path(directory_containing_videos)
        output_file_path = resolve_file_path(output_file_path)

        full_output_directory = os.path.dirname(output_file_path)
        os.makedirs(full_output_directory, exist_ok=True)         

        # Get a list of video files in the folder
        video_files = [f for f in os.listdir(directory_containing_videos) if is_video(os.path.join(directory_containing_videos, f))]

        if not video_files:
            print("No video files found in the folder.")
            return

        should_apply_audio = False
        if audio_input_options:
            audio_input_path = audio_input_options.get("audio_input_path")
            should_apply_audio = os.path.isfile(audio_input_path) and self.has_audio_track(audio_input_path)

        if not should_apply_audio and len(video_files) == 1:
            source_file = os.path.join(directory_containing_videos, video_files[0])

            if source_file != output_file_path:
                try:
                    shutil.copy(source_file, output_file_path)
                    print(f"Single video file copied from {source_file} to {output_file_path}")
                except IOError as e:
                    print(f"An error occurred while copying the file: {e}")
        else:

            def alphanumeric_sort_key(filename):
                """Sort filenames alphanumerically."""
                return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', filename)]

            # Sort video files to maintain order
            video_files.sort(key=alphanumeric_sort_key)

            # Create a file to list video files
            list_file_path = os.path.join(directory_containing_videos, 'video_list.txt')

            with open(list_file_path, 'w') as list_file:
                for video_file in video_files:
                    list_file.write(f"file '{os.path.join(directory_containing_videos, video_file)}'\n")       
            
            # Preemptively create trimmed audio path even if we don't need it 
            trimmed_audio_path = os.path.join(directory_containing_videos, 'trimmed_audio.aac')

            # Build the ffmpeg command to concatenate videos and apply audio
            if should_apply_audio:
                audio_codec = 'aac'
                if output_file_path.endswith("webm"):
                    audio_codec = 'libopus'
                audio_input_path = audio_input_options.get("audio_input_path")                
                clip_audio = audio_input_options.get("clip_audio", False)
                audio_clip_start_seconds = audio_input_options.get("audio_clip_start_seconds", 0)
                audio_clip_duration = audio_input_options.get("audio_clip_duration", 0)

                use_whole_audio = audio_clip_start_seconds == 0 and audio_clip_duration == 0

                if clip_audio and not use_whole_audio:
                    # Trim the audio first
                    audio_duration = self.get_audio_duration(audio_input_path)
                    if audio_clip_duration == 0 or audio_clip_start_seconds + audio_clip_duration > audio_duration:
                        audio_clip_duration = audio_duration - audio_clip_start_seconds
                    audio_trim_command = [
                        'ffmpeg',
                        '-i', audio_input_path,
                        '-ss', str(audio_clip_start_seconds),
                        '-t', str(audio_clip_duration),
                        '-ac', '2', # Force stereo for now
                        '-c:a', 'aac',
                        '-loglevel', 'quiet',
                        trimmed_audio_path
                    ]
                    try:
                        subprocess.run(audio_trim_command, check=True)
                        print(f"Trimmed audio saved to {trimmed_audio_path}")
                    except subprocess.CalledProcessError as e:
                        print(f"An error occurred during audio trimming: {e}")
                        return
                    audio_path_to_use = trimmed_audio_path
                else:
                    audio_path_to_use = audio_input_path

                ffmpeg_command_final = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', list_file_path,
                    '-i', audio_path_to_use,
                    '-map', '0:v', 
                    '-map', '1:a',
                    '-c:v', 'copy',
                    '-c:a', audio_codec,
                    '-strict', 'experimental',
                    '-loglevel', 'quiet',
                    # '-loglevel', 'debug',  # Add this for detailed logs
                    output_file_path
                ]

            else:
                # No audio file provided
                ffmpeg_command_final = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', list_file_path,
                    '-c:v', 'copy',
                    '-strict', 'experimental',
                    output_file_path
                ]

            try:
                # Run ffmpeg to concatenate videos and optionally apply audio
                process_final = subprocess.Popen(
                    ffmpeg_command_final, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True
                )

                # Read the output and error streams
                stdout, stderr = process_final.communicate()

                # Wait for the process to finish
                process_final.wait()
                if process_final.returncode == 0:
                    print(f"\nProcessing complete. Output file: {output_file_path}")
                else:
                    print(f"\nAn error occurred during processing: ffmpeg process returned non-zero exit code {process_final.returncode}")
                    print(stdout)
                    print(stderr)
                    return

            except subprocess.CalledProcessError as e:
                print(f"\nAn error occurred: {e}")

            finally:
                # Clean up
                if os.path.exists(list_file_path):
                    os.remove(list_file_path)
                if os.path.exists(trimmed_audio_path):
                    os.remove(trimmed_audio_path)

        # Clean up video directory if desired
        if delete_directory_containing_videos:
            shutil.rmtree(directory_containing_videos)

        output_directory = folder_paths.get_output_directory()
        temp_directory = folder_paths.get_temp_directory()

        save_to_output_dir = output_file_path.startswith(output_directory)
        save_to_temp_dir = output_file_path.startswith(temp_directory)

        # While saving anywhere is supported, we can only display temp/output types
        if save_to_output_dir or save_to_temp_dir:
            filename = get_clean_filename(output_file_path)     
            format_ext = get_file_extension_without_dot(output_file_path)       
            subfolder = full_output_directory.replace(
                output_directory if save_to_output_dir else temp_directory,""
            )
            if subfolder.startswith("/"):
                subfolder = subfolder[1:]
            output_format = f"video/{format_ext}"
            
            previews = [
                {
                    "filename": f"{filename}.{format_ext}",
                    "subfolder": subfolder,
                    "type": "output" if save_to_output_dir else "temp",
                    "format": output_format,
                }
            ]
            return {"ui": {"images": previews}}

        return {}

    def get_audio_duration(self, file_path):
        """Get the duration of an audio file in seconds."""
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        info = json.loads(result.stdout)
        return float(info['format']['duration'])

    def has_audio_track(self, file_path):
        try:
            # Run ffprobe command to get stream information in JSON format
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'stream=codec_type',
                    '-of', 'json',
                    file_path
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True
            )

            # Parse the JSON output
            output = json.loads(result.stdout)
            streams = output.get('streams', [])

            # Check if any of the streams are of type 'audio'
            for stream in streams:
                if stream.get('codec_type') == 'audio':
                    return True
            
            return False

        except subprocess.CalledProcessError as e:
            print(f"An error occurred while running ffprobe: {e}")
            return False

class SaveVideoQuick(ComfySaveVideo):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="JNodes_SaveVideoQuick",
            search_aliases=["export video"],
            display_name="Save Video Quick",
            category="video",
            essentials_category="Basics",
            description="Combines Create Video and Save Video into a single node. Saves the input images to your ComfyUI output or temp directory.",
            inputs=[
                io.Image.Input("images", tooltip="The images to create a video from."),
                io.Float.Input("fps", default=24.0, min=1.0, max=999.0, step=1.0),
                io.Audio.Input("audio", optional=True, tooltip="The audio to add to the video."),
                io.Int.Input(
                    "bit_depth",
                    min=8,
                    max=10,
                    default=8,
                    step=2,
                    tooltip="Bit depth of the created video. 10-bit keeps smoother gradients with less"
                    " banding, but some players and downstream nodes may not support it.",
                    optional=True,
                    display_mode=io.NumberDisplay.number,
                ),
                io.String.Input("filename_prefix", default="video/ComfyUI", tooltip="The prefix for the file to save. This may include formatting information such as %date:yyyy-MM-dd% or %Empty Latent Image.width% to include values from nodes."),
                io.Combo.Input("format", options=Types.VideoContainer.as_input(), default="auto", tooltip="The format to save the video as."),
                io.Combo.Input("codec", options=Types.VideoCodec.as_input(), default="auto", tooltip="The codec to use for the video."),
                io.Boolean.Input("save_to_output_dir", default=True, tooltip="If true save to /output. Otherwise, /temp."),
                io.Boolean.Input("save_metadata", default=True, tooltip="Whether to save the video with or without metadata."),
                io.Boolean.Input("save_workflow", default=True, tooltip="If this and save_metadata are true, the workflow will be saved to the metadata."),
                io.Boolean.Input("save_prompt_server_prompt", default=True, tooltip="If true, save the server prompt to the metadata."),
                io.String.Input("additional_metadata_json", default="", optional=True, tooltip="A JSON string of additional metadata to save to the video's metadata, if save_metadata is true."),
            ],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
            is_output_node=True,
            outputs=[io.Video.Output("video")],
        )

    @classmethod
    def execute(cls,
        images: Input.Image, fps: float, audio: Optional[Input.Audio] = None, bit_depth: int = 8,
        filename_prefix: str = "video/ComfyUI", format: str = "auto", codec: str = "auto",
        save_to_output_dir: bool = True, save_metadata: bool = True,
        save_workflow: bool = True, save_prompt_server_prompt: bool = True,
        additional_metadata_json: str = None) -> io.NodeOutput:

        video = InputImpl.VideoFromComponents(
            Types.VideoComponents(images=images, audio=audio, frame_rate=Fraction(fps)),
            bit_depth=bit_depth,
        )

        width, height = video.get_dimensions()
        output_dir = (
            folder_paths.get_output_directory()
            if save_to_output_dir
            else folder_paths.get_temp_directory()
        )
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
            filename_prefix,
            output_dir,
            width,
            height
        )

        saved_metadata = None
        if save_metadata and not args.disable_metadata:
            metadata = {}
            if cls.hidden.extra_pnginfo is not None:
                if save_workflow:
                    metadata.update(cls.hidden.extra_pnginfo)
                else:
                    for k, v in cls.hidden.extra_pnginfo.items():
                        if k != "workflow":
                            metadata[k] = v
            if save_prompt_server_prompt and cls.hidden.prompt is not None:
                metadata["prompt"] = cls.hidden.prompt
            if additional_metadata_json:
                try:
                    metadata.update(json.loads(additional_metadata_json))
                except (json.JSONDecodeError, TypeError):
                    pass
            if len(metadata) > 0:
                saved_metadata = metadata

        file = f"{filename}_{counter:05}_.{Types.VideoContainer.get_extension(format)}"
        video.save_to(
            os.path.join(full_output_folder, file),
            format=Types.VideoContainer(format),
            codec=codec,
            metadata=saved_metadata
        )

        folder_type = io.FolderType.output if save_to_output_dir else io.FolderType.temp
        return io.NodeOutput(video, ui=ui.PreviewVideo([ui.SavedResult(file, subfolder, folder_type)]))


class SaveImageWithOutput(SaveImage):
    
    # A store for subclasses to read (for example, to upload the resulting file)
    # Does nothing on its own, this was just an extension point I needed for a project
    LAST_FILE_PATH = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", ),
                "save_to_output": ("BOOLEAN", {"default": False}),
                "filename_prefix": ("STRING", {"default": "ComfyUI"}),
                "save_prompt_to_meta": ("BOOLEAN", {"default": False}),
                "metadata_mode": (["add", "replace", "discard"], {"default": False, "tooltip": "add: add additional_metadata_json to the existing extra_pnginfo; replace: replace the existing extra_pnginfo with additional_metadata_json; discard: do not add extra_pnginfo or additional_metadata_json to metadata"}),
                "image_type": (["png", "webp", "jpg", "bmp"], {"default": "png"}),
            },
            "optional": {
                "additional_metadata_json": ("STRING", {"tooltip": "Optionally add a secondary set of metadata key-value pairs from a stringified json. Will overwrite keys in extra_pnginfo if a key has the same name."}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }
        
    RETURN_TYPES = SaveImage.RETURN_TYPES
    FUNCTION = "save_images_with_output"

    def save_images(self, images, filename_prefix="ComfyUI", prompt=None, extra_pnginfo=None, image_type="png"):
        filename_prefix += self.prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0])
        results = list()
        for (batch_number, image) in enumerate(images):
            i = 255. * image.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            metadata_dict = {}
            if prompt is not None:
                metadata_dict["prompt"] = json.dumps(prompt)
            if extra_pnginfo is not None:
                for x in extra_pnginfo:
                    metadata_dict[x] = json.dumps(extra_pnginfo[x])

            filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
            file = f"{filename_with_batch_num}_{counter:05}_.{image_type}"

            path = os.path.join(full_output_folder, file)
            self.LAST_FILE_PATH = path

            if image_type == "png":
                pnginfo = PngInfo()
                for k, v in metadata_dict.items():
                    pnginfo.add_text(k, str(v))
                img.save(path, pnginfo=pnginfo, compress_level=self.compress_level)

            elif image_type == "jpg":
                exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
                
                # store your metadata as JSON string inside UserComment
                exif_dict["Exif"][piexif.ExifIFD.UserComment] = json.dumps(metadata_dict).encode()
                exif_bytes = piexif.dump(exif_dict)

                img.save(path, exif=exif_bytes, quality=95)

            elif image_type == "webp":
                exif_bytes = piexif.dump({
                        "Exif":{
                            piexif.ExifIFD.UserComment:piexif.helper.UserComment.dump(
                                json.dumps(metadata_dict, indent=2, sort_keys=True), encoding="unicode"
                            )
                        }
                    })
                
                img.save(path, format="WEBP", lossless=True, exif=exif_bytes)
            else:
                # no metadata support → just save
                img.save(path)

            results.append({
                "filename": file,
                "subfolder": subfolder,
                "type": self.type
            })
            counter += 1

        return { "ui": { "images": results } }
    
    def save_images_with_output(
        self, images, save_to_output, 
        filename_prefix="ComfyUI", 
        save_prompt_to_meta=False, metadata_mode="add", 
        additional_metadata_json=None,
        prompt=None, extra_pnginfo=None,
        image_type="png"):

        if not save_to_output:
            self.output_dir = folder_paths.get_temp_directory()
            self.type = "temp"
            self.prefix_append = "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstupvxyz") for x in range(5))
        else:
            self.__init__(); # Restore defaults

        out_prompt = prompt
        out_extra_pnginfo = extra_pnginfo
        if not save_prompt_to_meta:
            out_prompt = None 

        def add_additional_png_info():
            if additional_metadata_json is not None:
                try:
                    as_json_object = json.loads(additional_metadata_json)
                    for key in as_json_object:                    
                        value = as_json_object[key]    
                        out_extra_pnginfo[key] = value
                except:
                    pass

        if metadata_mode == "discard":
            out_extra_pnginfo = None
        elif metadata_mode == "replace":
            out_extra_pnginfo = {}
            add_additional_png_info()
        else:
            add_additional_png_info()      


        result = self.save_images(images, filename_prefix, out_prompt, out_extra_pnginfo, image_type)
        return result 
        

NODE_CLASS_MAPPINGS = {
    
    "JNodes_SaveVideo": SaveVideo,
    "JNodes_SaveVideoWithOptions": SaveVideoWithOptions,
    "JNodes_SaveVideoQuick": SaveVideoQuick,
    "JNodes_AudioInputOptions": AudioInputOptions,
    "JNodes_JoinVideosInDirectory": JoinVideosInDirectory,
    "JNodes_SaveImageWithOutput": SaveImageWithOutput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    "JNodes_SaveVideo": "Save Video (DEPRECATED, USE 'JNodes_SaveVideoWithOptions')",
    "JNodes_SaveVideoWithOptions": "Save Video (With Options)",
    "JNodes_SaveVideoQuick": "Save Video Quick",
    "JNodes_AudioInputOptions": "Audio Input Options (For Video Output)",
    "JNodes_JoinVideosInDirectory": "Join Videos In Directory",
    "JNodes_SaveImageWithOutput": "Save Image With Output",
}