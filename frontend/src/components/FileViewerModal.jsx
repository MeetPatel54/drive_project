import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MIME_EXTENSION = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const getExtension = (fileName = "") => {
  const cleanName = fileName.split("?")[0].split("#")[0];
  return cleanName.includes(".") ? cleanName.split(".").pop().toLowerCase() : "";
};

const getFileNameFromHeader = (contentDisposition) => {
  if (!contentDisposition) return "";

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
    } catch {
      return utfMatch[1].replace(/"/g, "");
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || "";
};

const getErrorMessage = async (err) => {
  const fallback = "Unable to load this file. Please try again.";
  const data = err.response?.data;

  if (data instanceof Blob && data.type.includes("application/json")) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.error || parsed.message || fallback;
    } catch {
      return fallback;
    }
  }

  return data?.error || data?.message || err.message || fallback;
};

const getViewerType = (mimeType, fileName) => {
  const normalizedMimeType = mimeType.toLowerCase().split(";")[0].trim();
  const extension = getExtension(fileName);

  if (normalizedMimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (IMAGE_MIME_TYPES.includes(normalizedMimeType) || IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  return "download";
};

const detectBlobMimeType = async (blob, headerMimeType = "") => {
  const normalizedHeader = headerMimeType.toLowerCase().split(";")[0].trim();
  if (normalizedHeader && normalizedHeader !== "application/octet-stream") {
    return normalizedHeader;
  }

  const buffer = await blob.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const signature = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");

  if (signature.startsWith("%PDF")) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") return "image/webp";

  return normalizedHeader || blob.type || "application/octet-stream";
};

const withDetectedExtension = (name, detectedMimeType) => {
  if (getExtension(name)) return name;

  const extension = MIME_EXTENSION[detectedMimeType];
  return extension ? `${name}.${extension}` : name;
};

const FileIcon = ({ type }) => {
  const icon = type === "pdf" ? "PDF" : type === "image" ? "IMG" : "FILE";

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[11px] font-bold tracking-wide text-white shadow-inner">
      {icon}
    </div>
  );
};

const FileViewerModal = ({ file, isOpen, onClose }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  const displayName = fileName || file?.name || "Result file";
  const viewerType = useMemo(() => getViewerType(mimeType, displayName), [mimeType, displayName]);
  const canDownload = Boolean(blobUrl) && !loading;

  useEffect(() => {
    if (!isOpen || !file?.id) return undefined;

    const controller = new AbortController();
    let objectUrl = "";

    const loadFile = async () => {
      setLoading(true);
      setError("");
      setBlobUrl("");
      setMimeType("");
      setFileName(file.name || "Result file");
      setPreviewError("");
      setIsMaximized(false);

      try {
        const response = await api.get(`/results/${file.id}/stream`, {
          responseType: "blob",
          signal: controller.signal,
        });

        const headerMimeType = response.headers["content-type"] || response.data.type || "";
        const headerFileName = getFileNameFromHeader(response.headers["content-disposition"]);
        const detectedMimeType = await detectBlobMimeType(response.data, headerMimeType);
        const resolvedFileName = withDetectedExtension(
          headerFileName || file.name || "result-file",
          detectedMimeType
        );
        const fileBlob =
          response.data.type === detectedMimeType
            ? response.data
            : new Blob([response.data], { type: detectedMimeType });

        objectUrl = URL.createObjectURL(fileBlob);
        setBlobUrl(objectUrl);
        setMimeType(detectedMimeType);
        setFileName(resolvedFileName);
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        setError(await getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
      );
      const elements = Array.from(focusableElements);
      if (!elements.length) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 opacity-100 backdrop-blur-xl transition-opacity duration-200 sm:p-6"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-viewer-title"
        aria-describedby="file-viewer-description"
        className={`flex w-full transform flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/60 ring-1 ring-white/10 transition-all duration-300 ${
          isMaximized ? "h-[96vh] max-w-[96vw]" : "h-[86vh] max-w-6xl scale-100"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-2xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon type={viewerType} />
            <div className="min-w-0">
              <h2 id="file-viewer-title" className="truncate text-sm font-semibold text-white sm:text-base">
                {displayName}
              </h2>
              <p id="file-viewer-description" className="mt-0.5 text-xs text-slate-300">
                {loading ? "Loading secure preview..." : viewerType === "download" ? "Preview unavailable" : "Secure preview"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canDownload ? (
              <a
                href={blobUrl}
                download={displayName}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                Download
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="hidden h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-400 sm:inline-flex"
              >
                Download
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized((value) => !value)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-lg leading-none text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label={isMaximized ? "Restore file viewer size" : "Maximize file viewer"}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? "[]" : "[ ]"}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xl leading-none text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label="Close file viewer"
              title="Close"
            >
              x
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(30,41,59,0.9))] p-3 sm:p-5">
          <div className="relative flex min-h-0 w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-inner">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-950/60 backdrop-blur-md">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                <p className="text-sm font-medium text-slate-200">Loading file preview...</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex w-full items-center justify-center p-6">
                <div className="max-w-md rounded-2xl border border-red-300/20 bg-red-500/10 p-6 text-center shadow-xl">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-400/15 text-2xl text-red-100">
                    !
                  </div>
                  <h3 className="text-base font-semibold text-white">Could not open file</h3>
                  <p className="mt-2 text-sm leading-6 text-red-100/80">{error}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

           {!loading && !error && blobUrl && viewerType === "pdf" && (
  <iframe
    src={blobUrl}
    title={displayName}
    className="h-full w-full border-0 bg-white"
  />
)}

            {!loading && !error && blobUrl && viewerType === "image" && !previewError && (
              <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
                <img
                  src={blobUrl}
                  alt={displayName}
                  onError={() => setPreviewError("The image loaded, but the browser could not render its preview.")}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-slate-950/40"
                />
              </div>
            )}

            {!loading && !error && blobUrl && previewError && (
              <div className="flex w-full items-center justify-center p-6">
                <div className="w-full max-w-md rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6 text-center shadow-xl backdrop-blur-xl">
                  <h3 className="text-base font-semibold text-white">Preview unavailable</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-50/80">{previewError}</p>
                  <a
                    href={blobUrl}
                    download={displayName}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    Download file
                  </a>
                </div>
              </div>
            )}

            {!loading && !error && blobUrl && viewerType === "download" && !previewError && (
              <div className="flex w-full items-center justify-center p-6">
                <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 text-center shadow-xl backdrop-blur-xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xs font-bold tracking-wide text-white">
                    FILE
                  </div>
                  <h3 className="truncate text-base font-semibold text-white">{displayName}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This file type cannot be previewed in the browser. Download it securely to view it on your device.
                  </p>
                  <a
                    href={blobUrl}
                    download={displayName}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    Download file
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
