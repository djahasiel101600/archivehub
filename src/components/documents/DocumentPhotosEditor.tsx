import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Star, Trash2 } from 'lucide-react';
import { DocumentPhoto, User } from '../../types';

export const MAX_DOCUMENT_PHOTOS = 5;

interface DocumentPhotosEditorProps {
  photos: DocumentPhoto[];
  onChange: (photos: DocumentPhoto[]) => void;
  user: User;
  disabled?: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read ${file.name}.`));
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function compressDocumentPhoto(file: File, user: User): Promise<DocumentPhoto> {
  const source = await readFileAsDataUrl(file);
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`${file.name} is not a readable image.`));
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the selected image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: canvas.toDataURL('image/jpeg', 0.82),
    fileName: file.name,
    fileType: 'image/jpeg',
    fileSize: `${(file.size / 1024).toFixed(0)} KB`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.id,
    uploadedByName: user.fullName,
  };
}

export const DocumentPhotosEditor: React.FC<DocumentPhotosEditorProps> = ({ photos, onChange, user, disabled = false }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState(photos[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const selectedPhoto = photos.find(photo => photo.id === selectedPhotoId) || photos[0];
  const remainingSlots = MAX_DOCUMENT_PHOTOS - photos.length;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || isProcessing) return;
    setError('');
    const files = Array.from(fileList);
    const accepted = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Only ${MAX_DOCUMENT_PHOTOS} photos are allowed. The extra files were not added.`);
    }
    if (accepted.some(file => !file.type.startsWith('image/'))) {
      setError('Only image files can be added.');
      return;
    }
    if (accepted.some(file => file.size > 25 * 1024 * 1024)) {
      setError('Each image must be 25 MB or smaller.');
      return;
    }
    if (!accepted.length) return;

    setIsProcessing(true);
    try {
      const processed: DocumentPhoto[] = [];
      for (const file of accepted) processed.push(await compressDocumentPhoto(file, user));
      const updated = [...photos, ...processed].slice(0, MAX_DOCUMENT_PHOTOS);
      if (updated.reduce((total, photo) => total + photo.url.length, 0) > 8_000_000) {
        setError('These images are too large to save together. Choose fewer or smaller images.');
        return;
      }
      onChange(updated);
      setSelectedPhotoId(updated[0]?.id || '');
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : 'Could not process the selected images.');
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const setAsCover = (photoId: string) => {
    const index = photos.findIndex(photo => photo.id === photoId);
    if (index <= 0) return;
    const reordered = [...photos];
    const [photo] = reordered.splice(index, 1);
    onChange([photo, ...reordered]);
    setSelectedPhotoId(photoId);
  };

  const removePhoto = (photoId: string) => {
    const updated = photos.filter(photo => photo.id !== photoId);
    onChange(updated);
    setSelectedPhotoId(updated[0]?.id || '');
  };

  return (
    <section className="space-y-4" aria-label="Document cover photos">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Document photos</h2>
          <p className="text-xs text-slate-500">The first photo is used as the cover image.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {photos.length}/{MAX_DOCUMENT_PHOTOS}
        </span>
      </div>

      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
        {selectedPhoto ? (
          <img src={selectedPhoto.url} alt={selectedPhoto.fileName || 'Document cover preview'} className="h-full w-full object-contain" />
        ) : (
          <div className="p-6 text-center text-slate-400">
            <ImagePlus className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm font-medium">Your captured photos will appear here</p>
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setSelectedPhotoId(photo.id)}
                aria-label={`Preview photo ${index + 1}${index === 0 ? ', cover photo' : ''}`}
                aria-pressed={selectedPhoto?.id === photo.id}
                className={`aspect-square w-full overflow-hidden rounded-xl border-2 ${selectedPhoto?.id === photo.id ? 'border-indigo-500' : 'border-transparent'}`}
              >
                <img src={photo.url} alt={photo.fileName || `Document photo ${index + 1}`} className="h-full w-full object-cover" />
              </button>
              {index === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">COVER</span>
              ) : (
                <button type="button" onClick={() => setAsCover(photo.id)} title="Set as cover photo" aria-label={`Set photo ${index + 1} as cover`} className="absolute left-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:text-indigo-600">
                  <Star className="h-3 w-3" />
                </button>
              )}
              <button type="button" onClick={() => removePhoto(photo.id)} title="Remove photo" aria-label={`Remove photo ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow hover:bg-rose-50">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={disabled || remainingSlots <= 0 || isProcessing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Camera className="h-4 w-4" /> Take photo
        </button>
        <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={disabled || remainingSlots <= 0 || isProcessing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <ImagePlus className="h-4 w-4" /> Choose images
        </button>
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={event => void handleFiles(event.target.files)} className="hidden" />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={event => void handleFiles(event.target.files)} className="hidden" />

      {isProcessing && <p role="status" className="text-xs font-medium text-indigo-600">Preparing images...</p>}
      {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
      {remainingSlots === 0 && <p className="text-xs text-slate-500">Maximum of five photos reached.</p>}
    </section>
  );
};
