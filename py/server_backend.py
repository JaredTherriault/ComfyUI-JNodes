import os 
import re 

from .logger import *
from .utils import *
from .server_backend_get_subdirectory_images import GetSubdirectoryImages

import folder_paths
from aiohttp import web
import server

from PIL import Image

import json

CANCELLATION_REQUESTED = False

def should_cancel_task():
    return CANCELLATION_REQUESTED

def request_task_cancellation():
    CANCELLATION_REQUESTED = True

async def read_we_request_content(reader):
    data = await reader.read()
    return data.decode('utf-8')

def get_model_items(request):
    CANCELLATION_REQUESTED = False
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

        if should_cancel_task():
            break
            
        try:
            logger.info(f"item_name: {item_name}")
            file_name_no_ext, file_ext = os.path.splitext(item_name)
            logger.info(f"file_name_no_ext: {file_name_no_ext}")
            file_path = folder_paths.get_full_path(type, item_name)
            logger.info(f"file_path: {file_path}")
            
            # Get time of creation since the last epoch, in seconds
            file_age = os.path.getctime(file_path)

            if file_path is None:
                logger.warning(f"Unable to get path for {type} {item_name}")
                continue

            file_path = file_path.replace("\\", "/")
            logger.info(f'file_path: {file_path}')
            
            parent_directory = os.path.dirname(file_path)
            logger.info(f"parent_directory: {parent_directory}") 
            
            containing_directory = None
            if "/" in file_name_no_ext:
                split = file_name_no_ext.split("/")
                if len(split) > 1:
                    file_name_no_ext = split[len(split) - 1]
                    split.pop()
                    containing_directory = "/".join(split)
            familiar_images = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, image_extension_filter)
            familiar_infos = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, info_extension_filter, True)
            logger.info(f"similar_images: {similar_images}")
            
            familiar_dictionaries[file_name_no_ext] = {
                "containing_directory": containing_directory, 
                "full_name": item_name, 
                "file_age": file_age, 
                "file_ext": file_ext,
                "familiar_images": familiar_images, 
                "familiar_infos": familiar_infos
            }
        except Exception as e:
            logger.error(f"Error loading lora: {e}")
        
    return familiar_dictionaries
    
def find_items_with_similar_names(folder_path, containing_directory, base_name, extension_filter, load = False):
    logger.info(f'folder_path: {folder_path}')
    familiars = []
    
    for file_name in os.listdir(folder_path):

        if should_cancel_task():
            break

        logger.info(f"file_name in directory: {file_name}")
        file_name_no_ext, ext = os.path.splitext(file_name)
        if ext in extension_filter and base_name in file_name_no_ext:
            logger.info(f"file_name matches criteria: {file_name}")
            if load:
                try: 
                    with open(folder_path + "/" + file_name, 'r', encoding='utf-8') as opened_file:
                        loaded_text = opened_file.read()
                        familiars.append(loaded_text)
                        continue
                except Exception as e:
                    log_exception("Error loading text, will append familiar file name. Error:", e)
            familiars.append(containing_directory + "/" + file_name if containing_directory is not None else file_name)

    familiars.sort()
    return familiars

def list_comfyui_subdirectories(root_directory):
    results = []

    def walk_through_subdirectories(in_directory):
        """
        Recursively list subdirectories within the specified directory.

        Args:
            in_directory (str): The directory to process.
        """
        if should_cancel_task():
            return

        full_directory = os.path.join(root_directory, in_directory)
        if not os.path.isdir(full_directory):
            return

        results.append(in_directory)
            
        items = os.listdir(full_directory)
                
        for item in items:
            if os.path.isdir(os.path.join(full_directory, item)):
                walk_through_subdirectories(os.path.join(in_directory, item))

    walk_through_subdirectories("")

    results = sorted(results)

    return results

def list_comfyui_subdirectories_request(request):
    CANCELLATION_REQUESTED = False
    try:        

        root_directory = convert_relative_comfyui_path_to_full_path(request.rel_url.query["root_directory"])

        results = list_comfyui_subdirectories(root_directory)

        return web.json_response({"success": True, "payload": results })
    except Exception as e:
        log_exception("Error listing subdirectories:", e)
        return web.json_response({"success": False, "error": str(e)})

def get_comfyui_subdirectory_images_request(request):
    CANCELLATION_REQUESTED = False
    try:
        root_directory = request.rel_url.query["root_directory"] or ""
        selected_subdirectory = request.rel_url.query["selected_subdirectory"] or ""
        recursive = request.rel_url.query["recursive"] == "true"
        results = GetSubdirectoryImages(
            os.path.join(convert_relative_comfyui_path_to_full_path(root_directory), selected_subdirectory), recursive).get_subdirectory_images()
        return web.json_response({"success": True, "payload": results })
    except Exception as e:
        log_exception("Error listing subdirectory images:", e)
        return web.json_response({"success": False, "error": str(e)})

