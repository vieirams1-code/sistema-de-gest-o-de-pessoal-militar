import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Inbox, FolderKanban } from 'lucide-react';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  listarCaixas, listarProcessos, filtrarCaixasDoUsuario, filtrarProcessosVisiveis,
  isGestorDaCaixa, criarProcesso, atualizarProcesso, arquivarProcesso, concluirProcesso,
  tramitarProcesso, criarCaixa, atualizarCaixa, registrarEvento,
} from '@/services/controleProcessosService';
import { classificarPrazo } from '@/utils/controle-processos/controleProcessosConfig';
import ProcessosFiltros from '@/components/controle-processos/ProcessosFiltros';
import ProcessoListItem from '@/components/controle-processos/ProcessoListItem';
import ProcessoFormModal from '@/components/controle-processos/ProcessoFormModal';
import TramitarModal from '@/components/controle-processos/TramitarModal';
import ProcessoDetalheModal from '@/components/controle-processos/ProcessoDetalheModal';
import PrazosPanel from '@/components/controle-processos/PrazosPanel';
import CaixasTab from '@/components/controle-processos/CaixasTab';
import CaixaFormModal from '@/components/controle-processos/CaixaFormModal';

const FILTROS_INICIAIS = {
  busca: '', caixa: '', status: '', tipo: '', prioridade: '', sistema: '', prazo: '', interessado: '', responsavel: '',
};

