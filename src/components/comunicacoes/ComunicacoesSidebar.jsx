import React from "react";
import {
  AlertCircle,
  Archive,
  Clock3,
  MailOpen,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { COMUNICACOES_MAILBOX_KEYS } from "../../utils/comunicacoes/comunicacoes.constants";

function SidebarItem({ icon, label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition group text-left ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={active ? "text-white" : "text-slate-400 group-hover:text-blue-400"}>
          {icon}
        </span>
        <span className="text-sm font-bold hidden lg:block tracking-tight truncate">
          {label}
        </span>
      </div>

      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg hidden lg:block ${
          active ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export default function ComunicacoesSidebar({
  mailbox,
  counters,
  onMailboxChange,
  currentUserName = "Usuário do Sistema",
  currentUserRole = "Comunicações Internas",
}) {
  return (
    <aside className="w-20 lg:w-72 bg-slate-900 flex flex-col border-r border-slate-800 shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <div className="hidden lg:block">
            <p className="font-bold text-white tracking-tight text-xl">SGP Militar</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">
              Comunicações
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <div className="pt-1 pb-2 px-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:block">
            Caixas
          </p>
        </div>

        <SidebarItem
          icon={<User size={18} />}
          label="Caixa pessoal"
          count={counters[COMUNICACOES_MAILBOX_KEYS.PESSOAL] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.PESSOAL}
          onClick={() => onMailboxChange(COMUNICACOES_MAILBOX_KEYS.PESSOAL)}
        />

        <SidebarItem
          icon={<Users size={18} />}
          label="Caixa setorial"
          count={counters[COMUNICACOES_MAILBOX_KEYS.SETORIAL] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.SETORIAL}
          onClick={() => onMailboxChange(COMUNICACOES_MAILBOX_KEYS.SETORIAL)}
        />

        <div className="pt-4 pb-2 px-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:block">
            Coleções
          </p>
        </div>

        <SidebarItem
          icon={<AlertCircle size={18} />}
          label="Importantes"
          count={counters[COMUNICACOES_MAILBOX_KEYS.IMPORTANTES] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.IMPORTANTES}
          onClick={() => onMailboxChange(COMUNICACOES_MAILBOX_KEYS.IMPORTANTES)}
        />

        <SidebarItem
          icon={<MailOpen size={18} />}
          label="Não lidas"
          count={counters[COMUNICACOES_MAILBOX_KEYS.NAO_LIDAS] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.NAO_LIDAS}
          onClick={() => onMailboxChange(COMUNICACOES_MAILBOX_KEYS.NAO_LIDAS)}
        />

        <SidebarItem
          icon={<Archive size={18} />}
          label="Arquivadas"
          count={counters[COMUNICACOES_MAILBOX_KEYS.ARQUIVADAS] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.ARQUIVADAS}
          onClick={() => onMailboxChange(COMUNICACOES_MAILBOX_KEYS.ARQUIVADAS)}
        />

        <SidebarItem
          icon={<Clock3 size={18} />}
          label="Aguardando despacho"
          count={counters[COMUNICACOES_MAILBOX_KEYS.AGUARDANDO_DESPACHO] || 0}
          active={mailbox === COMUNICACOES_MAILBOX_KEYS.AGUARDANDO_DESPACHO}
          onClick={() =>
            onMailboxChange(COMUNICACOES_MAILBOX_KEYS.AGUARDANDO_DESPACHO)
          }
        />

        <div className="pt-5 px-3 hidden lg:block">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Lote 1
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Casco isolado do módulo com caixas, filtros, lista e prévia da comunicação.
            </p>
          </div>
        </div>
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-emerald-500 overflow-hidden flex items-center justify-center text-white font-bold">
            CI
          </div>

          <div className="hidden lg:block overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{currentUserName}</p>
            <p className="text-xs text-slate-400 truncate">{currentUserRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
