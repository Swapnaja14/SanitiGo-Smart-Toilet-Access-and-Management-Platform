import React, { useState } from 'react';
import { ImagePlus, UploadCloud, X, CheckCircle2, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import ownerApi from '../../api/owner.api';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function ImageUploadModal({ isOpen, onClose, toilet, onSaved }) {
  const { success, error: showErrorToast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showErrorToast('You can upload a maximum of 5 images per toilet facility.');
      return;
    }

    const validFiles = files.filter((f) => {
      const isImg = f.type.startsWith('image/');
      const isSizeOk = f.size <= 5 * 1024 * 1024; // 5MB
      if (!isImg) showErrorToast(`${f.name} is not a valid image file.`);
      if (!isSizeOk) showErrorToast(`${f.name} exceeds 5MB limit.`);
      return isImg && isSizeOk;
    });

    const newFiles = [...selectedFiles, ...validFiles].slice(0, 5);
    setSelectedFiles(newFiles);

    // Create object URLs for previews
    const newPreviews = newFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      size: (file.size / 1024 / 1024).toFixed(2),
    }));
    setPreviews(newPreviews);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      showErrorToast('Please select at least one image to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('images', file);
      });

      const res = await ownerApi.uploadToiletImages(toilet.id, formData);
      success('Toilet facility photos uploaded successfully!');
      onSaved?.(res?.data || res);
      onClose();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  if (!toilet) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Facility Photos"
      subtitle={`Add high-resolution pictures for ${toilet.name}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleUpload} className="space-y-5">
        {/* Dropzone Area */}
        <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-teal-50/20">
          <UploadCloud className="w-10 h-10 text-teal-600 mb-2" />
          <span className="text-xs font-bold text-slate-800">
            Click to browse or drag and drop photos
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            PNG, JPG, WEBP up to 5MB each (Max 5 images)
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Selected Previews Grid */}
        {previews.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700">
              Ready to Upload ({previews.length}/5):
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {previews.map((item, index) => (
                <div
                  key={index}
                  className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-square group shadow-sm"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 to-transparent p-1.5 text-[9px] text-white truncate font-medium">
                    {item.size} MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Images Display */}
        {toilet.images && toilet.images.length > 0 && (
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-500">
              Currently Registered Photos ({toilet.images.length}):
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {toilet.images.map((img) => (
                <img
                  key={img.id}
                  src={img.imageUrl}
                  alt="Existing"
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isUploading}
            disabled={selectedFiles.length === 0}
            leftIcon={ImagePlus}
          >
            Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
