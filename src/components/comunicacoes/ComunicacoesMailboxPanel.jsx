import React from 'react';
import { Mailbox, Inbox, Archive, Star, EyeOff, Clock3 } from 'lucide-react';
import { mailboxOptions } from '@/utils/comunicacoes/comunicacoesFilters';

const secondaryBoxes = [
  { key: 'important', label: 'Importantes', icon: Star },
  { key: 'unread', label: 'Não lidas', icon: EyeOff },
  { key: 'archived', label: 'Arquivadas', icon: Archive },
  { key: 'awaitingDispatch', label: 'Aguardando despacho', icon: Clock3 },
];

export default function ComunicacoesMailboxPanel({ mailbox, setMailbox, comunicacoes }) {
  const counters = {
    important: comunicacoes.filter((item) => item.important).length,
    unread: comunicacoes.filter((item) => item.unread).length,
    archived: comunicacoes.filter((item) => item.archived).length,
    awaitingDispatch: comunicacoes.filter((item) => item.awaitingDispatch).length,
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Caixas</h2>
      <div className="space-y-2">
        {mailboxOptions.map((item) => {
          const active = mailbox === item.key;
          const Icon = item.key === 'pessoal' ? Mailbox : Inbox;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMailbox(item.key)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${active
                ? 'border-[#173764] bg-slate-50 text-[#173764]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Indicadores</h3>
        <div className="space-y-2">
          {secondaryBoxes.map((box) => {
            const Icon = box.icon;
            return (
              <div key={box.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <Icon className="h-4 w-4" />
                  {box.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {counters[box.key]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
