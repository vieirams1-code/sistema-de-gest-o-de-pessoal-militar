import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { listarProcedimentosEscopado } from '@/services/procedimentosEscopadoClient';
import ProcedimentoResumoCards from '@/components/procedimentos/ProcedimentoResumoCards';
import ProcedimentoFiltros from '@/components/procedimentos/ProcedimentoFiltros';
import ProcedimentoCard from '@/components/procedimentos/ProcedimentoCard';
import ProcedimentoFormModal from '@/components/procedimentos/ProcedimentoFormModal';
import ProcedimentoDetalheModal from '@/components/procedimentos/ProcedimentoDetalheModal';
import ProrrogarPrazoModal from '@/components/procedimentos/ProrrogarPrazoModal';
import { classificarPrazo, STATUS_ENCERRADOS } from '@/components/procedimentos/procedimentoConfig';

const FILTROS_INICIAIS = {
  busca: '', tipo: '', status: '', situacao: '', encarregado_id: '', envolvido_id: '',
};

export default function Procedimentos() {
  const queryClient = useQueryClient();
  const { canAccessAction } = useCurrentUser();
  const podeCriar = canAccessAction('perm_criar_processo_controle');

  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [formModal, setFormModal] = useState({ open: false, procedimento: null, envolvidos: [] });
  const [detalhe, setDetalhe] = useState({ open: false, id: null });
  const [prorrogar, setProrrogar] = useState({ open: false, procedimento: null });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['procedimentos-administrativos'],
    queryFn: listarProcedimentosEscopado,
  });

  const procedimentos = data?.procedimentos || [];
  const envolvidos = data?.envolvidos || [];

  const envolvidosPorProcedimento = useMemo(() => {
    const mapa = new Map();
    envolvidos.forEach((e) => {
      const lista = mapa.get(e.procedimento_id) || [];
      lista.push(e);
      mapa.set(e.procedimento_id, lista);
    });
    return mapa;
  }, [envolvidos]);

  const encarregados = useMemo(() => {
    const mapa = new Map();
    procedimentos.forEach((p) => {
      if (p.encarregado_id && p.encarregado_nome) mapa.set(p.encarregado_id, p.encarregado_nome);
    });
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [procedimentos]);

  const investigados = useMemo(() => {
    const mapa = new Map();
    envolvidos.forEach((e) => {
      if (e.papel === 'Investigado' && e.militar_id) mapa.set(e.militar_id, e.nome || 'Militar');
    });
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [envolvidos]);

  const filtrados = useMemo(() => {
    const busca = filtros.busca.trim().toLowerCase();
    return procedimentos.filter((p) => {
      if (busca) {
        const alvo = [p.numero_procedimento, p.numero_portaria, p.objeto, p.encarregado_nome, p.autoridade_instauradora]
          .join(' ').toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (filtros.tipo && p.tipo_procedimento !== filtros.tipo) return false;
      if (filtros.status && p.status !== filtros.status) return false;
      if (filtros.situacao && classificarPrazo(p).chave !== filtros.situacao) return false;
      if (filtros.encarregado_id && p.encarregado_id !== filtros.encarregado_id) return false;
      if (filtros.envolvido_id) {
        const vinculos = envolvidosPorProcedimento.get(p.id) || [];
        if (!vinculos.some((e) => e.papel === 'Investigado' && e.militar_id === filtros.envolvido_id)) return false;
      }
      return true;
    });
  }, [procedimentos, envolvidosPorProcedimento, filtros]);

  const resumo = useMemo(() => {
    return filtrados.reduce((acc, p) => {
      const situacao = classificarPrazo(p);
      if (situacao.chave === 'vencido') acc.vencidos += 1;
      if (situacao.chave === 'vencendo') acc.vencendo += 1;
      if (p.status === 'Solucionado') acc.solucionados += 1;
      if (!STATUS_ENCERRADOS.includes(p.status)) acc.emAndamento += 1;
      return acc;
    }, { emAndamento: 0, vencidos: 0, vencendo: 0, solucionados: 0 });
  }, [filtrados]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['procedimentos-administrativos'] });
    queryClient.invalidateQueries({ queryKey: ['procedimento-administrativo'] });
  };

  const abrirNovo = () => setFormModal({ open: true, procedimento: null, envolvidos: [] });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#173764] p-2.5 text-white">
            <Gavel className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Procedimentos Administrativos</h1>
            <p className="text-sm text-slate-500">
              Cadastro de PAD, inquéritos técnicos e sindicâncias, com prazos, encarregados e envolvidos.
            </p>
          </div>
        </div>
        {podeCriar && (
          <Button onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" /> Novo procedimento
          </Button>
        )}
      </div>

      <ProcedimentoResumoCards resumo={resumo} />

      <ProcedimentoFiltros
        filtros={filtros}
        onChange={setFiltros}
        encarregados={encarregados}
        investigados={investigados}
      />

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando procedimentos...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center" role="alert">
          <p className="text-sm text-slate-700">Não foi possível carregar os procedimentos.</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Gavel className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            {procedimentos.length === 0 ? 'Nenhum procedimento cadastrado.' : 'Nenhum procedimento encontrado com esses filtros.'}
          </p>
          {procedimentos.length === 0 && podeCriar && (
            <Button variant="outline" className="mt-3" onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" /> Cadastrar o primeiro procedimento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => (
            <ProcedimentoCard
              key={p.id}
              procedimento={p}
              envolvidos={envolvidosPorProcedimento.get(p.id) || []}
              onOpen={(procedimento) => setDetalhe({ open: true, id: procedimento.id })}
            />
          ))}
        </div>
      )}

      <ProcedimentoFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal((prev) => ({ ...prev, open }))}
        procedimento={formModal.procedimento}
        envolvidos={formModal.envolvidos}
        onSaved={invalidar}
      />

      <ProcedimentoDetalheModal
        open={detalhe.open}
        onOpenChange={(open) => setDetalhe((prev) => ({ ...prev, open }))}
        procedimentoId={detalhe.id}
        onEdit={(procedimento, listaEnvolvidos) => {
          setDetalhe({ open: false, id: null });
          setFormModal({ open: true, procedimento, envolvidos: listaEnvolvidos || [] });
        }}
        onProrrogar={(procedimento) => setProrrogar({ open: true, procedimento })}
        onChanged={invalidar}
      />

      <ProrrogarPrazoModal
        open={prorrogar.open}
        onOpenChange={(open) => setProrrogar((prev) => ({ ...prev, open }))}
        procedimento={prorrogar.procedimento}
        onSaved={invalidar}
      />
    </div>
  );
}