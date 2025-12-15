import React, { useState } from 'react';
import { Camera, Upload, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";

export default function PhotoUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange('foto', file_url);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="w-32 h-40 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
          {value ? (
            <img src={value} alt="Foto do militar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-slate-300" />
          )}
        </div>
        <label
          htmlFor="photo-upload"
          className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white flex items-center justify-center cursor-pointer shadow-lg transition-colors"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </label>
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      <span className="text-xs text-slate-500">Foto 3x4</span>
    </div>
  );
}