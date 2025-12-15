import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileText, Save, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700 border-amber-200',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700 border-blue-200',
  'Publicado': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

export default function PublicacaoCard({ registro, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editData, setEditData] = useState({
    nota_para_bg: registro.nota_para_bg || '',
    numero_bg: registro.numero_bg || '',
    data_bg: registro.data_bg || '',
    status: registro.status || 'Aguardando Nota'
  });

  const handleSave = () => {
    // Determinar status automaticamente
    let novoStatus = 'Aguardando Nota';
    
    if (editData.numero_bg && editData.data_bg) {
      novoStatus = 'Publicado';
    } else if (editData.nota_para_bg) {
      novoStatus = 'Aguardando Publicação';
    }
    
    onUpdate(registro.id, { ...editData, status: novoStatus });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      nota_para_bg: registro.nota_para_bg || '',
      numero_bg: registro.numero_bg || '',
      data_bg: registro.data_bg || '',
      status: registro.status || 'Aguardando Nota'
    });
    setIsEditing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
  };

  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg text-slate-900">
                {registro.militar_posto && `${registro.militar_posto} `}
                {registro.militar_nome}
              </h3>
              <Badge className={statusColors[registro.status]}>
                {registro.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Mat: {registro.militar_matricula}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>{registro.tipo_registro}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(registro.data_registro)}</span>
              </div>
              {registro.numero_bg && (
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>BG Nº {registro.numero_bg}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 border-t border-slate-100">
          {isEditing ? (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium">Número da Nota para BG</Label>
                <Input
                  value={editData.nota_para_bg}
                  onChange={(e) => setEditData({...editData, nota_para_bg: e.target.value})}
                  className="mt-1.5"
                  placeholder="Ex: 001/2025"
                />
                <p className="text-xs text-slate-500 mt-1">Ao preencher, status mudará para "Aguardando Publicação"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Número do BG</Label>
                  <Input
                    value={editData.numero_bg}
                    onChange={(e) => setEditData({...editData, numero_bg: e.target.value})}
                    className="mt-1.5"
                    placeholder="Ex: 001/2025"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Data do BG</Label>
                  <Input
                    type="date"
                    value={editData.data_bg}
                    onChange={(e) => setEditData({...editData, data_bg: e.target.value})}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Ao preencher ambos, status mudará para "Publicado"</p>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {registro.texto_publicacao && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Texto para Publicação</Label>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
                    {registro.texto_publicacao}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-slate-500">Número da Nota</Label>
                  <p className="font-medium mt-1">{registro.nota_para_bg || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Número do BG</Label>
                  <p className="font-medium mt-1">{registro.numero_bg || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Data do BG</Label>
                  <p className="font-medium mt-1">{formatDate(registro.data_bg)}</p>
                </div>
              </div>

              {registro.observacoes && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Observações</Label>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
                    {registro.observacoes}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}