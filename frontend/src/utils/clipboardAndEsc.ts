import { useEffect, useRef } from 'react';

// Stack of active Escape handlers so pressing ESC always closes only the topmost modal/drawer/lightbox
const escapeStack: Array<() => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && escapeStack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const topHandler = escapeStack[escapeStack.length - 1];
      if (topHandler) {
        topHandler();
      }
    }
  });
}

/**
 * Registers a stack-aware ESC key handler while `isActive` is true.
 * Pressing ESC closes only the most recently opened modal/drawer/lightbox.
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true) {
  const callbackRef = useRef(onEscape);
  callbackRef.current = onEscape;

  useEffect(() => {
    if (!isActive) return;
    const handler = () => callbackRef.current();
    escapeStack.push(handler);
    return () => {
      const idx = escapeStack.lastIndexOf(handler);
      if (idx !== -1) {
        escapeStack.splice(idx, 1);
      }
    };
  }, [isActive]);
}

const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|heic|heif|avif|bmp|gif|tiff?|dng|raw)$/i;

/**
 * Extracts File objects from a paste ClipboardEvent (works for screenshots, copied files from Explorer/Finder, LINE/WhatsApp images, etc.)
 */
export function extractFilesFromClipboard(
  clipboardData: DataTransfer | null,
  onlyImages: boolean = false
): File[] {
  if (!clipboardData) return [];
  const extracted: File[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) {
          const isImg = f.type.startsWith('image/') || IMAGE_EXT_REGEX.test(f.name);
          if (!onlyImages || isImg) {
            // Give generic clipboard blobs (like "image.png") a unique timestamped filename
            if (f.name === 'image.png' || f.name === 'blob') {
              const ext = f.type.split('/')[1] || 'png';
              const renamed = new File([f], `Pasted_${stamp}_${i + 1}.${ext}`, {
                type: f.type,
              });
              extracted.push(renamed);
            } else {
              extracted.push(f);
            }
          }
        }
      }
    }
  } else if (clipboardData.files && clipboardData.files.length > 0) {
    Array.from(clipboardData.files).forEach((f) => {
      const isImg = f.type.startsWith('image/') || IMAGE_EXT_REGEX.test(f.name);
      if (!onlyImages || isImg) {
        extracted.push(f);
      }
    });
  }

  return extracted;
}

/**
 * Reads image files directly from navigator.clipboard.read() when user clicks a "Paste from Clipboard" button
 */
export async function readClipboardFilesButton(): Promise<File[]> {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    throw new Error('Clipboard read API not supported; please press Ctrl+V / Cmd+V directly.');
  }
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    for (const type of item.types) {
      if (type.startsWith('image/') || type === 'application/pdf') {
        const blob = await item.getType(type);
        const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1] || 'png';
        files.push(
          new File([blob], `Clipboard_${stamp}_${i + 1}.${ext}`, {
            type,
          })
        );
      }
    }
  }
  return files;
}
