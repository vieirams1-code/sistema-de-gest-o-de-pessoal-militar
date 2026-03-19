import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, AlertTriangle, FileText, Activity, Plus } from "lucide-react";
import * as base44 from "@/lib/base44";

const hojeISO = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { data: ferias = [] } = useQuery({
    queryKey: ["ferias"],
    queryFn: () => base44.entities.Ferias.list(),
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["registroLivro"],
    queryFn: () => base44.entities.RegistroLivro.list(),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards"],
    queryFn: () => base44.entities.CardOperacional.list(),
  });

  const prioridades = useMemo(() => {
    const iniciarHoje = ferias.filter(f => f.data_inicio === hojeISO);
    const retornoHoje = ferias.filter(f => f.data_fim === hojeISO);
    const interrompidas = ferias.filter(f => f.status === "interrompido");

    return {
      total: iniciarHoje.length + retornoHoje.length + interrompidas.length,
      iniciarHoje,
      retornoHoje,
      interrompidas,
    };
  }, [ferias]);

  const pendencias = useMemo(() => {
    const naoPublicados = registros.filter(r => !r.publicado);
    return {
      naoPublicados,
      total: naoPublicados.length,
    };
  }, [registros]);

  const feriasResumo = useMemo(() => {
    const emAndamento = ferias.filter(f => f.status === "em_andamento");
    const interrompidas = ferias.filter(f => f.status === "interrompido");

    return {
      emAndamento: emAndamento.length,
      interrompidas: interrompidas.length,
    };
  }, [ferias]);

  const quadroResumo = useMemo(() => {
    const abertas = cards.filter(c => c.status !== "concluido");
    const criticas = cards.filter(c => c.prioridade === "alta");

    return {
      abertas: abertas.length,
      criticas: criticas.length,
    };
  }, [cards]);

  return (
    <div className="p-6 space-y-6">

      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="text-red-600" />
          <h2 className="font-semibold text-red-700">Prioridades do Dia</h2>
        </div>

        {prioridades.total === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma ação crítica hoje</p>
        ) : (
          <ul className="text-sm space-y-1">
            <li>Inícios hoje: {prioridades.iniciarHoje.length}</li>
            <li>Retornos hoje: {prioridades.retornoHoje.length}</li>
            <li>Interrompidas: {prioridades.interrompidas.length}</li>
          </ul>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="text-yellow-600" />
          <h2 className="font-semibold text-yellow-700">Pendências</h2>
        </div>

        <p className="text-sm">
          Registros não publicados: <strong>{pendencias.total}</strong>
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="text-green-600" />
          <h2 className="font-semibold text-green-700">Férias</h2>
        </div>

        <p className="text-sm">Em andamento: {feriasResumo.emAndamento}</p>
        <p className="text-sm">Interrompidas: {feriasResumo.interrompidas}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="text-blue-600" />
          <h2 className="font-semibold text-blue-700">Quadro Operacional</h2>
        </div>

        <p className="text-sm">Abertas: {quadroResumo.abertas}</p>
        <p className="text-sm">Críticas: {quadroResumo.criticas}</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="text-gray-700" />
          <h2 className="font-semibold text-gray-800">Ações Rápidas</h2>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="px-3 py-2 bg-black text-white rounded-lg text-sm">
            Novo Registro
          </button>

          <button className="px-3 py-2 bg-black text-white rounded-lg text-sm">
            Nova Publicação
          </button>

          <button className="px-3 py-2 bg-black text-white rounded-lg text-sm">
            Nova Ação
          </button>
        </div>
      </div>

    </div>
  );
}
