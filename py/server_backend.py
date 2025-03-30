import os 
import re 

from .logger import *
from .utils import *
from .server_backend_get_subdirectory_images import GetSubdirectoryImages
from app.user_manager import UserManager

import folder_paths
import aiohttp
from aiohttp import web
import server

from PIL import Image

import json
import shutil

from safetensors import safe_open

CANCELLATION_REQUESTED = False

def should_cancel_task():
    return CANCELLATION_REQUESTED

def request_task_cancellation():
    CANCELLATION_REQUESTED = True

async def read_web_request_content(reader):
    data = await reader.read()
    return data.decode('utf-8')

def get_model_items(request):
    CANCELLATION_REQUESTED = False
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
    file_list = folder_paths.get_filename_list(type)
    
    image_extension_filter = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm'}
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

    def load_pt_metadata(file_path):

        try:
            data = torch.load(file_path, map_location="cpu")  # Load on CPU to avoid GPU dependency
        except Exception as e:
            print(f"load_pt_metadata: Error loading file: {e}")
            return None

        metadata = None

        # Check if the file contains metadata (depends on how it was saved)
        if isinstance(data, dict) and "metadata" in data:
            metadata = data["metadata"]

        return metadata

    def load_safetensors_metadata(file_path):

        metadata = None
        # Open the safetensors file
        with safe_open(file_path, framework="pt") as file:

            try:
                metadata = file.metadata()
            except:
                pass

        return metadata

    familiar_dictionaries = {}
    for item_name in names:

        if should_cancel_task():
            break

        item_name = item_name.replace("\\", "/")
        # logger.info(f"item_name: {item_name}")
            
        try:

            file_path = folder_paths.get_full_path(type, item_name)
            # logger.info(f"file_path: {file_path}")
            if file_path is None:
                logger.warning(f"Unable to get path for {type} {item_name}")
                continue

            metadata = None
            try:
                if item_name.endswith(".safetensors"):
                    metadata = load_safetensors_metadata(file_path)
                else:
                    metadata = load_pt_metadata(file_path)

                if metadata:
                    try: # Sorted dictionaries only available in py 3.7+
                        metadata = {k: metadata[k] for k in sorted(metadata)}
                    except:
                        pass
            except Exception as e:
                logger.error(f"Error loading {item_name} ({type}): {e}")

            file_name_no_ext, file_ext = os.path.splitext(item_name)
            # logger.info(f"file_name_no_ext, file_ext: {file_name_no_ext, file_ext}")
            
            # Get time of creation since the last epoch, in seconds
            file_age = os.path.getctime(file_path)

            file_path = file_path.replace("\\", "/")
            # logger.info(f'file_path: {file_path}')
            file_name_no_ext = file_name_no_ext.replace("\\", "/")
            # logger.info(f'file_name_no_ext: {file_name_no_ext}')
            
            parent_directory = os.path.dirname(file_path)
            # logger.info(f"parent_directory: {parent_directory}") 
            
            containing_directory = None
            if "/" in file_name_no_ext:
                split = file_name_no_ext.split("/")
                if len(split) > 1:
                    file_name_no_ext = split[len(split) - 1]
                    split.pop()
                    containing_directory = "/".join(split)
            familiar_images = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, image_extension_filter)
            familiar_infos = find_items_with_similar_names(parent_directory, containing_directory, file_name_no_ext, info_extension_filter, True)
            # logger.info(f"familiar_images: {familiar_images}")
            
            familiar_dictionaries[file_name_no_ext] = {
                "containing_directory": containing_directory, 
                "full_name": item_name, 
                "file_age": file_age, 
                "file_ext": file_ext,
                "metadata": metadata,
                "familiar_images": familiar_images, 
                "familiar_infos": familiar_infos
            }
        except Exception as e:
            logger.error(f"Error parsing {item_name} ({type}): {e}")
        
    return familiar_dictionaries
    
def find_items_with_similar_names(folder_path, containing_directory, base_name, extension_filter, load = False):
    # logger.info(
    #     f'folder_path, containing_directory, base_name, extension_filter, load: {folder_path, containing_directory, base_name, extension_filter, load}'
    # )
    familiars = []
    
    for file_name in os.listdir(folder_path):

        if should_cancel_task():
            break

        # logger.info(f"file_name in directory: {file_name}")
        file_name_no_ext, ext = os.path.splitext(file_name)
        # logger.info(f"file_name_no_ext, ext: {file_name_no_ext, ext}")
        if ext in extension_filter and base_name in file_name_no_ext:
            # logger.info(f"file_name matches criteria: {file_name}")
            if load:
                try: 
                    with open(folder_path + "/" + file_name, 'r', encoding='utf-8') as opened_file:
                        loaded_text = opened_file.read()
                        familiars.append({"file_name": file_name, "loaded_text": loaded_text})
                        continue
                except Exception as e:
                    log_exception("Error loading text, will append familiar file name. Error:", e)
            familiars.append({"file_name": containing_directory + "/" + file_name if containing_directory is not None else file_name, "loaded_text": ""})

    familiars.sort(key=lambda x: x["file_name"])
    return familiars

