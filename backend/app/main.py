"""API del convertidor de audio: obtiene info del video y convierte/etiqueta el audio."""
import logging
import mimetypes
import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from .tagging import apply_id3_tags

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("convertidor-mp3")

app = FastAPI(title="Convertidor MP3 API", version="1.0.0")

# Orígenes permitidos para CORS.
# Cada puerto local tiene sus dos variantes (localhost + 127.0.0.1) para evitar
# rechazos dependiendo de cómo el navegador resuelva el hostname.
# En producción, añade el dominio de Netlify mediante la variable ALLOWED_ORIGINS.
_DEFAULT_ORIGINS: list[str] = [
    # Vite / npm run dev
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Live Server (VS Code) / any static server on 5500
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    # Webpack / create-react-app
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    # Next.js / otros
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

_env_origins = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins: list[str] = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins.strip()
    else _DEFAULT_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

SUPPORTED_FORMATS = {"mp3", "m4a", "wav", "flac"}
DOWNLOAD_ROOT = Path(tempfile.gettempdir()) / "convertidor-mp3-jobs"
DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)


class ConvertRequest(BaseModel):
    url: str
    format: str = "mp3"
    quality: str = "192"
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    cover_url: Optional[str] = None


def _safe_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", name or "")
    name = name.strip()
    return name[:150] if name else "audio"


def _new_job_dir() -> Path:
    job_dir = DOWNLOAD_ROOT / uuid.uuid4().hex
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def _download_with_ydl(url: str, ydl_opts: dict, job_dir: Path, glob_pattern: str, error_detail: str):
    """Corre yt-dlp con los opts dados y devuelve (archivo_generado, info).

    Limpia job_dir y lanza HTTPException tanto si yt-dlp falla como si no
    produce el archivo esperado.
    """
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.warning("%s (%s): %s", error_detail, url, exc)
        raise HTTPException(status_code=400, detail=error_detail) from exc

    produced_files = list(job_dir.glob(glob_pattern))
    if not produced_files:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="No se generó el archivo de audio")

    return produced_files[0], info


@app.get("/")
def read_root():
    return {"message": "API del Convertidor MP3 funcionando correctamente. Usa /api/health para comprobar el estado."}

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/info")
def get_info(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="Falta el parámetro url")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "format": "bestaudio/best",
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        logger.warning("Fallo al obtener info de %s: %s", url, exc)
        raise HTTPException(status_code=400, detail="No se pudo obtener información de ese enlace") from exc

    return {
        "title": info.get("title"),
        "uploader": info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "webpage_url": info.get("webpage_url"),
    }


@app.get("/api/stream")
def stream_audio(url: str):
    """Sirve el audio original sin transcodificar, para la vista previa del reproductor."""
    if not url:
        raise HTTPException(status_code=400, detail="Falta el parámetro url")

    job_dir = _new_job_dir()
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(job_dir / "preview.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    audio_path, _info = _download_with_ydl(
        url, ydl_opts, job_dir, "preview.*",
        error_detail="No se pudo obtener el audio para la vista previa",
    )

    media_type = mimetypes.guess_type(str(audio_path))[0] or "application/octet-stream"
    cleanup = BackgroundTask(shutil.rmtree, job_dir, ignore_errors=True)

    return FileResponse(path=audio_path, media_type=media_type, background=cleanup)


@app.post("/api/convert")
def convert(payload: ConvertRequest):
    fmt = (payload.format or "").lower()
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Formato no soportado: {fmt}")

    if not payload.url:
        raise HTTPException(status_code=400, detail="Falta la URL")

    job_dir = _new_job_dir()
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(job_dir / "audio.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": fmt,
                "preferredquality": payload.quality or "192",
            }
        ],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    audio_path, info = _download_with_ydl(
        payload.url, ydl_opts, job_dir, f"audio.{fmt}",
        error_detail="Error al descargar o convertir el audio",
    )

    tags = {
        "title": payload.title or info.get("title") or "audio",
        "artist": payload.artist or info.get("uploader") or "",
        "album": payload.album or "",
    }
    try:
        apply_id3_tags(audio_path, fmt, tags, cover_url=payload.cover_url or info.get("thumbnail"))
    except Exception as exc:
        logger.warning("No se pudieron escribir etiquetas ID3: %s", exc)

    final_name = f"{_safe_filename(tags['title'])}.{fmt}"
    cleanup = BackgroundTask(shutil.rmtree, job_dir, ignore_errors=True)

    return FileResponse(
        path=audio_path,
        filename=final_name,
        media_type="application/octet-stream",
        background=cleanup,
    )
