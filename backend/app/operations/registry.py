from . import artistic, background, blend, classical, enhance, filters

OPERATIONS = {
    "crop": classical.crop,
    "resize": classical.resize,
    "rotate": classical.rotate,
    "flip": classical.flip,
    "affine": classical.affine,
    "adjust": classical.adjust,
    "auto_enhance": classical.clahe,
    "pro_enhance": enhance.pro_enhance,
    "blend": blend.blend,
    "filter": filters.filter_preset,
    "blur": filters.blur,
    "sharpen": filters.sharpen,
    "brightness_contrast": filters.brightness_contrast,
    "hue_saturation": filters.hue_saturation,
    "grayscale": filters.grayscale,
    "sepia": filters.sepia,
    "vignette": filters.vignette,
    "upscale": filters.upscale,
    "resize_canvas": classical.resize_canvas,
    "remove_background": background.remove_background,
    "remove_object": filters.inpaint,
    "invert": artistic.invert,
    "posterize": artistic.posterize,
    "solarize": artistic.solarize,
    "threshold": artistic.threshold,
    "motion_blur": artistic.motion_blur,
    "radial_blur": artistic.radial_blur,
    "pixelate": artistic.pixelate,
    "denoise": artistic.denoise,
    "grain": artistic.grain,
    "glitch": artistic.glitch,
    "style": artistic.style,
}

COMPARISON_OPERATIONS = {
    "remove_object": [
        {"engine": "opencv_classical", "handler": filters.inpaint},
    ],
}


def get_operation(name: str):
    return OPERATIONS.get(name)


def get_comparison(name: str) -> list[dict] | None:
    return COMPARISON_OPERATIONS.get(name)