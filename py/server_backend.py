import os 
import re 

from .logger import logger
from .utils import *

import folder_paths
from pathlib import Path
from aiohttp import web
import server

import json

def get_comfyui_subfolder(directory_name = "output"):
    # Get the directory containing this file
    directory = os.path.dirname(os.path.realpath(__file__))
    
    # Find the position of base ComfyUI path
    index = directory.find("custom_nodes")
    
    # Chop off everything after "ComfyUI"
    comfy_path = os.path.join(directory[:index])
    
    return os.path.join(comfy_path, directory_name)

async def read_we_request_content(reader):
    data = await reader.read()
    return data.decode('utf-8')

def get_model_items(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
    file_list = folder_paths.get_filename_list(type)
    
    image_extension_filter = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
    info_extension_filter = {'.info', '.txt', '.json'}
    
    familiar_dictionaries = create_familiar_dictionaries(file_list, type, image_extension_filter, info_extension_filter)
    #logger.info(familiar_dictionaries)
    return web.json_response(familiar_dictionaries)

def create_familiar_dictionaries(names, type, image_extension_filter, info_extension_filter):
    """
    Makes a dictionary (key: item_name) containing a nested dictionary: a list of familiar images and a list of familiar info files.
    Intended for loras but can be used for other items with a similar setup.
    Works faster when all familiar items are together in one folder for the item itself rather than when all items,
    familiar and non-familiar, are in one big folder. For example "loras/MyLora/ contains all "MyLora" familiar files,
    and they aren't all just in the base "lora" folder.
    """
    familiar_dictionaries = {}
    for item_name in names:

        #logger.info(f"item_name: {item_name}")
        file_name_no_ext = os.path.splitext(item_name)[0]
        #logger.info(f"file_name_no_ext: {file_name_no_ext}")
        file_path = folder_paths.get_full_path(type, item_name)
        #logger.info(f"file_path: {file_path}")
        
        # Get time of creation since the last epoch, in seconds
        file_age = os.path.getctime(file_path)

        if file_path is None:
            logger.warning(f"Unable to get path for {type} {item_name}")
            continue

        file_path = file_path.replace("/", "\\")
        
        parent_directory = os.path.dirname(file_path)
        #logger.info(f"parent_directory: {parent_directory}") 
        
        containing_directory = None
        if "\\" in file_name_no_ext:
            split = file_name_no_ext.split("\\")
            if len(split) > 1:
                containing_directory, file_name_no_ext = split

        familiar_images = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, image_extension_filter)
        familiar_infos = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, info_extension_filter, True)
        #logger.info(f"similar_images: {similar_images}")
        
        familiar_dictionaries[file_name_no_ext] = {
            "containing_directory": containing_directory, 
            "full_name": item_name, 
            "file_age": file_age, 
            "familiar_images": familiar_images, 
            "familiar_infos": familiar_infos
        }
        
    return familiar_dictionaries
    
def find_items_with_similar_names(folder_path, containing_directory, base_name, extension_filter, load = False):
    familiars = []
    
    for file_name in os.listdir(folder_path):
        #logger.info(f"file_name in directory: {file_name}")
        file_name_no_ext, ext = os.path.splitext(file_name)
        if ext in extension_filter and base_name in file_name_no_ext:
            #logger.info(f"file_name matches criteria: {file_name}")
            if load:
                try: 
                    with open(folder_path + "\\" + file_name, 'r', encoding='utf-8') as opened_file:
                        loaded_text = opened_file.read()
                        familiars.append(loaded_text)
                        continue
                except Exception as e:
                    print(f"Error loading text, will append familiar file name. Error: {e}")
            familiars.append(containing_directory + "\\" + file_name if containing_directory is not None else file_name)

    return familiars

def list_files_and_folders(directory):
    
    results = [];
    
    def recurse(folder):
        # Get the list of files and folders in the specified directory
        full_directory = os.path.join(directory, folder)
        items = os.listdir(full_directory)
    
        # Separate files and folders
        files = []
        for item in items:
            file_path = os.path.join(full_directory, item)
            if os.path.isfile(file_path) and is_acceptable_image_or_video(item):
                 # Get time of creation since the last epoch, in seconds
                 file_age = os.path.getctime(file_path)
                 
                 files.append({'item': item, 'file_age': file_age})
                 
            elif os.path.isdir(os.path.join(full_directory, item)):
                recurse(os.path.join(folder, item))
    
        # Create a list of dictionaries starting with the files in the root directory
        results.append({'folder_path': f'{folder}', 'files': files})
        
    recurse("")
    
    results.sort(key = lambda result: result['folder_path'])

    return results

def get_comfyui_subfolder_items(request):
    return web.json_response(list_files_and_folders(get_comfyui_subfolder(request.rel_url.query["subfolder"])))

