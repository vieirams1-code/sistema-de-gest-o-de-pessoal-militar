import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Users,
  Menu,
  X,
  Home,
  Shield,
  ChevronRight,
  ChevronDown,
  FileText,
  LogOut,
  Settings,
  HeartPulse,
  CalendarDays,
  BookOpen,
  ClipboardList,
  ScrollText,
  Medal,
  Sword,
  FilePenLine,
  Briefcase,
  FolderKanban,
  Wrench,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';

const menuGroups = [
  {
    title: 'Principal',
    items: [
      { name: 'Dashboard', page: 'Home', icon: Home },
    ],
  },
  {
    title: 'Pessoal',
    items: [
      { name: 'Efetivo', page: 'Militares', icon: Users },
      { name: 'Alterações Militar', page: 'FichaMilitar', icon: FilePenLine },
      { name: 'Contratos Conv./Design.', page: 'Contratos', icon: Briefcase },
    ],
  },
  {
    title: 'Saúde',
    items: [
      { name: 'Atestados', page: 'DashboardAtestados', icon: HeartPulse },
      { name: 'Férias', page: 'Ferias', icon: CalendarDays },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { name: 'Livro', page: 'CadastrarRegistroLivro', icon: BookOpen },
      { name: 'Publicação Ex Officio', page: 'CadastrarPublicacao', icon: FileText },
      { name: 'Controle de Publicações', page: 'Publicacoes', icon: Shield },
      {
        name: 'Demandas & Tarefas',
        page: 'ProcessosTarefas',
        icon: FolderKanban,
        children: [
          { name: 'Painel Geral', page: 'ProcessosTarefas', icon: FolderKanban },
          { name: 'Caixa de Entrada', page: 'InboxDemandas', icon: FileText },
          { name: 'Fila de Trabalho', page: 'FilaDemandas', icon: ScrollText },
        ],
      },
    ],
  },
  {
    title: 'Patrimônio e Reconhecimento',
    items: [
      { name: 'Armamentos', page: 'Armamentos', icon: Sword },
      { name: 'Medalhas', page: 'Medalhas', icon: Medal },
    ],
  },
  {
    title: 'Administração',
    items: [
      { name: 'Templates de Texto', page: 'TemplatesTexto', icon: ClipboardList },
      {
        name: 'Configurações',
        page: 'Configuracoes',
        icon: Settings,
        children: [
          { name: 'Permissões e Usuários', page: 'Configuracoes', icon: Users, tab: 'permissoes' },
          { name: 'Adições e Personalizações', page: 'Configuracoes', icon: Wrench, tab: 'adicoes' },
          { name: 'Estrutura Organizacional', page: 'Subgrupamentos', icon: ScrollText },
          { name: 'Solicitações de Atualização', page: 'SolicitacoesAtualizacao', icon: FileText },
        ],
      },
    ],
  },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState(['Configurações']);

  const toggleExpanded = (itemName) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((x) => x !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (item) => {
    if (item.children?.length) {
      return item.page === currentPageName || item.children.some((c) => c.page === currentPageName);
    }
    return item.page === currentPageName;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#173764] text-white z-40 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-2xl border border-white/20 p-2 bg-white/5">
            <Shield className="w-6 h-6 text-blue-300" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-lg block leading-tight">SGP Militar</span>
            <span className="text-[10px] text-white/60 uppercase tracking-wide">
              Sistema de Gestão
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:bg-white/10"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </header>

      {/* Overlay Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-72 bg-[#173764] text-white z-50
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Topo */}
        <div className="border-b border-white/10 px-5 py-5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-2xl border border-white/20 p-2 bg-white/5 shrink-0">
                <Shield className="w-6 h-6 text-blue-300" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-lg block leading-tight">SGP Militar</span>
                <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                  Sistema de Gestão de Pessoal
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white hover:bg-white/10 shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Menu rolável */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 custom-scrollbar">
          <div className="space-y-6">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                  {group.title}
                </p>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const hasChildren = item.children && item.children.length > 0;
                    const active = isItemActive(item);
                    const expanded = expandedItems.includes(item.name);
                    const Icon = item.icon;

                    if (hasChildren) {
                      return (
                        <div key={item.name}>
                          <button
                            onClick={() => toggleExpanded(item.name)}
                            className={`
                              flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition-all
                              ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}
                            `}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-300' : ''}`} />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {expanded ? (
                              <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 opacity-60 shrink-0" />
                            )}
                          </button>

                          {expanded && (
                            <div className="mt-1 ml-5 pl-5 border-l border-white/10 space-y-1">
                              {item.children.map((child) => {
                                const childActive = currentPageName === child.page && !child.tab;
                                const href = child.tab
                                  ? `${createPageUrl(child.page)}?tab=${child.tab}`
                                  : createPageUrl(child.page);
                                const ChildIcon = child.icon;

                                return (
                                  <Link
                                    key={child.name}
                                    to={href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`
                                      flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all
                                      ${childActive
                                        ? 'bg-white/12 text-white'
                                        : 'text-white/55 hover:bg-white/8 hover:text-white'}
                                    `}
                                  >
                                    <ChildIcon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{child.name}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.page)}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all
                          ${active
                            ? 'bg-white/15 text-white shadow-inner'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'}
                        `}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-300' : 'group-hover:text-blue-300'}`} />
                        <span className="truncate flex-1">{item.name}</span>
                        {active && <ChevronRight className="w-4 h-4 shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Rodapé no fluxo normal */}
        <div className="border-t border-white/10 p-4 shrink-0 bg-black/10">
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-300 transition-all hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sair do Sistema</span>
          </button>

          <div className="mt-3 rounded-xl bg-white/10 p-3">
            <p className="text-xs text-white/60 text-center">
              Sistema de Gerenciamento de Pessoal
            </p>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="lg:pl-72 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.22);
        }
      `}</style>
    </div>
  );
}