export default function ControleProcessos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userEmail, isAdmin, canAccessAction } = useCurrentUser();

  const podeCriar = canAccessAction('perm_criar_processo_controle');
  const podeEditar = canAccessAction('perm_editar_processo_controle');
  const podeTramitar = canAccessAction('perm_tramitar_processo_controle');
  const podeArquivar = canAccessAction('perm_arquivar_processo_controle');
  const podeGerenciarCaixas = canAccessAction('perm_gerenciar_caixas_processuais');
  const podeVerTodas = isAdmin || canAccessAction('perm_visualizar_todas_caixas_processuais');

  const [aba, setAba] = useState('minha-caixa');
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [modalProcesso, setModalProcesso] = useState({ open: false, processo: null });
  const [modalTramitar, setModalTramitar] = useState({ open: false, processo: null });
  const [modalDetalhe, setModalDetalhe] = useState({ open: false, processo: null });
  const [modalCaixa, setModalCaixa] = useState({ open: false, caixa: null });
  const [salvando, setSalvando] = useState(false);

  const { data: caixas = [] } = useQuery({ queryKey: ['caixas-processuais'], queryFn: listarCaixas });
  const { data: processosRaw = [], isLoading } = useQuery({ queryKey: ['processos-controle'], queryFn: listarProcessos });

  const caixasById = useMemo(() => Object.fromEntries(caixas.map((c) => [c.id, c])), [caixas]);
  const caixasDoUsuario = useMemo(() => filtrarCaixasDoUsuario(caixas, userEmail), [caixas, userEmail]);
  const caixasDoUsuarioIds = useMemo(() => new Set(caixasDoUsuario.map((c) => c.id)), [caixasDoUsuario]);

  const processosVisiveis = useMemo(
    () => filtrarProcessosVisiveis(processosRaw, { userEmail, podeVerTodas, caixasDoUsuario }),
    [processosRaw, userEmail, podeVerTodas, caixasDoUsuario]
  );

  const aplicarFiltros = (lista) => {
    const busca = filtros.busca.trim().toLowerCase();
    return (lista || []).filter((p) => {
      if (busca) {
        const alvo = `${p.titulo || ''} ${p.nup || ''} ${p.assunto || ''} ${p.numero_documento || ''}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (filtros.caixa && p.caixa_atual_id !== filtros.caixa) return false;
      if (filtros.status && p.status !== filtros.status) return false;
      if (filtros.tipo && p.tipo_interno !== filtros.tipo) return false;
      if (filtros.prioridade && p.prioridade !== filtros.prioridade) return false;
      if (filtros.sistema && p.sistema_origem !== filtros.sistema) return false;
      if (filtros.responsavel && !(p.responsavel_id || '').toLowerCase().includes(filtros.responsavel.toLowerCase())) return false;
      if (filtros.interessado && !(p.interessados_ids || []).includes(filtros.interessado.trim())) return false;
      if (filtros.prazo) {
        const cls = classificarPrazo(p.prazo);
        if (filtros.prazo === 'atrasado' && cls !== 'atrasado') return false;
        if (filtros.prazo === 'hoje' && cls !== 'hoje') return false;
        if (filtros.prazo === 'proximo' && !['hoje', 'proximo'].includes(cls)) return false;
        if (filtros.prazo === 'sem_prazo' && cls !== 'sem_prazo') return false;
      }
      return true;
    });
  };

  const processosMinhaCaixa = useMemo(
    () => aplicarFiltros(processosVisiveis.filter((p) => !p.arquivado && caixasDoUsuarioIds.has(p.caixa_atual_id))),
    [processosVisiveis, caixasDoUsuarioIds, filtros]
  );
  const processosTodos = useMemo(
    () => aplicarFiltros(processosVisiveis.filter((p) => !p.arquivado)),
    [processosVisiveis, filtros]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['processos-controle'] });
  };

  // Determina se o usuário pode agir (gestor da caixa atual ou admin/permissão ampla).
  const podeAgirNoProcesso = (processo) => {
    if (!processo) return false;
    if (podeVerTodas) return true;
    const caixa = caixasById[processo?.caixa_atual_id];
    return isGestorDaCaixa(caixa, userEmail) || processo?.responsavel_id === userEmail;
  };

  const handleSalvarProcesso = async (dados) => {
    setSalvando(true);
    try {
      if (modalProcesso.processo) {
        await atualizarProcesso(modalProcesso.processo.id, dados, userEmail, modalProcesso.processo);
      } else {
        await criarProcesso(dados, userEmail);
      }
      toast({ title: 'Processo salvo com sucesso.' });
      setModalProcesso({ open: false, processo: null });
      invalidate();
    } catch (e) {
      toast({ title: 'Erro ao salvar processo', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleTramitar = async (dados) => {
    setSalvando(true);
    try {
      await tramitarProcesso(modalTramitar.processo, dados, userEmail);
      toast({ title: 'Processo tramitado.' });
      setModalTramitar({ open: false, processo: null });
      setModalDetalhe({ open: false, processo: null });
      invalidate();
    } catch (e) {
      toast({ title: 'Erro ao tramitar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleArquivar = async (processo) => {
    try {
      await arquivarProcesso(processo.id, userEmail);
      toast({ title: 'Processo arquivado.' });
      setModalDetalhe({ open: false, processo: null });
      invalidate();
    } catch (e) {
      toast({ title: 'Erro ao arquivar', description: e.message, variant: 'destructive' });
    }
  };

  const handleConcluir = async (processo) => {
    try {
      await concluirProcesso(processo.id, userEmail);
      toast({ title: 'Processo concluído.' });
      invalidate();
    } catch (e) {
      toast({ title: 'Erro ao concluir', description: e.message, variant: 'destructive' });
    }
  };

  const handleDespacho = async (processo, texto) => {
    try {
      await registrarEvento(processo.id, {
        tipo_evento: 'despacho',
        descricao: texto,
        usuario_id: userEmail,
      });
      toast({ title: 'Despacho registrado.' });
    } catch (e) {
      toast({ title: 'Erro ao registrar despacho', description: e.message, variant: 'destructive' });
    }
  };

  const handleSalvarCaixa = async (dados) => {
    setSalvando(true);
    try {
      if (modalCaixa.caixa) {
        await atualizarCaixa(modalCaixa.caixa.id, dados);
      } else {
        await criarCaixa(dados, userEmail);
      }
      toast({ title: 'Caixa salva.' });
      setModalCaixa({ open: false, caixa: null });
      queryClient.invalidateQueries({ queryKey: ['caixas-processuais'] });
    } catch (e) {
      toast({ title: 'Erro ao salvar caixa', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const renderLista = (lista, vazioMsg) => {
    if (isLoading) return <p className="text-sm text-slate-500 py-8 text-center">Carregando...</p>;
    const itens = lista || [];
    if (itens.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">{vazioMsg}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {itens.map((p) => {
          const agir = podeAgirNoProcesso(p);
          return (
            <ProcessoListItem
              key={p.id}
              processo={p}
              caixaNome={caixasById[p.caixa_atual_id]?.nome}
              podeEditar={Boolean(podeEditar && agir)}
              podeTramitar={Boolean(podeTramitar && agir)}
              podeArquivar={Boolean(podeArquivar && agir)}
              onVer={() => setModalDetalhe({ open: true, processo: p })}
              onTramitar={() => setModalTramitar({ open: true, processo: p })}
              onEditar={() => setModalProcesso({ open: true, processo: p })}
              onArquivar={() => handleArquivar(p)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5"><FolderKanban className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Controle de Processos e Procedimentos</h1>
            <p className="text-sm text-slate-500">Tramitação, prazos e identificação de processos por caixas administrativas.</p>
          </div>
        </div>
        {podeCriar && (
          <Button onClick={() => setModalProcesso({ open: true, processo: null })}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo processo
          </Button>
        )}
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="minha-caixa">Minha Caixa</TabsTrigger>
          <TabsTrigger value="todos">Todos os Processos</TabsTrigger>
          <TabsTrigger value="prazos">Prazos e Pendências</TabsTrigger>
          {podeGerenciarCaixas && <TabsTrigger value="caixas">Caixas Processuais</TabsTrigger>}
        </TabsList>

        <TabsContent value="minha-caixa" className="space-y-4 mt-4">
          <ProcessosFiltros filtros={filtros} setFiltros={setFiltros} caixas={caixasDoUsuario} onLimpar={() => setFiltros(FILTROS_INICIAIS)} />
          {renderLista(processosMinhaCaixa, 'Nenhum processo nas suas caixas.')}
        </TabsContent>

        <TabsContent value="todos" className="space-y-4 mt-4">
          <ProcessosFiltros filtros={filtros} setFiltros={setFiltros} caixas={podeVerTodas ? caixas : caixasDoUsuario} onLimpar={() => setFiltros(FILTROS_INICIAIS)} />
          {renderLista(processosTodos, 'Nenhum processo visível.')}
        </TabsContent>

        <TabsContent value="prazos" className="mt-4">
          <PrazosPanel processos={processosVisiveis} onVer={(p) => setModalDetalhe({ open: true, processo: p })} />
        </TabsContent>

        {podeGerenciarCaixas && (
          <TabsContent value="caixas" className="mt-4">
            <CaixasTab
              caixas={caixas}
              onNova={() => setModalCaixa({ open: true, caixa: null })}
              onEditar={(c) => setModalCaixa({ open: true, caixa: c })}
              salvando={salvando}
            />
          </TabsContent>
        )}
      </Tabs>

      <ProcessoFormModal
        open={modalProcesso.open}
        processo={modalProcesso.processo}
        caixas={podeVerTodas ? caixas : caixasDoUsuario}
        salvando={salvando}
        onClose={() => setModalProcesso({ open: false, processo: null })}
        onSubmit={handleSalvarProcesso}
      />

      <TramitarModal
        open={modalTramitar.open}
        processo={modalTramitar.processo}
        caixas={podeVerTodas ? caixas : caixasDoUsuario}
        salvando={salvando}
        onClose={() => setModalTramitar({ open: false, processo: null })}
        onSubmit={handleTramitar}
      />

      <ProcessoDetalheModal
        open={modalDetalhe.open}
        processo={modalDetalhe.processo}
        caixaNome={caixasById[modalDetalhe.processo?.caixa_atual_id]?.nome}
        caixasById={caixasById}
        podeTramitar={Boolean(podeTramitar && modalDetalhe.processo && podeAgirNoProcesso(modalDetalhe.processo))}
        podeEditar={Boolean(podeEditar && modalDetalhe.processo && podeAgirNoProcesso(modalDetalhe.processo))}
        podeArquivar={Boolean(podeArquivar && modalDetalhe.processo && podeAgirNoProcesso(modalDetalhe.processo))}
        onClose={() => setModalDetalhe({ open: false, processo: null })}
        onTramitar={(p) => setModalTramitar({ open: true, processo: p })}
        onConcluir={handleConcluir}
        onArquivar={handleArquivar}
        onDespacho={handleDespacho}
      />

      <CaixaFormModal
        open={modalCaixa.open}
        caixa={modalCaixa.caixa}
        salvando={salvando}
        onClose={() => setModalCaixa({ open: false, caixa: null })}
        onSubmit={handleSalvarCaixa}
      />
    </div>
  );
}
