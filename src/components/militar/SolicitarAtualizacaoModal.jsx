import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Send } from 'lucide-react';

const CAMPOS_EDITAVEIS = [
  { chave: 'nome_completo', label: 'Nome Completo' },
  { chave: 'nome_guerra', label: 'Nome de Guerra' },
  { chave: 'cpf', label: 'CPF' },
  { chave: 'rg', label: 'RG' },
  { chave: 'telefone', label: 'Telefone' },
  { chave: 'email_particular', label: 'Email Particular' },
  { chave: 'email_funcional', label: 'Email Funcional' },
  { chave: 'data_nascimento', label: 'Data de Nascimento' },
  { chave: 'estado_civil', label: 'Estado Civil' },
  { chave: 'logradouro', label: 'Logradouro' },
  { chave: 'numero_endereco', label: 'Número' },
  { chave: 'bairro', label: 'Bairro' },
  { chave: 'cidade', label: 'Cidade' },
  { chave: 'uf', label: 'UF' },
  { chave: 'cep', label: 'CEP' },
  { chave: 'banco', label: 'Banco' },
  { chave: 'agencia', label: 'Agência' },
  { chave: 'conta', label: 'Conta' },
  { chave: 'cnh_numero', label: 'Número CNH' },
  { chave: 'cnh_categoria', label: 'Categoria CNH' },
  { chave: 'cnh_validade', label: 'Validade CNH' },
  { chave: 'religiao', label: 'Religião' },
  { chave: 'escolaridade', label: 'Escolaridade' },
  { chave: 'tipo_sanguineo', label: 'Tipo Sanguíneo' },
];

export default function SolicitarAtualizacaoModal({ militar, onClose, onSaved }) {
  const [campoSelecionado, setCampoSelecionado] = useState('');
  const [valorProposto, setValorProposto] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const campoAtual = CAMPOS_EDITAVEIS.find(c => c.chave === campoSelecionado);
  const valorAtual = campoAtual ? (militar[campoSelecionado] || '') : '';

  const handleSubmit = async () => {
    if (!campoSelecionado || !valorProposto) return;
    setSaving(true);
    await base44.entities.SolicitacaoAtualizacao.create({
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      militar_posto: militar.posto_graduacao,
      militar_matricula: militar.matricula_atual || militar.matricula || '',
      campo_chave: campoSelecionado,
      campo_label: campoAtual?.label || campoSelecionado,
      valor_atual: String(valorAtual),
      valor_proposto: valorProposto,
      justificativa,
      data_solicitacao: new Date().toISOString().split('T')[0],
      status: 'Pendente',
    });
    setSaving(false);
    setSucesso(true);
  };

  if (sucesso) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Solicitação enviada!</h2>
          <p className="text-slate-500 text-sm mb-6">Sua solicitação foi registrada e será analisada pelo responsável. Você será notificado quando houver uma decisão.</p>
          <Button onClick={onClose} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Solicitar Atualização de Dados</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
            A alteração <strong>não será aplicada automaticamente</strong>. Ela ficará pendente de aprovação pelo responsável.
          </div>

          <div>
            <Label className="text-sm font-medium">Campo a corrigir *</Label>
            <Select value={campoSelecionado} onValueChange={v => { setCampoSelecionado(v); setValorProposto(''); }}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o campo..." /></SelectTrigger>
              <SelectContent>
                {CAMPOS_EDITAVEIS.map(c => (
                  <SelectItem key={c.chave} value={c.chave}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campoSelecionado && (
            <>
              <div>
                <Label className="text-sm font-medium text-slate-500">Valor atual</Label>
                <div className="mt-1.5 px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-600 text-sm">
                  {String(valorAtual) || '(não preenchido)'}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Valor correto *</Label>
                <Input
                  value={valorProposto}
                  onChange={e => setValorProposto(e.target.value)}
                  placeholder={`Informe o valor correto para ${campoAtual?.label}`}
                  className="mt-1.5"
                />
              </div>
            </>
          )}

          <div>
            <Label className="text-sm font-medium">Justificativa / Observação</Label>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={3}
              className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              placeholder="Explique o motivo da correção..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={saving || !campoSelecionado || !valorProposto}
              onClick={handleSubmit}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {saving ? 'Enviando...' : <><Send className="w-4 h-4 mr-2" />Enviar Solicitação</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}