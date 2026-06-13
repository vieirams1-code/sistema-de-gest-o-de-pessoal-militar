import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import * as cursoService from '@/services/cursoFormacaoService';
import CursosTab from '@/components/cursos-formacao/CursosTab';
import ParticipantesTab from '@/components/cursos-formacao/ParticipantesTab';
import AuditoriaTab from '@/components/cursos-formacao/AuditoriaTab';
import CursoFormacaoFormModal from '@/components/cursos-formacao/CursoFormacaoFormModal';
import AdicionarParticipanteModal from '@/components/cursos-formacao/AdicionarParticipanteModal';
import AlterarStatusModal from '@/components/cursos-formacao/AlterarStatusModal';

export default function CursosFormacao() {
  const { user, canAccessModule, canAccessAction } = useCurrentUser();
  const { toast } = useToast();

  const podeVer = canAccessModule('cursos_formacao') || canAccessAction('visualizar_cursos_formacao');
  const podeGerir = canAccessAction('gerir_cursos_formacao');

  const [tab, setTab] = useState('cursos');
  const [cursos, setCursos] = useState([]);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [cursoSelecionado, setCursoSelecionado] = useState(null);

  const [participantes, setParticipantes] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  const [auditoria, setAuditoria] = useState([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  const [modalCurso, setModalCurso] = useState(false);
  const [modalParticipante, setModalParticipante] = useState(false);
  const [modalStatus, setModalStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const erro = (e) => toast({ variant: 'destructive', title: 'Erro', description: e.message });

  const carregarCursos = useCallback(async () => {
    setLoadingCursos(true);
    try {
      setCursos(await cursoService.listarCursosFormacao());
    } catch (e) { erro(e); } finally { setLoadingCursos(false); }
  }, []);

  const carregarParticipantes = useCallback(async (cursoId) => {
    if (!cursoId) return;
    setLoadingParticipantes(true);
    try {
      setParticipantes(await cursoService.listarParticipantesCurso(cursoId));
    } catch (e) { erro(e); } finally { setLoadingParticipantes(false); }
  }, []);

  const carregarAuditoria = useCallback(async (cursoId) => {
    if (!cursoId) return;
    setLoadingAuditoria(true);
    try {
      setAuditoria(await cursoService.listarAuditoriaCurso(cursoId));
    } catch (e) { erro(e); } finally { setLoadingAuditoria(false); }
  }, []);

  useEffect(() => { if (podeVer) carregarCursos(); }, [podeVer, carregarCursos]);

  useEffect(() => {
    if (cursoSelecionado) {
      carregarParticipantes(cursoSelecionado.id);
      carregarAuditoria(cursoSelecionado.id);
    }
  }, [cursoSelecionado, carregarParticipantes, carregarAuditoria]);

  if (!podeVer) return <AccessDenied modulo="Cursos de Formação" />;

  const handleCriarCurso = async (form) => {
    setSaving(true);
    try {
      await cursoService.criarCursoFormacao(form, user);
      toast({ title: 'Curso criado com sucesso.' });
      setModalCurso(false);
      await carregarCursos();
    } catch (e) { erro(e); } finally { setSaving(false); }
  };

  const handleSelecionar = (curso) => {
    setCursoSelecionado(curso);
    setTab('participantes');
  };

  const handleCancelar = async (curso) => {
    if (!window.confirm(`Cancelar o curso "${curso.nome}"?`)) return;
    try {
      await cursoService.cancelarCursoFormacao(curso.id, 'Cancelamento manual', user);
      toast({ title: 'Curso cancelado.' });
      await carregarCursos();
    } catch (e) { erro(e); }
  };

  const handleEncerrar = async (curso) => {
    if (!window.confirm(`Encerrar o curso "${curso.nome}"?`)) return;
    try {
      await cursoService.encerrarCursoFormacao(curso.id, user);
      toast({ title: 'Curso encerrado.' });
      await carregarCursos();
    } catch (e) { erro(e); }
  };

  const handleAdicionarParticipantes = async (militares) => {
    setSaving(true);
    try {
      await cursoService.adicionarParticipantesCurso(cursoSelecionado.id, militares, user);
      toast({ title: 'Participantes adicionados.' });
      setModalParticipante(false);
      await carregarParticipantes(cursoSelecionado.id);
      await carregarAuditoria(cursoSelecionado.id);
    } catch (e) { erro(e); } finally { setSaving(false); }
  };

  const handleAlterarStatus = async (status, justificativa) => {
    setSaving(true);
    try {
      await cursoService.alterarStatusParticipanteCurso(modalStatus.id, status, justificativa, user);
      toast({ title: 'Status atualizado.' });
      setModalStatus(null);
      await carregarParticipantes(cursoSelecionado.id);
      await carregarAuditoria(cursoSelecionado.id);
    } catch (e) { erro(e); } finally { setSaving(false); }
  };

  const handleRemover = async (participante) => {
    if (!window.confirm(`Remover ${participante.nome_militar_snapshot} do curso?`)) return;
    try {
      await cursoService.removerParticipanteCurso(participante.id, user);
      toast({ title: 'Participante removido.' });
      await carregarParticipantes(cursoSelecionado.id);
      await carregarAuditoria(cursoSelecionado.id);
    } catch (e) { erro(e); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl bg-blue-100 p-2"><GraduationCap className="w-6 h-6 text-blue-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cursos de Formação</h1>
          <p className="text-sm text-slate-500">Gestão transitória de CFC/CFS — não altera o cadastro consolidado do militar.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="cursos" className="mt-4">
          <CursosTab
            cursos={cursos}
            loading={loadingCursos}
            podeGerir={podeGerir}
            onNovo={() => setModalCurso(true)}
            onSelecionar={handleSelecionar}
            onCancelar={handleCancelar}
            onEncerrar={handleEncerrar}
          />
        </TabsContent>

        <TabsContent value="participantes" className="mt-4">
          <ParticipantesTab
            curso={cursoSelecionado}
            participantes={participantes}
            loading={loadingParticipantes}
            podeGerir={podeGerir}
            onAdicionar={() => setModalParticipante(true)}
            onAlterarStatus={(p) => setModalStatus(p)}
            onRemover={handleRemover}
          />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaTab registros={auditoria} loading={loadingAuditoria} curso={cursoSelecionado} />
        </TabsContent>
      </Tabs>

      <CursoFormacaoFormModal open={modalCurso} onOpenChange={setModalCurso} onSubmit={handleCriarCurso} saving={saving} />
      <AdicionarParticipanteModal
        open={modalParticipante}
        onOpenChange={setModalParticipante}
        onConfirmar={handleAdicionarParticipantes}
        saving={saving}
        idsExistentes={participantes.map((p) => p.militar_id)}
      />
      <AlterarStatusModal
        open={!!modalStatus}
        onOpenChange={(v) => !v && setModalStatus(null)}
        participante={modalStatus}
        onConfirmar={handleAlterarStatus}
        saving={saving}
      />
    </div>
  );
}