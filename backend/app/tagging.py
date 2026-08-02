"""Escritura de etiquetas ID3 / metadata para los formatos de audio soportados."""
import urllib.request
from pathlib import Path
from typing import Optional

from mutagen.flac import FLAC, Picture
from mutagen.id3 import APIC, ID3, TALB, TIT2, TPE1
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4Cover
from mutagen.wave import WAVE


def _fetch_cover_bytes(cover_url: Optional[str]) -> Optional[bytes]:
    if not cover_url:
        return None
    try:
        req = urllib.request.Request(cover_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read()
    except Exception:
        return None


def apply_id3_tags(path: Path, fmt: str, tags: dict, cover_url: Optional[str] = None) -> None:
    """Escribe title/artist/album y carátula en el archivo de audio ya convertido."""
    cover_bytes = _fetch_cover_bytes(cover_url)
    title = tags.get("title", "") or ""
    artist = tags.get("artist", "") or ""
    album = tags.get("album", "") or ""

    if fmt == "mp3":
        audio = MP3(path, ID3=ID3)
        if audio.tags is None:
            audio.add_tags()
        audio.tags.add(TIT2(encoding=3, text=title))
        audio.tags.add(TPE1(encoding=3, text=artist))
        audio.tags.add(TALB(encoding=3, text=album))
        if cover_bytes:
            audio.tags.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=cover_bytes))
        audio.save(v2_version=3)

    elif fmt == "m4a":
        audio = MP4(path)
        audio["\xa9nam"] = [title]
        audio["\xa9ART"] = [artist]
        audio["\xa9alb"] = [album]
        if cover_bytes:
            audio["covr"] = [MP4Cover(cover_bytes, imageformat=MP4Cover.FORMAT_JPEG)]
        audio.save()

    elif fmt == "flac":
        audio = FLAC(path)
        audio["title"] = title
        audio["artist"] = artist
        audio["album"] = album
        if cover_bytes:
            pic = Picture()
            pic.data = cover_bytes
            pic.type = 3
            pic.mime = "image/jpeg"
            audio.add_picture(pic)
        audio.save()

    elif fmt == "wav":
        audio = WAVE(path)
        if audio.tags is None:
            audio.add_tags()
        audio.tags.add(TIT2(encoding=3, text=title))
        audio.tags.add(TPE1(encoding=3, text=artist))
        audio.tags.add(TALB(encoding=3, text=album))
        audio.save()

    else:
        raise ValueError(f"Formato no soportado para etiquetado: {fmt}")
