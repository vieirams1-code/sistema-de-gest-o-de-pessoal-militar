import React from 'react';

export default function ComunicacaoPreview({ comunicacao }) {
  if (!comunicacao) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Selecione uma comunicação para visualizar os detalhes.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="border-b border-slate-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{comunicacao.protocolo}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{comunicacao.assunto}</h2>
      </header>

      <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <p><span className="font-semibold">Origem:</span> {comunicacao.origem}</p>
        <p><span className="font-semibold">Prioridade:</span> {comunicacao.prioridade}</p>
        <p><span className="font-semibold">Status:</span> {comunicacao.status}</p>
        <p><span className="font-semibold">Tipo:</span> {comunicacao.tipo}</p>
      </div>

      <article className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {comunicacao.conteudo || comunicacao.resumo}
      </article>

      <div className="mt-4 flex flex-wrap gap-2">
        {comunicacao.tags.map((tag) => (
          <span key={`${comunicacao.id}-${tag}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            #{tag}
          </span>
        ))}
      </div>
    </section>
  );
}
