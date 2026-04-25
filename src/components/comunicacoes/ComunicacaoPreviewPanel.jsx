import React from "react";
import {
  Archive,
  Inbox,
  Paperclip,
  ShieldCheck,
  Tag,
} from "lucide-react";
import {
  EMPTY_PREVIEW_DESCRIPTION,
  EMPTY_PREVIEW_TITLE,
} from "../../utils/comunicacoes/comunicacoes.constants";
import {
  formatPrioridadeLabel,
  formatStatusLabel,
  formatTipoLabel,
} from "../../utils/comunicacoes/comunicacoes.helpers";

function Badge({ children, variant = "default" }) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    green: "bg-emerald-100 text-emerald-800",
    dark: "bg-slate-900 text-white",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 px-8">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
        <Inbox size={40} className="text-slate-300" />
      </div>

      <div className="text-center max-w-md">
        <p className="font-bold text-slate-500">{EMPTY_PREVIEW_TITLE}</p>
        <p className="text-xs mt-1">{EMPTY_PREVIEW_DESCRIPTION}</p>
      </div>
    </div>
  );
}

export default function ComunicacaoPreviewPanel({ item }) {
  if (!item) {
    return <EmptyState />;
  }

  return (
    <section className="flex-1 bg-white overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Badge variant="dark">{formatTipoLabel(item.tipo)}</Badge>
              <span className="text-sm font-mono text-slate-400">
                ID: {item.protocolo}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {item.assunto}
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex flex-col items-center p-2 rounded-lg text-slate-400 cursor-not-allowed"
            >
              <Paperclip size={20} />
              <span className="text-[10px] mt-1 font-bold">Anexos</span>
            </button>

            <button
              type="button"
              disabled
              className="flex flex-col items-center p-2 rounded-lg text-slate-400 cursor-not-allowed"
            >
              <Archive size={20} />
              <span className="text-[10px] mt-1 font-bold">Arquivar</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8 border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
          <div className="md:border-r border-slate-200 md:pr-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Origem
            </p>
            <p className="text-sm font-bold text-slate-700">{item.origem}</p>
          </div>

          <div className="md:border-r border-slate-200 md:px-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Prioridade
            </p>
            <p className="text-sm font-bold text-slate-700">
              {formatPrioridadeLabel(item.prioridade)}
            </p>
          </div>

          <div className="md:pl-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Status
            </p>
            <Badge variant="green">{formatStatusLabel(item.status)}</Badge>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(item.tags || []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold"
            >
              <Tag size={12} />
              {tag}
            </span>
          ))}
        </div>

        <article className="mb-10 text-slate-700 leading-relaxed space-y-4">
          <p className="font-bold border-b border-slate-100 pb-2">
            Conteúdo da Comunicação
          </p>

          {(item.conteudo || []).map((paragraph, index) => (
            <p key={`${item.id}-paragraph-${index}`}>{paragraph}</p>
          ))}
        </article>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={18} className="text-slate-600" />
            <p className="text-sm font-bold text-slate-800">Escopo deste lote</p>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Esta prévia entrega apenas o casco isolado do módulo: caixas, filtros,
            listagem e visualização da comunicação. Despachos, ordens setoriais,
            encaminhamentos funcionais e integrações externas ficam para os próximos lotes.
          </p>
        </div>
      </div>
    </section>
  );
}