async def request_open_file_manager(request):
    try:
        result = await validate_and_return_file_from_request(request)

        if result["success"] == True:
            open_file_manager(result["payload"]["file"])
            return web.json_response({"success": True})
    except Exception as e:
        logger.error(e)
        return web.json_response({"success": False, "error": str(e)})

async def validate_and_return_file_from_request(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
        
    base_dir = None
    
    try: # Try to infer base_dir
        file_list = folder_paths.get_filename_list(type)
        if file_list:
            sample_set = []
            for item_name in file_list:
                file_path = folder_paths.get_full_path(type, item_name.replace("\\", "/"))
                sample_set.append(file_path)
                if len(sample_set) == 2:
                    break
            if len(sample_set) == 2:
                base_dir = highest_common_folder(sample_set[0], sample_set[1])
    except: # If we can't, most likely because it's not a built-in type, assume type is a subfolder in the ComfyUI directory
        try:
            base_dir = convert_relative_comfyui_path_to_full_path(type)
        except Exception as e:
            log_exception(f"Error finding folder {type}. Error:", e)
            
    if base_dir is None:
        logger.warning(f"Unable to get parent directory for {type}")
        return { "success": False, "response": 400 }
    
    subfolder = ''
    if "subfolder" in request.rel_url.query:
        subfolder = request.rel_url.query["subfolder"]
        base_dir = os.path.join(base_dir, subfolder)
    
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        # validation for security: prevent accessing arbitrary path
        if filename[0] == '/' or filename.startswith('..') or filename.startswith('./'):
            logger.warning(f"Attempting to access an arbitrary path, aborting. filename: {filename}")
            return { "success": False, "response": 400 }

        #filename = os.path.basename(filename)
        file = os.path.join(base_dir, filename)

        # Hack for linux/mac/unix
        if not os.path.isfile(file):
            file = f"/{file}"
        
        if os.path.isfile(file):
            return { "success": True, "payload": { "base_dir": base_dir, "subfolder": subfolder, "filename": filename, "file": file } }

async def view_image(request):

    result = await validate_and_return_file_from_request(request)

    if result["success"] == True:
        if 'preview' in request.rel_url.query:
            with Image.open(result["payload"]["file"]) as img:
                preview_info = request.rel_url.query['preview'].split(';')
                image_format = preview_info[0]
                if image_format not in ['webp', 'jpeg', 'jpg'] or 'a' in request.rel_url.query.get('channel', ''):
                    image_format = 'webp'

                quality = 90
                if preview_info[-1].isdigit():
                    quality = int(preview_info[-1])

                buffer = BytesIO()
                if image_format in ['jpeg', 'jpg'] or request.rel_url.query.get('channel', '') == 'rgb':
                    img = img.convert("RGB")
                img.save(buffer, format=image_format, quality=quality)
                buffer.seek(0)

                filename = result["payload"]["filename"]
                filename = filename.replace('"', '\\"')  # Escape double quotes

                return web.Response(
                    body=buffer.read(),
                    content_type=f'image/{image_format}',
                    headers={"Content-Disposition": f'filename="{filename}"'}
                )

        if 'channel' not in request.rel_url.query:
            channel = 'rgba'
        else:
            channel = request.rel_url.query["channel"]

        if channel == 'rgb':
            with Image.open(result["payload"]["file"]) as img:
                if img.mode == "RGBA":
                    r, g, b, a = img.split()
                    new_img = Image.merge('RGB', (r, g, b))
                else:
                    new_img = img.convert("RGB")

                buffer = BytesIO()
                new_img.save(buffer, format='PNG')
                buffer.seek(0)

                filename = result["payload"]["filename"]
                filename = filename.replace('"', '\\"')  # Escape double quotes

                return web.Response(
                    body=buffer.read(),
                    content_type=f'image/{image_format}',
                    headers={"Content-Disposition": f'filename="{filename}"'}
                )

        elif channel == 'a':
            with Image.open(result["payload"]["file"]) as img:
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

                filename = result["payload"]["filename"]
                filename = filename.replace('"', '\\"')  # Escape double quotes

                return web.Response(
                    body=alpha_buffer.read(),
                    content_type=f'image/{image_format}',
                    headers={"Content-Disposition": f'filename="{filename}"'}
                )
        else:
            filename = result["payload"]["filename"]
            filename = filename.replace('"', '\\"')  # Escape double quotes
            return web.FileResponse(result["payload"]["file"], headers={"Content-Disposition": f'filename="{filename}"'})

    return web.Response(status= result["response"] if result["response"] else 404)

async def upload_image(request):
    try:
        post = await request.post()
        image = post.get("image")
        overwrite = post.get("overwrite")

        image_upload_type = post.get("type")
        upload_dir = convert_relative_comfyui_path_to_full_path(image_upload_type)

        if image and image.file:
            filename = post.get("filename")
            if not filename or filename == "":
                filename = image.filename
            if not filename:
                return web.Response(status=400)

            subfolder = post.get("subfolder", "")
            full_output_folder = os.path.join(upload_dir, os.path.normpath(subfolder))
            filepath = os.path.abspath(os.path.join(full_output_folder, filename))

            if os.path.commonpath((upload_dir, filepath)) != upload_dir:
                return web.Response(status=400)

            if not os.path.exists(full_output_folder):
                os.makedirs(full_output_folder)

            if overwrite is not None and (overwrite == "true" or overwrite == "1"):
                pass
            else:
                split = os.path.splitext(filename)
                i = 1
                while os.path.exists(filepath):
                    filename = f"{split[0]} ({i}){split[1]}"
                    filepath = os.path.join(full_output_folder, filename)
                    i += 1

            with open(filepath, "wb") as f:
                f.write(image.file.read())

            return web.json_response({"name" : filename, "subfolder": subfolder, "type": image_upload_type})
        else:
            return web.Response(status=400)
    except Exception as e:
        log_exception("Error uploading image:", e)
        return web.json_response({"success": False, "error": str(e)})

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
    
    base_dir = None
    for item_name in file_list:
        if "/" not in item_name.replace("\\", "/"):
            file_path = folder_paths.get_full_path(type, item_name)
            base_dir = os.path.dirname(file_path)
            
    if base_dir is None:
        logger.warning(f"Unable to get parent directory for {type}")
        return web.Response(status=400)
    
    if "filename" in request.rel_url.query:
        filename = request.rel_url.query["filename"]

        # validation for security: prevent accessing arbitrary path
        if filename[0] == '/' or '..' in filename:
            return web.Response(status=400)

        if base_dir is None:
            return web.Response(status=400)

        #filename = os.path.basename(filename)
        file = os.path.join(base_dir, filename)

        if os.path.isfile(file):
            try:
                with open(file, 'r', encoding='utf-8') as opened_file:
                    loaded_text = opened_file.read()
                return web.json_response({"success": True, "payload" : loaded_text})
            except Exception as e:
                log_exception("Error loading text:", e)
                return web.json_response({"success": False, "error": str(e)})

    return web.Response(status=404)

async def save_text(request):
    try:
        request_data = await read_we_request_content(request.content)
        request_json = json.loads(request_data)
        if "path" in request_json:
            path = resolve_file_path(request_json["path"])
        if "text" in request_json:
            text_to_save = request_json["text"]
            
        if path and text_to_save:
            with open(path, 'w', encoding='utf-8') as file:
                file.write(text_to_save)
    
            return web.json_response({"success": True})
    except Exception as e:
        log_exception("Error saving text:", e)
        return web.json_response({"success": False, "error": str(e)})

async def load_text(request):
    try:
        request_data = await read_we_request_content(request.content)
        request_json = json.loads(request_data)
        if "path" in request_json:
            path = resolve_file_path(request_json["path"])
            with open(path, 'r', encoding='utf-8') as file:
                loaded_text = file.read()
    
            return web.json_response({"success": True, "payload" : loaded_text})
    except Exception as e:
        log_exception("Error loading text:", e)
        return web.json_response({"success": False, "error": str(e)})

async def delete_item(request):
    def delete_file(path):
        try:
            if os.path.isfile(path):
                try:
                    # Try to import send2trash module
                    from send2trash import send2trash
                    
                    # If import successful, use send2trash to send file to trash
                    send2trash(path)
                    message = f"File '{path}' sent to trash/recycle bin successfully."
                    print(message)
                    return web.json_response({"success": True, "type": "send2trash", "message": message})
                except ImportError:
                    # If send2trash module not available, delete file permanently
                    os.remove(path)
                    message = f"File '{path}' deleted permanently. If you want to send to trash/recycle, consider installing send2trash (pip install send2trash)."
                    print(message)
                    return web.json_response({"success": True, "type": "permanent", "message": message})
            else:
                message = f"'{path}' is not a valid file."
                print(message)
                return web.json_response({"success": False, "message": message})
        except Exception as e:
            log_exception(f"Error occurred while deleting '{path}':", e)
            return web.json_response({"success": False, "message": message})

    result = await validate_and_return_file_from_request(request)

    if result["success"] == True:
        return delete_file(result["payload"]["file"])

    logger.warning("File could not be deleted: file not found")
    return web.Response(status=404)