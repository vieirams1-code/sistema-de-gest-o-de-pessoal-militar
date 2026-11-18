import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { listarProcedimentosEscopado } from '@/services/procedimentosEscopadoClient';
import ProcedimentoResumoCards from '@/components/procedimentos/ProcedimentoResumoCards';
import ProcedimentoFiltros from '@/components/procedimentos/ProcedimentoFiltros';
import ProcedimentoLinha from '@/components/procedimentos/ProcedimentoLinha';
import { TIPOS_RP_PROCEDIMENTO } from '@/components/procedimentos/procedimentoPublicacao';
import ProcedimentoPublicacaoModal from '@/components/procedimentos/ProcedimentoPublicacaoModal';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const detalheId = searchParams.get('procedimento_id');
  const abrirDetalhe = (id) => setSearchParams(id ? { procedimento_id: id } : {}, { replace: true });
  const [prorrogar, setProrrogar] = useState({ open: false, procedimento: null, gerarPublicacao: false });
  const [publicacao, setPublicacao] = useState(null);
  const abrirPublicacao = (procedimento, tipo, prazo) => setPublicacao({ procedimento, tipo, prazo });

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Procedimentos Administrativos</h1>
            <p className="text-slate-500">Cadastro, controle de prazos e publicações dos procedimentos.</p>
          </div>
          {podeCriar && (
            <Button className="self-start bg-[#1e3a5f] text-white hover:bg-[#2d4a6f]" onClick={abrirNovo}>
              <Plus className="mr-2 h-5 w-5" /> Novo procedimento
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
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                {['Procedimento', 'Encarregado', 'Investigado', 'Prazo final', 'Situação'].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((procedimento) => (
                <ProcedimentoLinha
                  key={procedimento.id}
                  procedimento={procedimento}
                  envolvidos={envolvidosPorProcedimento.get(procedimento.id) || []}
                  onOpen={() => abrirDetalhe(procedimento.id)}
                />
              ))}
            </tbody>
          </table>
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
        open={Boolean(detalheId)}
        onOpenChange={(open) => { if (!open) abrirDetalhe(null); }}
        procedimentoId={detalheId}
        onEdit={(procedimento, listaEnvolvidos) => {
          abrirDetalhe(null);
          setFormModal({ open: true, procedimento, envolvidos: listaEnvolvidos || [] });
        }}
        onPublicar={abrirPublicacao}
        onProrrogar={(procedimento, gerarPublicacao = false) => setProrrogar({ open: true, procedimento, gerarPublicacao })}
        onChanged={invalidar}
      />

      <ProrrogarPrazoModal
        open={prorrogar.open}
        onOpenChange={(open) => setProrrogar((prev) => ({ ...prev, open }))}
        procedimento={prorrogar.procedimento}
        gerarPublicacao={prorrogar.gerarPublicacao}
        onSaved={(prazo) => {
          invalidar();
          if (prorrogar.gerarPublicacao && prazo?.id) {
            abrirPublicacao(prorrogar.procedimento, TIPOS_RP_PROCEDIMENTO.prorrogacao, prazo);
          }
        }}
      />

      {publicacao && (
        <ProcedimentoPublicacaoModal
          {...publicacao}
          onClose={() => setPublicacao(null)}
          onSaved={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['procedimento-administrativo', publicacao.procedimento.id] }),
              queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
              queryClient.invalidateQueries({ queryKey: ['publicacoes-lista'] }),
              queryClient.invalidateQueries({ queryKey: ['registro-rp-lista'] }),
              queryClient.invalidateQueries({ queryKey: ['registros-militar-registros'] }),
            ]);
            setPublicacao(null);
          }}
        />
      )}
      </div>
    </div>
  );
}