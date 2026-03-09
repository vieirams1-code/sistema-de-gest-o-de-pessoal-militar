import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, RotateCcw, Pencil, Archive, ClipboardCheck, ArrowDownLeft } from 'lucide-react';

const ActionBtn = ({ icon: Icon, label, color, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-40 text-left w-full ${color}`}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    <span className="leading-tight">{label}</span>
  </button>
);

export function BlocoDecisaoChefe({ onSalvar, salvando, onHistorico, etapa }) {
  const [texto, setTexto] = useState('');

  const executar = async (dadosDemanda, tipoHistorico, msgHistorico) => {
    const agora = new Date().toISOString();
    const base = { decisao_texto: texto, decisao_data: agora, data_ultima_decisao: agora };
    await onSalvar({ ...base, ...dadosDemanda });
    if (onHistorico) await onHistorico({ tipo_registro: 'Decisão', mensagem: msgHistorico + (texto ? `\n\n"${texto}"` : ''), etapa_no_momento: etapa });
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" /> Decisão do Chefe
      </p>
      <div>
        <p className="text-xs text-amber-700 mb-1.5">Registre a decisão antes de prosseguir:</p>
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={3}
          className="bg-white border-amber-200 text-sm"
          placeholder="Descreva a decisão tomada pelo chefe da seção..."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ActionBtn
          icon={RotateCcw}
          label="Aprovar e retornar p/ execução"
          color="border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ decisao_tipo: 'Aprovado', etapa_fluxo: 'Retornado para execução', data_ultimo_retorno: new Date().toISOString() }, 'Decisão', 'Decisão: Aprovado — demanda retornada para execução.')}
        />
        <ActionBtn
          icon={ArrowDownLeft}
          label="Solicitar ajuste"
          color="border-blue-300 text-blue-800 hover:bg-blue-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ decisao_tipo: 'Solicitar ajuste', etapa_fluxo: 'Retornado para execução', data_ultimo_retorno: new Date().toISOString() }, 'Decisão', 'Decisão: Solicitado ajuste — demanda retornada para execução.')}
        />
        <ActionBtn
          icon={Pencil}
          label="Encaminhar para assinatura"
          color="border-orange-300 text-orange-800 hover:bg-orange-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ decisao_tipo: 'Encaminhar para assinatura', etapa_fluxo: 'Aguardando assinatura do chefe', data_ultimo_encaminhamento: new Date().toISOString() }, 'Encaminhamento', 'Decisão: Encaminhado para assinatura do chefe.')}
        />
        <ActionBtn
          icon={CheckCircle2}
          label="Concluir demanda"
          color="border-teal-300 text-teal-800 hover:bg-teal-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ decisao_tipo: 'Concluir', etapa_fluxo: 'Concluído', status: 'Concluída', concluida_em: new Date().toISOString().split('T')[0] }, 'Decisão', 'Decisão: Demanda concluída.')}
        />
        <ActionBtn
          icon={Archive}
          label="Arquivar demanda"
          color="border-slate-300 text-slate-600 hover:bg-slate-50 bg-white sm:col-span-2"
          disabled={salvando}
          onClick={() => executar({ decisao_tipo: 'Arquivar', etapa_fluxo: 'Arquivado', status: 'Arquivada' }, 'Decisão', 'Decisão: Demanda arquivada.')}
        />
      </div>
    </div>
  );
}

export function BlocoAssinaturaChefe({ onSalvar, salvando, onHistorico, etapa }) {
  const [obs, setObs] = useState('');

  const executar = async (dadosDemanda, msgHistorico) => {
    const agora = new Date().toISOString();
    const base = { assinatura_observacao: obs, assinatura_data: agora };
    await onSalvar({ ...base, ...dadosDemanda });
    if (onHistorico) await onHistorico({ tipo_registro: 'Assinatura', mensagem: msgHistorico + (obs ? `\n\n"${obs}"` : ''), etapa_no_momento: etapa });
  };

  return (
    <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 space-y-3">
      <p className="text-xs font-bold text-orange-800 uppercase tracking-wide flex items-center gap-2">
        <Pencil className="w-4 h-4" /> Assinatura do Chefe
      </p>
      <div>
        <p className="text-xs text-orange-700 mb-1.5">Observações sobre a assinatura (opcional):</p>
        <Textarea
          value={obs}
          onChange={e => setObs(e.target.value)}
          rows={2}
          className="bg-white border-orange-200 text-sm"
          placeholder="Ex: assinado com ressalva, solicitou ajuste no parágrafo 2..."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ActionBtn
          icon={RotateCcw}
          label="Assinado — retornar p/ execução"
          color="border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ assinatura_status: 'Assinado', etapa_fluxo: 'Retornado para execução', data_ultimo_retorno: new Date().toISOString() }, 'Assinado — demanda retornada para execução.')}
        />
        <ActionBtn
          icon={ArrowDownLeft}
          label="Devolver para ajuste"
          color="border-blue-300 text-blue-800 hover:bg-blue-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ assinatura_status: 'Devolvido', etapa_fluxo: 'Retornado para execução', data_ultimo_retorno: new Date().toISOString() }, 'Devolvido para ajuste — demanda retornada para execução.')}
        />
        <ActionBtn
          icon={CheckCircle2}
          label="Concluir demanda"
          color="border-teal-300 text-teal-800 hover:bg-teal-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ assinatura_status: 'Assinado', etapa_fluxo: 'Concluído', status: 'Concluída', concluida_em: new Date().toISOString().split('T')[0] }, 'Assinado — demanda concluída.')}
        />
        <ActionBtn
          icon={Archive}
          label="Arquivar demanda"
          color="border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ assinatura_status: 'Devolvido', etapa_fluxo: 'Arquivado', status: 'Arquivada' }, 'Demanda arquivada.')}
        />
      </div>
    </div>
  );
}

export function BlocoRetornoComando({ onSalvar, salvando, onHistorico, etapa }) {
  const [texto, setTexto] = useState('');

  const executar = async (dadosDemanda, msgHistorico) => {
    const agora = new Date().toISOString();
    const base = { retorno_externo_texto: texto, retorno_externo_data: agora, retorno_externo_status: 'Recebido', data_ultimo_retorno: agora };
    await onSalvar({ ...base, ...dadosDemanda });
    if (onHistorico) await onHistorico({ tipo_registro: 'Retorno externo', mensagem: msgHistorico + (texto ? `\n\n"${texto}"` : ''), etapa_no_momento: etapa });
  };

  return (
    <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 space-y-3">
      <p className="text-xs font-bold text-rose-800 uppercase tracking-wide flex items-center gap-2">
        <ArrowDownLeft className="w-4 h-4" /> Retorno do Comando Superior
      </p>
      <div>
        <p className="text-xs text-rose-700 mb-1.5">Registre o retorno recebido:</p>
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={3}
          className="bg-white border-rose-200 text-sm"
          placeholder="Descreva o que foi comunicado pelo comando superior..."
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ActionBtn
          icon={RotateCcw}
          label="Retorno recebido — devolver p/ execução"
          color="border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white sm:col-span-2"
          disabled={salvando}
          onClick={() => executar({ etapa_fluxo: 'Retornado para execução' }, 'Retorno do comando superior recebido — demanda devolvida para execução.')}
        />
        <ActionBtn
          icon={CheckCircle2}
          label="Concluir demanda"
          color="border-teal-300 text-teal-800 hover:bg-teal-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ etapa_fluxo: 'Concluído', status: 'Concluída', concluida_em: new Date().toISOString().split('T')[0] }, 'Retorno recebido — demanda concluída.')}
        />
        <ActionBtn
          icon={Archive}
          label="Arquivar demanda"
          color="border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
          disabled={salvando}
          onClick={() => executar({ etapa_fluxo: 'Arquivado', status: 'Arquivada' }, 'Demanda arquivada.')}
        />
      </div>
    </div>
  );
}