def view_image(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
        
    output_dir = None
    
    try:
        file_list = folder_paths.get_filename_list(type)
        if file_list:
             for item_name in file_list:
                if "\\" not in item_name.replace("/", "\\"):
                    file_path = folder_paths.get_full_path(type, item_name)
                    output_dir = os.path.dirname(file_path)
                    if output_dir is not None:
                        break
    except:
        try:
            output_dir = get_comfyui_subfolder(type)
        except Exception as e:
            print(f"Error finding folder {type}. Error: {e}")
            
    if output_dir is None:
        logger.warning(f"Unable to get parent directory for {type}")
        return web.Response(status=400)
    
    subfolder = ''
    if "subfolder" in request.rel_url.query:
        subfolder = request.rel_url.query["subfolder"]
        output_dir = os.path.join(output_dir, subfolder)
    
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        # validation for security: prevent accessing arbitrary path
        if filename[0] == '/' or '..' in filename:
            return web.Response(status=400)

        #filename = os.path.basename(filename)
        file = os.path.join(output_dir, filename)

        if os.path.isfile(file):
            if 'preview' in request.rel_url.query:
                with Image.open(file) as img:
                    preview_info = request.rel_url.query['preview'].split(';')
                    image_format = preview_info[0]
                    if image_format not in ['webp', 'jpeg'] or 'a' in request.rel_url.query.get('channel', ''):
                        image_format = 'webp'

                    quality = 90
                    if preview_info[-1].isdigit():
                        quality = int(preview_info[-1])

                    buffer = BytesIO()
                    if image_format in ['jpeg'] or request.rel_url.query.get('channel', '') == 'rgb':
                        img = img.convert("RGB")
                    img.save(buffer, format=image_format, quality=quality)
                    buffer.seek(0)

                    return web.Response(body=buffer.read(), content_type=f'image/{image_format}',
                                        headers={"Content-Disposition": f"filename=\"{filename}\""})

            if 'channel' not in request.rel_url.query:
                channel = 'rgba'
            else:
                channel = request.rel_url.query["channel"]

            if channel == 'rgb':
                with Image.open(file) as img:
                    if img.mode == "RGBA":
                        r, g, b, a = img.split()
                        new_img = Image.merge('RGB', (r, g, b))
                    else:
                        new_img = img.convert("RGB")

                    buffer = BytesIO()
                    new_img.save(buffer, format='PNG')
                    buffer.seek(0)

                    return web.Response(body=buffer.read(), content_type='image/png',
                                        headers={"Content-Disposition": f"filename=\"{filename}\""})

            elif channel == 'a':
                with Image.open(file) as img:
                    if img.mode == "RGBA":
                        _, _, _, a = img.split()
                    else:
                        a = Image.new('L', img.size, 255)

                    # alpha img
                    alpha_img = Image.new('RGBA', img.size)
                    alpha_img.putalpha(a)
                    alpha_buffer = BytesIO()
                    alpha_img.save(alpha_buffer, format='PNG')
                    alpha_buffer.seek(0)

                    return web.Response(body=alpha_buffer.read(), content_type='image/png',
                                        headers={"Content-Disposition": f"filename=\"{filename}\""})
            else:
                return web.FileResponse(file, headers={"Content-Disposition": f"filename=\"{filename}\""})

    return web.Response(status=404)



async def save_model_config(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
    if "item_name" in request.rel_url.query:
        item_name = request.rel_url.query["item_name"]
    if "subfolder" in request.rel_url.query:
        subfolder = request.rel_url.query["subfolder"]
    if "key" in request.rel_url.query:
        key = request.rel_url.query["key"]
    if "value" in request.rel_url.query:
        value = request.rel_url.query["value"]

    if item_name is None :
        logger.warning(f"Missing item_name, unable to update model config.")
        return web.Response(status=400)
    if key is None :
        logger.warning(f"Missing key, unable to update model config for '{item_name}'.")
        return web.Response(status=400)
    if value is None :
        logger.warning(f"Missing value, unable to update model config for '{item_name}' at key '{key}'.")
        return web.Response(status=400)
    
    
    file_path = folder_paths.get_full_path(type, subfolder + '/' + item_name if subfolder is not None else item_name)
    #logger.info(familiar_dictionaries)
    return web.json_response(familiar_dictionaries)

def load_info(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
    file_list = folder_paths.get_filename_list(type)
    
    output_dir = None
    for item_name in file_list:
        if "\\" not in item_name.replace("/", "\\"):
            file_path = folder_paths.get_full_path(type, item_name)
            output_dir = os.path.dirname(file_path)
            
    if output_dir is None:
        logger.warning(f"Unable to get parent directory for {type}")
        return web.Response(status=400)
    
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        # validation for security: prevent accessing arbitrary path
        if filename[0] == '/' or '..' in filename:
            return web.Response(status=400)

        if output_dir is None:
            return web.Response(status=400)

        #filename = os.path.basename(filename)
        file = os.path.join(output_dir, filename)

        if os.path.isfile(file):
            try:
                with open(file, 'r', encoding='utf-8') as opened_file:
                    loaded_text = opened_file.read()
                return web.json_response({"success": True, "text" : loaded_text})
            except Exception as e:
                print(f"Error loading text: {e}")
                return web.json_response({"success": False, "text" : ''})

    return web.Response(status=404)

async def save_text(request):
    try:
        request_data = await read_we_request_content(request.content)
        request_json = json.loads(request_data)
        if "full_path" in request_json:
            full_path = request_json["full_path"]
        if "text" in request_json:
            text_to_save = request_json["text"]
            
        if full_path and text_to_save:
            with open(full_path, 'w', encoding='utf-8') as file:
                file.write(text_to_save)
    
            return web.json_response({"success": True})
    except Exception as e:
        print(f"Error saving text: {e}")
        return web.json_response({"success": False})

async def load_text(request):
    try:
        request_data = await read_we_request_content(request.content)
        request_json = json.loads(request_data)
        if "full_path" in request_json:
            full_path = request_json["full_path"]
            with open(full_path, 'r', encoding='utf-8') as file:
                loaded_text = file.read()
    
            return web.json_response({"success": True, "text" : loaded_text})
    except Exception as e:
        print(f"Error loading text: {e}")
        return web.json_response({"success": False, "text" : ''})
