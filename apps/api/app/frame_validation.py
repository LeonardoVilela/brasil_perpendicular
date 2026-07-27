from __future__ import annotations

import base64
import binascii

JPEG_PREFIX = "data:image/jpeg;base64,"
MAX_DIMENSION = 1024
MIN_DIMENSION = 16


def _jpeg_dimensions(data: bytes) -> tuple[int, int]:
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("frame não é JPEG")

    index = 2
    sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while index + 3 < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        while index < len(data) and data[index] == 0xFF:
            index += 1
        if index >= len(data):
            break
        marker = data[index]
        index += 1
        if marker in {0x01, 0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if index + 2 > len(data):
            break
        segment_length = int.from_bytes(data[index : index + 2], "big")
        if segment_length < 2 or index + segment_length > len(data):
            raise ValueError("segmento JPEG inválido")
        if marker in sof_markers:
            if segment_length < 7:
                raise ValueError("cabeçalho JPEG inválido")
            height = int.from_bytes(data[index + 3 : index + 5], "big")
            width = int.from_bytes(data[index + 5 : index + 7], "big")
            return width, height
        index += segment_length
    raise ValueError("dimensões JPEG ausentes")


def decode_and_validate_frames(frames: list[str]) -> list[bytes]:
    decoded: list[bytes] = []
    for frame in frames:
        if not frame.startswith(JPEG_PREFIX):
            raise ValueError("somente frames JPEG são aceitos")
        try:
            data = base64.b64decode(frame[len(JPEG_PREFIX) :], validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("base64 inválido") from error
        width, height = _jpeg_dimensions(data)
        if not (MIN_DIMENSION <= width <= MAX_DIMENSION and MIN_DIMENSION <= height <= MAX_DIMENSION):
            raise ValueError("dimensões do frame fora do limite")
        decoded.append(data)
    return decoded