def list_subdirectories_recursively(root_directory):
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

def list_immediate_subdirectories(root_directory):
    results = []

    if not os.path.isdir(root_directory):
        return results
            
    items = os.listdir(root_directory)

    for item in items:
        combined_path = os.path.join(root_directory, item)
        if os.path.isdir(combined_path):
            results.append(item)

    results = sorted(results)

    return results

def list_comfyui_subdirectories_request(request):
    CANCELLATION_REQUESTED = False
    try:        

        root_directory = convert_relative_comfyui_path_to_full_path(request.rel_url.query["root_directory"])

        results = list_subdirectories_recursively(root_directory)

        return web.json_response({"success": len(results) > 0, "payload": results })

    except Exception as e:
        log_exception("Error listing subdirectories:", e)
        return web.json_response({"success": False, "error": str(e)})

def list_immediate_subdirectories_request(request):

    try:        

        root_directory = resolve_file_path(request.rel_url.query["root_directory"])

        results = list_immediate_subdirectories(root_directory)

        return web.json_response({"success": len(results) > 0, "payload": results })

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
            open_file_manager(os.path.normpath(result["payload"]["file"]))
            return web.json_response({"success": True})
    except Exception as e:
        logger.error(e)
        return web.json_response({"success": False, "error": str(e)})

async def validate_and_return_file_from_request(request):
    type = "loras"
    if "type" in request.rel_url.query:
        type = request.rel_url.query["type"]
        
    base_dirs = None
    
    try: # Try to infer base_dir
        base_dirs = folder_paths.get_folder_paths(type)
        # logger.info(f"base_dirs: {base_dirs}")
    except: # If we can't, most likely because it's not a built-in type, assume type is a subfolder in the ComfyUI directory
        # logger.info("validate_and_return_file_from_request: failed to infer base_dir")
        try:
            base_dirs = [convert_relative_comfyui_path_to_full_path(type)]
            # logger.info(f"base_dirs: {base_dirs}")
        except Exception as e:
            log_exception(f"Error finding folder {type}. Error:", e)
            
    if base_dirs is None or len(base_dirs) == 0:
        logger.warning(f"Unable to get parent directory for {type}")
        return { "success": False, "response": 400 }
    
    for base_dir in base_dirs:
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

    return { "success": False, "response": 400 }

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

async def save_image_as_model_preview(request):

    try:
        # For ease of use, pass the model URI in the URL
        result = await validate_and_return_file_from_request(request)

        if result["success"] == True:

            request_data = await read_web_request_content(request.content)
            request_json = json.loads(request_data)

            new_image_url = request_json["url"]

            model_file_path = result["payload"]["file"]
            model_directory = os.path.dirname(model_file_path)
            model_base_name = os.path.splitext(os.path.basename(model_file_path))[0]

            new_image_file_name = None

            async with aiohttp.ClientSession() as session:
                async with session.get(new_image_url) as response:
                    if response.status == 200:
                        new_image_ext = response.content_type.split("/")[1]
                        new_image_file_name =  f"{get_next_base_filename(model_directory, model_base_name)}.{new_image_ext}"
                        new_image_path = os.path.join(model_directory, new_image_file_name)
                        with open(new_image_path, "wb") as file:
                            while chunk := await response.content.read(1024):
                                file.write(chunk)
                    else:
                        return web.json_response({"success": False, "error": "Failed to download image"})

            
            return web.json_response({"success": True, "file_name": new_image_file_name})

    except Exception as e:
        logger.error(e)
        return web.json_response({"success": False, "error": str(e)})

