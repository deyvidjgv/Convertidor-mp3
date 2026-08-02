(function () {
  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "http://localhost:8000";

  const els = {
    urlInput: document.getElementById("url-input"),
    fetchBtn: document.getElementById("fetch-btn"),
    preview: document.getElementById("preview"),
    thumb: document.getElementById("preview-thumb"),
    title: document.getElementById("preview-title"),
    uploader: document.getElementById("preview-uploader"),
    duration: document.getElementById("preview-duration"),
    previewAudio: document.getElementById("preview-audio"),
    form: document.getElementById("convert-form"),
    formatSelect: document.getElementById("format-select"),
    qualitySelect: document.getElementById("quality-select"),
    titleInput: document.getElementById("tag-title"),
    artistInput: document.getElementById("tag-artist"),
    albumInput: document.getElementById("tag-album"),
    convertBtn: document.getElementById("convert-btn"),
    status: document.getElementById("status"),
    sizeEstimate: document.getElementById("size-estimate"),
    sizeEstimateValue: document.getElementById("size-estimate-value"),
    sizeEstimateLabel: document.getElementById("size-estimate-label"),
  };

  let currentInfo = null;

  function formatDuration(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return "";
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(i > 0 && value < 10 ? 1 : 0)} ${units[i]}`;
  }

  // Estimación aproximada: los formatos con pérdida se calculan por bitrate;
  // WAV/FLAC asumen PCM 44.1kHz/16-bit estéreo como referencia (FLAC ~55% de ese tamaño).
  function estimateSizeBytes(durationSeconds, format, qualityKbps) {
    if (!durationSeconds) return null;
    if (format === "mp3" || format === "m4a") {
      const kbps = Number(qualityKbps) || 192;
      return ((kbps * 1000) / 8) * durationSeconds;
    }
    const wavBytes = durationSeconds * 44100 * 2 * 2;
    if (format === "wav") return wavBytes;
    if (format === "flac") return wavBytes * 0.55;
    return null;
  }

  function updateSizeEstimate() {
    const format = els.formatSelect.value;
    const isLossless = format === "wav" || format === "flac";
    els.qualitySelect.disabled = isLossless;

    if (!currentInfo || !currentInfo.duration) {
      els.sizeEstimate.hidden = true;
      return;
    }

    const bytes = estimateSizeBytes(currentInfo.duration, format, els.qualitySelect.value);
    if (!bytes) {
      els.sizeEstimate.hidden = true;
      return;
    }

    els.sizeEstimateValue.textContent = `~${formatBytes(bytes)}`;
    els.sizeEstimateLabel.textContent = isLossless ? "estimado · sin pérdida" : "tamaño estimado";
    els.sizeEstimate.hidden = false;
  }

  function setStatus(message, type) {
    els.status.textContent = message || "";
    if (type) {
      els.status.dataset.type = type;
    } else {
      delete els.status.dataset.type;
    }
  }

  async function parseError(res) {
    try {
      const data = await res.json();
      return data.detail || "Ocurrió un error inesperado.";
    } catch {
      return "Ocurrió un error inesperado.";
    }
  }

  async function fetchInfo() {
    const url = els.urlInput.value.trim();
    if (!url) {
      setStatus("Pega un enlace primero.", "error");
      return;
    }

    setStatus("Buscando información…");
    els.fetchBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await parseError(res));

      currentInfo = await res.json();

      els.thumb.src = currentInfo.thumbnail || "";
      els.thumb.alt = currentInfo.title || "";
      els.title.textContent = currentInfo.title || "Sin título";
      els.uploader.textContent = currentInfo.uploader || "";
      els.duration.textContent = formatDuration(currentInfo.duration);

      els.titleInput.value = currentInfo.title || "";
      els.artistInput.value = currentInfo.uploader || "";
      els.albumInput.value = "";

      els.preview.hidden = false;
      els.form.hidden = false;
      updateSizeEstimate();

      els.previewAudio.src = `${API_BASE}/api/stream?url=${encodeURIComponent(url)}`;
      els.previewAudio.load();
      els.previewAudio.play().catch(() => {});

      setStatus("Listo. Elige formato y convierte.", "success");
    } catch (err) {
      currentInfo = null;
      els.preview.hidden = true;
      els.form.hidden = true;
      els.sizeEstimate.hidden = true;
      els.previewAudio.pause();
      els.previewAudio.removeAttribute("src");
      els.previewAudio.load();
      setStatus(err.message, "error");
    } finally {
      els.fetchBtn.disabled = false;
    }
  }

  async function saveFile(blob, filename, format) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "Archivo de audio",
              accept: { [`audio/${format}`]: [`.${format}`] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw new Error("Descarga cancelada.");
        }
        // Si falla el picker por alguna razón, seguimos con la descarga estándar.
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleConvert(event) {
    event.preventDefault();

    const url = els.urlInput.value.trim();
    if (!url) return;

    const format = els.formatSelect.value;
    setStatus("Convirtiendo… esto puede tardar un momento.");
    els.convertBtn.disabled = true;

    try {
      const payload = {
        url,
        format,
        quality: els.qualitySelect.value,
        title: els.titleInput.value.trim(),
        artist: els.artistInput.value.trim(),
        album: els.albumInput.value.trim(),
        cover_url: currentInfo ? currentInfo.thumbnail : null,
      };

      const res = await fetch(`${API_BASE}/api/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await parseError(res));

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${payload.title || "audio"}.${format}`;

      await saveFile(blob, filename, format);
      const sizeLabel = formatBytes(blob.size);
      setStatus(sizeLabel ? `¡Descarga completa! (${sizeLabel})` : "¡Descarga completa!", "success");
    } catch (err) {
      setStatus(err.message, "error");
    } finally {
      els.convertBtn.disabled = false;
    }
  }

  els.fetchBtn.addEventListener("click", fetchInfo);
  els.urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchInfo();
    }
  });
  els.form.addEventListener("submit", handleConvert);
  els.formatSelect.addEventListener("change", updateSizeEstimate);
  els.qualitySelect.addEventListener("change", updateSizeEstimate);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
