from .py.image_output_nodes import *
from .py.prompting_nodes import *
from .py.selector_nodes import *
from .py.video_nodes import *
from .py.misc import *
from .py.parameter_list import *
from .py.server_backend import *

from aiohttp import web
import server

@server.PromptServer.instance.routes.get('/jnodes_comfyui_subfolder_items')
async def get_comfyui_subfolder_items_wrapper(request):
    return get_comfyui_subfolder_items(request)

@server.PromptServer.instance.routes.get('/jnodes_model_items')
async def get_model_items_wrapper(request):
    return get_model_items(request)

@server.PromptServer.instance.routes.get('/jnodes_save_model_config')
async def save_model_config_wrapper(request):
    return save_model_config(request)

@server.PromptServer.instance.routes.get("/jnodes_view_image")
async def view_image_wrapper(request):
    return view_image(request)

@server.PromptServer.instance.routes.get("/jnodes_load_info")
async def load_info_wrapper(request):
    return load_info(request)

@server.PromptServer.instance.routes.post('/jnodes_request_task_cancellation')
async def request_task_cancellation_wrapper(request):
    return request_task_cancellation(request)

@server.PromptServer.instance.routes.post('/jnodes_save_text')
async def save_text_wrapper(request):
    return await save_text(request)

@server.PromptServer.instance.routes.post('/jnodes_load_text')
async def load_text_wrapper(request):
    return await load_text(request)
    
WEB_DIRECTORY = "./web"

# A dictionary that contains all nodes you want to export with their names
# NOTE: names should be globally unique
NODE_CLASS_MAPPINGS = {
    
    # image_output_nodes
    "JNodes_SaveVideo": SaveVideo,
    "JNodes_SaveImageWithOutput": SaveImageWithOutput,
    
    # parameter_list
    # Globals aren't ready yet
    #"JNodes_ParseParametersToGlobalList": ParseParametersToGlobalList,
    #"JNodes_GetParameterGlobal": GetParameterGlobal,
    "JNodes_GetParameterFromList": GetParameterFromList,
    
    # prompting_nodes
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
    "JNodes_TokenCounter": TokenCounter,
    
    # selector_nodes
    "JNodes_BooleanSelectorWithString": BooleanSelector,
    "JNodes_ImageSizeSelector": ImageSizeSelector,
    "JNodes_CheckpointSelectorWithString": CheckpointSelector,
    "JNodes_VaeSelectorWithString": VaeSelector,
    "JNodes_SamplerSelectorWithString": SamplerSelector,
    "JNodes_SchedulerSelectorWithString": SchedulerSelector,
    "JNodes_ImageFormatSelector": ImageFormatSelector,
    
    # video_nodes
    "JNodes_OutVideoInfo": OutVideoInfo,
    "JNodes_AppendReversedFrames": AppendReversedFrames,
    "JNodes_LoadVideo": LoadVideo,
    "JNodes_UploadVideo": UploadVideo,
    
    # misc
    "JNodes_GetTempDirectory": GetTempDirectory,
    "JNodes_GetOutputDirectory": GetOutputDirectory,
    "JNodes_StringLiteral" : StringLiteral,
    "JNodes_AnyToString" : AnyToString,
}

# A dictionary that contains the friendly/humanly readable titles for the nodes
NODE_DISPLAY_NAME_MAPPINGS = {
    
    # image_output_nodes
    "JNodes_SaveVideo": "Save Video",
    "JNodes_SaveImageWithOutput": "Save Image With Output",
    
    # parameter_list
    "JNodes_ParseParametersToGlobalList": "Parse Parameters To Global List",
    "JNodes_GetParameterGlobal": "Get Parameter Global",
    "JNodes_GetParameterFromList": "Get Parameter From List",
    
    # prompting_nodes
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
    "JNodes_RemovePngInfoKey" : "Remove Png Info Key",
    "JNodes_TokenCounter": "Token Counter",
    
    # selector_nodes
    "JNodes_BooleanSelectorWithString": "Boolean Selector + String",
    "JNodes_ImageSizeSelector": "Image Size Selector",
    "JNodes_CheckpointSelectorWithString": "Checkpoint Selector + String",
    "JNodes_VaeSelectorWithString": "Vae Selector + String",
    "JNodes_SamplerSelectorWithString": "Sampler Selector + String",
    "JNodes_SchedulerSelectorWithString": "Scheduler Selector + String",
    "JNodes_ImageFormatSelector": "Image Format Selector",
    
    # video_nodes
    "JNodes_OutVideoInfo": "Out Video Info",
    "JNodes_AppendReversedFrames": "Append Reversed Frames",
    "JNodes_LoadVideo": "Load Video",
    "JNodes_UploadVideo": "Upload Video",
    
    # misc
    "JNodes_GetTempDirectory": "Get Temp Directory",
    "JNodes_GetOutputDirectory": "Get Output Directory",
    "JNodes_StringLiteral" : "String Literal",
    "JNodes_AnyToString" : "Anything To String",
}


__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
