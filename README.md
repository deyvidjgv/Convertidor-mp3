# Convertidor MP3 (PWA)

App web progresiva para convertir videos a MP3, M4A, WAV o FLAC usando
[yt-dlp](https://github.com/yt-dlp/yt-dlp), con etiquetas ID3 personalizables
(título, artista, álbum, carátula).

> Usa esta herramienta solo con contenido propio o con derechos para
> descargar. Respeta los términos de servicio de la plataforma de origen y
> los derechos de autor del contenido.

## Estructura del proyecto

```
convertidor mp3/
├── frontend/          PWA (HTML/CSS/JS) → se despliega en Netlify
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── css/styles.css
│   ├── js/app.js
│   ├── js/config.js   ← URL del backend (editar antes de desplegar)
│   └── icons/
├── backend/            API FastAPI + yt-dlp + ffmpeg → se despliega en Render
│   ├── app/main.py
│   ├── app/tagging.py
│   ├── requirements.txt
│   └── Dockerfile
├── render.yaml          Blueprint opcional para desplegar el backend en Render
└── netlify.toml          Config de Netlify para el frontend
```

## 1. Probar en local

### Backend

Requiere Python 3.11+ y [ffmpeg](https://ffmpeg.org/download.html) instalado
y disponible en el `PATH`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # en PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

El backend queda en `http://localhost:8000`. Prueba `http://localhost:8000/api/health`.

### Frontend

`frontend/js/config.js` ya apunta a `http://localhost:8000` por defecto. Solo
sirve la carpeta `frontend/` con cualquier servidor estático, por ejemplo:

```bash
cd frontend
npx serve .
```

Abre la URL que te indique (normalmente `http://localhost:3000`).

## 2. Desplegar en producción (Netlify + Render)

### Paso 1 — Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Convertidor MP3: primera versión"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### Paso 2 — Backend en Render

1. Entra a [render.com](https://render.com) → **New +** → **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Render detectará `render.yaml` automáticamente (o configura manualmente):
   - **Root/Dockerfile path**: `backend/Dockerfile`
   - **Docker context**: `backend`
   - **Plan**: Free
4. Añade la variable de entorno `ALLOWED_ORIGINS` con la URL que tendrá tu
   sitio de Netlify, por ejemplo `https://tu-sitio.netlify.app` (puedes
   editarla después de crear el sitio en Netlify).
5. Despliega. Copia la URL pública que te da Render, algo como
   `https://convertidor-mp3-backend.onrender.com`.

> Nota: el plan free de Render "duerme" el servicio tras inactividad; la
> primera petición después de dormir puede tardar ~30-50s en responder.

### Paso 3 — Frontend en Netlify

1. Antes de desplegar, edita [`frontend/js/config.js`](frontend/js/config.js)
   y cambia `API_BASE_URL` por la URL de tu backend en Render:

   ```js
   window.APP_CONFIG = {
     API_BASE_URL: "https://convertidor-mp3-backend.onrender.com",
   };
   ```

   Haz commit y push de ese cambio.

2. Entra a [netlify.com](https://netlify.com) → **Add new site** → **Import
   an existing project** → conecta el mismo repositorio de GitHub.
3. Netlify detecta `netlify.toml` automáticamente (publica la carpeta
   `frontend/`). No requiere build command.
4. Despliega. Netlify te da una URL, por ejemplo
   `https://tu-sitio.netlify.app`.

### Paso 4 — Cerrar el círculo de CORS

Vuelve a Render y actualiza la variable `ALLOWED_ORIGINS` con la URL real de
Netlify (`https://tu-sitio.netlify.app`, sin `/` al final). Guarda: Render
redeploya solo.

Listo: abre tu sitio de Netlify, pega un enlace y convierte.

## Paleta de colores

| Color | Uso |
|---|---|
| `#BDCFFF` | Fondo / degradado inicial |
| `#B8C0FF` | Botones primarios / theme-color |
| `#C8B6FE` | Acentos, focus |
| `#E7C5FF` | Degradado final / blobs decorativos |
| `#F3DDFF` | Detalle claro final del degradado |

> El último color que enviaste (`#F3DD5FF`) tiene 7 dígitos hex, un formato
> inválido — lo interpreté como `#F3DDFF` (el ajuste más simple que sigue el
> patrón de los otros). Está centralizado como variable CSS `--c5` en
> [`frontend/css/styles.css`](frontend/css/styles.css:2), así que es un
> cambio de una sola línea si el diseño final de Claude Design usa otro tono.

## Etiquetas ID3 soportadas

Al convertir, el backend escribe automáticamente: **título**, **artista**,
**álbum** y **carátula** (tomada de la miniatura del video, o la que definas).
Cada formato usa su propio estándar de metadata vía
[mutagen](https://mutagen.readthedocs.io/): ID3 para MP3/WAV, atom tags para
M4A, Vorbis comments para FLAC.

## Formatos y calidad

- MP3, M4A/AAC, WAV, FLAC.
- Calidad seleccionable (128/192/256/320 kbps) para los formatos con
  compresión con pérdida (MP3, M4A). WAV y FLAC siempre son sin pérdida.

## Elegir dónde descargar

En navegadores de escritorio compatibles (Chrome, Edge) se usa la
`File System Access API`: al convertir, se abre el diálogo nativo "Guardar
como" para elegir carpeta y nombre. En navegadores sin soporte (Firefox,
Safari, móvil) se usa la descarga estándar del navegador hacia la carpeta de
descargas configurada en el sistema.
