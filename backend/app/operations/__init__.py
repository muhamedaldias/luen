import re

from PIL import Image

from .. import storage
from ..config import get_settings

IMAGE_ID_RE = re.compile(r"^[0-9a-f]{32}$")

# تفعيل حد البكسلات عالمياً (حماية Decompression Bomb).
# يجب أن يُضبط قبل أي Image.open — بما فيها عمّال ProcessPool (يستوردون هذه الوحدة).
try:
    Image.MAX_IMAGE_PIXELS = int(get_settings().max_image_pixels)
except Exception:
    Image.MAX_IMAGE_PIXELS = 64_000_000


class ValidationError(Exception):
    pass


def validate_image_id(image_id: str) -> None:
    if not IMAGE_ID_RE.fullmatch(image_id):
        raise ValidationError(f"invalid image id: {image_id!r}")


def load_original(user_id: str, image_id: str) -> Image.Image:
    validate_image_id(image_id)
    path = storage.original_path(user_id, image_id)
    if not path.exists():
        raise FileNotFoundError(f"original image not found: {image_id}")
    return Image.open(path).copy()


def save_result(image: Image.Image, user_id: str, image_id: str, operation: str) -> str:
    validate_image_id(image_id)
    if image.mode != "RGBA" and "A" in image.getbands():
        image = image.convert("RGBA")
    output = storage.result_path(user_id, image_id, operation)
    if image.mode in ("P", "CMYK", "LA"):
        image = image.convert("RGBA")
    image.save(output, format="PNG")
    return storage.as_url(user_id, image_id, f"{operation}.png")