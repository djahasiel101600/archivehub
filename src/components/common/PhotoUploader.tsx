import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, X, Check, RefreshCw } from 'lucide-react';

interface PresetOption {
  label: string;
  url: string;
}

interface PhotoUploaderProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  presets?: PresetOption[];
}

/**
 * Resizes large image files on canvas before converting to base64 Data URL
 * to ensure high crisp quality while preventing memory bloat.
 */
function compressImageFile(file: File, maxDimension = 1000, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Failed to read file'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result); // Fallback to raw data url if img render fails
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  value,
  onChange,
  label = 'Storage Unit Photo',
  presets = []
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    try {
      setIsProcessing(true);
      const dataUrl = await compressImageFile(file);
      onChange(dataUrl);
    } catch (err) {
      console.error('Failed to process image file', err);
      alert('Could not read image file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const isBase64 = value.startsWith('data:image/');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label">
          {label}
        </label>
        
        {/* Toggle Mode Buttons */}
        <div className="inline-flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              mode === 'upload'
                ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-300 shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Upload className="w-3 h-3" />
            Local Device
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              mode === 'url'
                ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-300 shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            Image URL
          </button>
        </div>
      </div>

      {/* Preview Box if Photo is Present */}
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900/5 p-2 flex items-center gap-3">
          <img
            src={value}
            alt="Storage Photo Preview"
            className="w-20 h-20 rounded-lg object-cover bg-zinc-100 border border-zinc-200 dark:border-zinc-700"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0 text-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`chip uppercase ${
                isBase64 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
              }`}>
                {isBase64 ? 'Local Upload' : 'Web URL'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Attached
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {isBase64 ? 'Photo stored from local file storage' : value}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" /> Change File
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={() => onChange('')}
                className="btn btn-ghost btn-xs text-rose-600 dark:text-rose-400"
              >
                <X className="w-3 h-3" aria-hidden="true" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State Dropzone / Input */
        <div>
          {mode === 'upload' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-teal-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-1.5 py-1">
                <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-lg">
                  {isProcessing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {isProcessing ? 'Processing local image...' : 'Click to select photo or drag & drop'}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Supports PNG, JPG, WEBP, GIF from your computer
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="url"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="input"
              />
            </div>
          )}
        </div>
      )}

      {/* Invisible file input if mode === 'url' but user clicks change file */}
      {mode === 'url' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      )}

      {/* Preset options */}
      {presets.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 font-medium">Sample Presets:</span>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(preset.url)}
                className="btn btn-secondary btn-xs"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