async def copy_item(request):
   
    def copy_file(path_from, path_to):
        try:
            if os.path.isfile(path_from):
                try:
                    path_to_dir = os.path.dirname(path_to)
                    if not os.path.exists(path_to_dir):
                        os.makedirs(path_to_dir, exist_ok=True)
                    shutil.copy(path_from, path_to)
                    logger.info(f"Successfully copied file from '{path_from}' to '{path_to}'")
                    return web.json_response({"success": True})
                except Exception as e:
                    logger.error(f"Error occurred while copying file from '{path_from}' to '{path_to}': {e}")
                    return web.json_response({"success": False, "message": "Failed to copy file."})
            else:
                message = f"'{path_from}' is not a valid file."
                logger.warning(message)
                return web.json_response({"success": False, "message": message})
        except Exception as e:
            log_exception(f"Error occurred while deleting '{path}':", e)
            return web.json_response({"success": False, "message": message})

    result = await validate_and_return_file_from_request(request)

    if result["success"] == True:
        path_from = result["payload"]["file"]
        if "destination" in request.rel_url.query:
            path_to = request.rel_url.query["destination"]
            path_to = resolve_file_path(path_to)

        if path_from and path_to:
            return copy_file(path_from, path_to)

    logger.warning("File could not be copied: file not found or filename and destination not defined")
    return web.Response(status=404)

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
            full_output_folder = os.path.join(upload_dir, subfolder.replace("\\", "/"))
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

async def save_model_user_info(request):

    try:
        request_data = await read_web_request_content(request.content)
        request_json = json.loads(request_data)
        type = subfolder = item_name = text_to_save = None
        if "type" in request_json:
            type = request_json["type"]
        if "subfolder" in request_json:
            subfolder = request_json["subfolder"]
        if "item_name" in request_json:
            item_name = request_json["item_name"]
        if "text" in request_json:
            text_to_save = request_json["text"]
            
        if type and item_name and text_to_save:
            name = subfolder + '/' + item_name if subfolder is not None else item_name
            full_path = folder_paths.get_full_path(type, name)
            folder_path = os.path.dirname(full_path)
            file_name_no_ext, file_ext = os.path.splitext(os.path.basename(item_name))

            file_path = f"{folder_path}/{file_name_no_ext}.user.info"

            with open(file_path, 'w', encoding='utf-8') as file:
                file.write(text_to_save)

            return web.json_response({"success": True})

        assert ValueError

    except Exception as e:
        log_exception("Error saving text:", e)
        return web.json_response({"success": False, "error": str(e)})

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
        request_data = await read_web_request_content(request.content)
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
        request_data = await read_web_request_content(request.content)
        request_json = json.loads(request_data)
        if "path" in request_json:
            path = resolve_file_path(request_json["path"])
            with open(path, 'r', encoding='utf-8') as file:
                loaded_text = file.read()
    
            return web.json_response({"success": True, "payload" : loaded_text})
    except Exception as e:
        log_exception("Error loading text:", e)
        return web.json_response({"success": False, "error": str(e)})

def save_settings(request, settings):
    um = UserManager()
    file = um.get_request_user_filepath(
        request, "jnodes.settings.json")
    with open(file, "w") as f:
        f.write(json.dumps(settings, indent=4))

async def post_setting(request):
    try:
        request_data = await read_web_request_content(request.content)
        request_json = json.loads(request_data)

        setting_id = None
        if "id" in request_json:
            setting_id = request_json["id"]
        if not setting_id:
            return web.json_response({"success": False, "error": "No 'id' found in request!"})

        setting_value = None
        if "value" in request_json:
            setting_value = request_json["value"]
        if not setting_value:
            return web.json_response({"success": False, "error": "No 'value' found in request!"})
            
        if setting_id and setting_value:
            settings = get_settings(request)
            settings[setting_id] = setting_value
            save_settings(request, settings)
    
            return web.json_response({"success": True})

    except Exception as e:
        log_exception("Error saving text:", e)
        return web.json_response({"success": False, "error": str(e)})

async def post_all_settings(request):
    try:
        request_data = await read_web_request_content(request.content)
        request_json = json.loads(request_data)

        settings = None
        if "settings" in request_json:
            settings = request_json["settings"]

        if settings:
            save_settings(request, settings)
            return web.json_response({"success": True})
        else:
            return web.json_response({"success": False, "error": "No 'settings' found in request!"})

    except Exception as e:
        log_exception("Error saving text:", e)
        return web.json_response({"success": False, "error": str(e)})

def get_settings(request):
    um = UserManager()
    file = um.get_request_user_filepath(
        request, "jnodes.settings.json")
    if os.path.isfile(file):
        with open(file) as f:
            return json.load(f)
    else:
        return {}

async def get_setting(request):
    try:
        request_data = await read_web_request_content(request.content)
        request_json = json.loads(request_data)

        setting_id = None
        if "id" in request_json:
            setting_id = request_json["id"]

        settings = get_settings(request)
        return web.json_response({"success": True, "payload" : settings[setting_id]})
    
    except Exception as e:
        log_exception("Error loading text:", e)
        return web.json_response({"success": False, "error": str(e)})

async def get_all_settings(request):
    try:       
        settings = get_settings(request)
        return web.json_response({"success": True, "payload" : json.dumps(settings)})

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