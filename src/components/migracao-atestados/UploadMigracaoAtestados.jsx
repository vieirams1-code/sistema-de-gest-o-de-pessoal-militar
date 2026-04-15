import React from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UploadMigracaoAtestados({ file, onFileChange, onAnalisar, loading }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Upload da planilha legada</h2>
          <p className="text-sm text-slate-500">Envie um arquivo CSV ou Excel (.xlsx) com os dados dos atestados.</p>
        </div>
      </div>

      <input
        type="file"
        accept=".csv,.txt,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
      />

      <div className="flex items-center gap-2">
        <Button disabled={!file || loading} onClick={onAnalisar} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
          <Upload className="w-4 h-4 mr-2" />
          {loading ? 'Analisando...' : 'Analisar arquivo'}
        </Button>
        {file && <span className="text-sm text-slate-500">Arquivo: {file.name}</span>}
      </div>
    </div>
  );
}
