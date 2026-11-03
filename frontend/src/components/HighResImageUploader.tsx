import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Star,
  Trash2,
  Maximize2,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  ClipboardPaste,
} from 'lucide-react';
import { api } from '../api';
import {
  useEscapeKey,
  extractFilesFromClipboard,
  readClipboardFilesButton,
} from '../utils/clipboardAndEsc';

interface HighResImageUploaderProps {
  images: string[];
  coverImage?: string;
  onChange: (newImages: string[], newCover: string) => void;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  hideCoverBadge?: boolean;
  listenGlobalPaste?: boolean;
}

const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|heic|heif|avif|bmp|gif|tiff?|dng|raw)$/i;

export const HighResImageUploader: React.FC<HighResImageUploaderProps> = ({
  images,
  coverImage,
  onChange,
  compact = false,
  title = 'Drag & Drop or Copy & Paste (Ctrl+V) High-Res Pictures Here',
  subtitle = 'Supports uncompressed Mobile 48MP/200MP, ProRAW, HEIC, HEIF, 4K JPG, PNG, WEBP',
  hideCoverBadge = false,
  listenGlobalPaste = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close Lightbox on ESC
  useEscapeKey(() => setLightboxUrl(null), Boolean(lightboxUrl));

  const handleFiles = async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || IMAGE_EXT_REGEX.test(f.name)
    );
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadStatus(`Uploading ${validFiles.length} high-res photo(s) at original resolution...`);
    try {
      const res = await api.uploadImages(validFiles);
      const merged = [...images, ...res.urls];
      const nextCover = coverImage || merged[0] || '';
      onChange(merged, nextCover);
      const totalMB = (
        res.files.reduce((acc, f) => acc + f.size_bytes, 0) /
        (1024 * 1024)
      ).toFixed(2);
      setUploadStatus(`Uploaded ${res.urls.length} high-res photo(s) (${totalMB} MB preserved)`);
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err) {
      console.error('High-res upload error:', err);
      setUploadStatus('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Global / Modal Ctrl+V Paste listener for images
  useEffect(() => {
    if (!listenGlobalPaste) return;
    const onWindowPaste = (e: ClipboardEvent) => {
      if ((e as any).__handledByUploader) return;
      const pastedImages = extractFilesFromClipboard(e.clipboardData, true);
      if (pastedImages.length > 0) {
        (e as any).__handledByUploader = true;
        e.preventDefault();
        handleFiles(pastedImages);
      }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [listenGlobalPaste, images, coverImage]);

  const handleZonePaste = (e: React.ClipboardEvent) => {
    const pastedImages = extractFilesFromClipboard(e.clipboardData, true);
    if (pastedImages.length > 0) {
      (e.nativeEvent as any).__handledByUploader = true;
      e.preventDefault();
      e.stopPropagation();
      handleFiles(pastedImages);
    }
  };

  const handleClipboardButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const files = await readClipboardFilesButton();
      const imgFiles = files.filter(
        (f) => f.type.startsWith('image/') || IMAGE_EXT_REGEX.test(f.name)
      );
      if (imgFiles.length > 0) {
        await handleFiles(imgFiles);
      } else {
        setUploadStatus('No image found in clipboard. Copy an image or screenshot first.');
        setTimeout(() => setUploadStatus(null), 3500);
      }
    } catch {
      setUploadStatus('Press Ctrl+V (or Cmd+V) on your keyboard to paste copied images.');
      setTimeout(() => setUploadStatus(null), 3500);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const merged = images.includes(trimmed) ? images : [...images, trimmed];
    const nextCover = coverImage || merged[0] || '';
    onChange(merged, nextCover);
    setUrlInput('');
  };

  const handleSetCover = (url: string) => {
    const reordered = [url, ...images.filter((x) => x !== url)];
    onChange(reordered, url);
  };

  const handleRemove = (url: string) => {
    const remaining = images.filter((x) => x !== url);
    const nextCover = coverImage === url ? remaining[0] || '' : coverImage || remaining[0] || '';
    onChange(remaining, nextCover);
  };

  return (
    <div className="space-y-3" onPaste={handleZonePaste}>
      {/* Drag & Drop + Copy & Paste Zone */}
      <div
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-4 text-center flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/80 scale-[1.01]'
            : 'border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif,.avif,.dng,.raw,.tiff,.tif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
            <span className="text-xs font-semibold text-indigo-700">{uploadStatus}</span>
          </div>
        ) : (
          <>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-1.5">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">{title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {subtitle}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-indigo-600 text-[11px] font-bold shadow-2xs hover:bg-indigo-50">
                Browse High-Res Files
              </span>
              <button
                type="button"
                onClick={handleClipboardButtonClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100 transition"
                title="Paste copied image or screenshot from clipboard (or press Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste Image (Ctrl+V)
              </button>
            </div>
            {uploadStatus && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> {uploadStatus}
              </div>
            )}
          </>
        )}
      </div>

      {/* Optional Direct Image URL Input */}
      {!compact && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder="Or paste high-res image URL (https://...)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add URL
          </button>
        </div>
      )}

      {/* Uploaded Unit Pictures Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {images.map((url, idx) => {
            const isCover = !hideCoverBadge && (coverImage ? coverImage === url : idx === 0);
            return (
              <div
                key={`${url}-${idx}`}
                className={`group relative rounded-xl overflow-hidden border-2 bg-slate-100 aspect-4/3 ${
                  isCover ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                <img
                  src={url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxUrl(url);
                    }}
                    className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white shadow-xs"
                    title="View Full-Res Photo"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  {!isCover && !hideCoverBadge && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCover(url);
                      }}
                      className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 shadow-xs"
                      title="Set as Main Cover Photo"
                    >
                      Set Cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(url);
                    }}
                    className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 shadow-xs"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isCover && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                    <Star className="w-2.5 h-2.5 fill-white" /> Cover
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Resolution Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center gap-1.5 text-xs font-semibold px-3"
          >
            <span>ESC</span>
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="High-Res Preview"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
