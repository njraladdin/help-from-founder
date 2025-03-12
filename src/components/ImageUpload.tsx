import { useState, useRef, ChangeEvent } from 'react';

interface ImageUploadProps {
  onFileSelected: (file: File) => void;
  currentImageUrl?: string;
}

const ImageUpload = ({ onFileSelected, currentImageUrl }: ImageUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size should be less than 2MB');
      return;
    }

    setError(null);

    // Create a preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Notify parent component about the selected file
    onFileSelected(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <div 
        className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleButtonClick}
      >
        {previewUrl ? (
          <div className="flex flex-col items-center">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-32 h-32 object-cover rounded-md mb-2" 
            />
            <span className="text-sm text-gray-500">Click to change image</span>
          </div>
        ) : (
          <div className="py-4">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400" 
              stroke="currentColor" 
              fill="none" 
              viewBox="0 0 48 48" 
              aria-hidden="true"
            >
              <path 
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                strokeWidth={2} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
            <p className="mt-1 text-sm text-gray-500">
              Click to upload a logo image
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PNG, JPG, GIF up to 2MB
            </p>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      
      {error && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUpload; 