import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function CidSelector({ cidValue, descricaoValue, onChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Busque informações sobre o CID-10: "${searchTerm}". 
        Se for um código (ex: A00, B01.1), retorne o código e sua descrição.
        Se for uma descrição de doença, retorne o código CID-10 correspondente e a descrição oficial.
        Retorne apenas um resultado, o mais relevante.`,
        response_json_schema: {
          type: "object",
          properties: {
            codigo: { type: "string", description: "Código CID-10" },
            descricao: { type: "string", description: "Descrição da doença/condição" }
          },
          required: ["codigo", "descricao"]
        }
      });

      if (response.codigo && response.descricao) {
        onChange('cid_10', response.codigo);
        onChange('cid_descricao', response.descricao);
        setSearchTerm('');
      }
    } catch (error) {
      console.error('Erro ao buscar CID:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-2 block">
          Buscar CID-10
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="Digite o código CID ou nome da doença..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-10 border-slate-200"
          />
          <Button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] px-6"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </>
            )}
          </Button>
        </div>
      </div>

      {(cidValue || descricaoValue) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {cidValue && (
                <p className="font-bold text-blue-900 mb-1">CID-10: {cidValue}</p>
              )}
              {descricaoValue && (
                <p className="text-sm text-blue-700">{descricaoValue}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cid_manual" className="text-sm font-medium text-slate-700">
            CID-10 (manual)
          </Label>
          <Input
            id="cid_manual"
            value={cidValue || ''}
            onChange={(e) => onChange('cid_10', e.target.value)}
            placeholder="Ex: A00, B01.1"
            className="h-10 border-slate-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cid_desc" className="text-sm font-medium text-slate-700">
            Descrição
          </Label>
          <Input
            id="cid_desc"
            value={descricaoValue || ''}
            onChange={(e) => onChange('cid_descricao', e.target.value)}
            placeholder="Descrição da condição"
            className="h-10 border-slate-200"
          />
        </div>
      </div>
    </div>
  );
}