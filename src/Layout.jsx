import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import {
  Users,
  Menu,
  X,
  Home,
  Shield,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  LogOut,
  HeartPulse,
  CalendarDays,
  ClipboardList,
  ScrollText,
  Medal,
  Sword,
  FolderKanban,
  CalendarClock,
  Wrench,
  ArrowLeftRight,
  Building2,
  GitBranch,
  BookMarked,
  FileSpreadsheet,
  FileSearch,
  FileUp,
  History,
  CircleAlert,
  UserCircle2,
  ListOrdered,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import useVerificacaoComportamentoDiaria from '@/hooks/useVerificacaoComportamentoDiaria';
import GlobalMilitarSearch from '@/components/militar/GlobalMilitarSearch';
import SgpThemeModeMount from '@/themes/sgpThemeModes/SgpThemeModeMount';
import SgpThemeProfileSelector from '@/themes/sgpThemeModes/SgpThemeProfileSelector';
import useSgpThemeMode from '@/themes/sgpThemeModes/useSgpThemeMode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
const menuGroups = [
  {
    title: 'Principal',
    items: [
      { name: 'Dashboard', page: 'Home', icon: Home, viewPermission: 'visualizar_militares' },
      { name: 'Central de Pendências', page: 'CentralPendencias', icon: CircleAlert, actionKey: 'visualizar_central_pendencias' },
    ],
  },
  {
    title: 'Pessoal',
    items: [
      {
        name: 'Efetivo',
        page: 'Militares',
        icon: Users,
        anyOf: [
          { type: 'module', key: 'militares' },
          { type: 'action', key: 'visualizar_militares' },
          { type: 'module', key: 'extracao_efetivo' },
          { type: 'action', key: 'visualizar_extracao_efetivo' },
        ],
        children: [
          {
            name: 'Consulta',
            page: 'Militares',
            icon: Users,
            moduleKey: 'militares',
            actionKey: 'visualizar_militares',
          },
          {
            name: 'Extração',
            page: 'ExtracaoEfetivo',
            icon: FileSearch,
            moduleKey: 'extracao_efetivo',
            actionKey: 'visualizar_extracao_efetivo',
          },
        ],
      },
      { name: 'Folha de Alterações', page: 'FolhaAlteracoes', icon: FileSpreadsheet, viewPermission: 'visualizar_folha_alteracoes' },
      { name: 'Registros do Militar', page: 'RegistrosMilitar', icon: ScrollText, viewPermission: 'visualizar_registros_militar' },
      { name: 'Procedimentos e Processos', page: 'ProcedimentosProcessos', icon: ClipboardList, actionKey: 'visualizar_procedimentos_processos' },
    ],
  },
  {
    title: 'Justiça e Disciplina',
    items: [
      { name: 'Controle de Comportamento', page: 'AvaliacaoComportamento', icon: ScrollText, viewPermission: 'visualizar_controle_comportamento' },
      { name: 'Lançamento de Punições', page: 'Punicoes', icon: Shield, viewPermission: 'visualizar_punicoes' },
      { name: 'Auditar Comportamento', page: 'AuditoriaComportamento', icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    title: 'Atestados',
    items: [
      { name: 'Atestados', page: 'Atestados', icon: HeartPulse, viewPermission: 'visualizar_atestados' },
      { name: 'Controle', page: 'ControleAtestadosTemporarios', icon: HeartPulse, viewPermission: 'visualizar_controle_atestados_temporarios' },
    ],
  },
  {
    title: 'Férias',
    items: [
      { name: 'Férias', page: 'Ferias', icon: CalendarDays, viewPermission: 'visualizar_ferias' },
      { name: 'Créditos Extraordinários', page: 'CreditosExtraordinariosFerias', icon: CalendarDays, viewPermission: 'visualizar_ferias' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { name: 'Quadro Operacional', page: 'QuadroOperacional', icon: FolderKanban, viewPermission: 'visualizar_quadro_operacional' },
      { name: 'Ações Operacionais', page: 'AgendaAcoesOperacionais', icon: CalendarClock, viewPermission: 'visualizar_quadro_operacional' },
    ],
  },
  {
    title: 'Publicações e RP',
    items: [
      { name: 'RP', page: 'RP', icon: BookMarked, viewPermission: 'visualizar_rp' },
      { name: 'Controle de Publicações', page: 'Publicacoes', icon: Shield, viewPermission: 'visualizar_controle_publicacoes' },
      { name: 'Conciliação com Boletim', page: 'ConciliacaoBoletim', icon: ArrowLeftRight, viewPermission: 'visualizar_conciliacao_boletim' },
    ],
  },
  {
    title: 'Antiguidade',
    items: [
      {
        name: 'Antiguidade',
        page: 'AntiguidadeDiagnostico',
        icon: ListOrdered,
        adminOnly: true,
        children: [
          { name: 'Diagnóstico', page: 'AntiguidadeDiagnostico', icon: ClipboardList, adminOnly: true },
          { name: 'Configuração de Quadros', page: 'AntiguidadeConfigQuadros', icon: ListOrdered, adminOnly: true, moduleKey: 'antiguidade' },
          { name: 'Importar Promoções', page: 'AntiguidadeImportarPromocoes', icon: ScrollText, adminOnly: true },
          { name: 'Prévia Geral', page: 'AntiguidadePrevia', icon: ListOrdered, adminOnly: true },
        ],
      },
    ],
  },


  {
    title: 'Patrimônio e Reconhecimento',
    items: [
      { name: 'Armamentos', page: 'Armamentos', icon: Sword, viewPermission: 'visualizar_armamentos' },
      { name: 'Medalhas', page: 'Medalhas', icon: Medal, viewPermission: 'visualizar_medalhas' },
    ],
  }
];


const adminMenuGroup = {
  title: 'ADMIN',
  items: [
    { name: 'Templates de Texto', page: 'TemplatesTexto', icon: ClipboardList, actionKey: 'gerir_templates' },
    {
      name: 'Adições e Personalizações',
      page: 'Configuracoes',
      icon: Wrench,
      tab: 'adicoes',
      anyOf: [{ type: 'module', key: 'adicoes_personalizacoes' }, { type: 'action', key: 'gerir_adicoes_personalizacoes' }],
    },
    {
      name: 'Permissões de Usuários',
      page: 'PermissoesUsuarios',
      icon: Users,
      anyOf: [{ type: 'module', key: 'permissoes_usuarios' }, { type: 'action', key: 'gerir_permissoes_usuarios' }],
    },
    {
      name: 'Perfis de Permissão',
      page: 'PerfisPermissao',
      icon: Shield,
      anyOf: [{ type: 'module', key: 'perfis_permissao' }, { type: 'action', key: 'gerir_perfis_permissao' }],
    },
    {
      name: 'Estrutura Organizacional',
      page: 'EstruturaOrganizacional',
      icon: GitBranch,
      viewPermission: 'visualizar_estrutura_organizacional',
    },
    {
      name: 'Lotação de Militares',
      page: 'LotacaoMilitares',
      icon: Building2,
      viewPermission: 'visualizar_lotacao_militares',
    },
    {
      name: 'Migração',
      page: 'MigracaoMilitares',
      icon: FileUp,
      anyOf: [
        { type: 'module', key: 'migracao_militares' },
        { type: 'module', key: 'migracao_alteracoes_legado' },
      ],
      children: [
        { name: 'Migração de Militares', page: 'MigracaoMilitares', icon: FileUp, moduleKey: 'migracao_militares', actionKey: 'visualizar_importacao_militares' },
        { name: 'Histórico de Importações', page: 'HistoricoImportacoesMilitares', icon: History, moduleKey: 'migracao_militares', actionKey: 'ver_historico_importacoes' },
        { name: 'Migração Alterações Legado', page: 'MigracaoAlteracoesLegado', icon: FileSpreadsheet, moduleKey: 'migracao_alteracoes_legado', actionKey: 'migrar_alteracoes_legado' },
      ],
    },
  ],
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState([]);
  const {
    isAdmin,
    canAccessModule,
    canAccessAction,
    permissions,
    canAccessAll,
    user,
    userEmail,
  } = useCurrentUser();
  const { themeMode, setThemeMode, isBombeiroMode } = useSgpThemeMode();
  const hasAbsoluteAccess = canAccessAll || permissions === 'ALL';
  const temPermissao = (actionKey) => canAccessAction(actionKey);
  useVerificacaoComportamentoDiaria({ enabled: canAccessModule('militares') || isAdmin });

  const toggleExpanded = (itemName) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((x) => x !== itemName)
        : [...prev, itemName]
    );
  };

  // Filtra itens de menu por permissão de módulo
  const canViewMenuEntry = (entry) => {
    if (entry.adminOnly && !isAdmin) return false;
    if (hasAbsoluteAccess) return true;

    if (entry.viewPermission && !temPermissao(entry.viewPermission)) return false;
    if (entry.actionKey && !canAccessAction(entry.actionKey)) return false;
    if (entry.moduleKey && !canAccessModule(entry.moduleKey)) return false;
    if (entry.anyOf?.length) {
      const hasAnyPermission = entry.anyOf.some((permission) => (
        permission.type === 'module'
          ? canAccessModule(permission.key)
          : canAccessAction(permission.key)
      ));
      if (!hasAnyPermission) return false;
    }

    return true;
  };

  const filterItemsByPermission = (items) => {
    return items.filter((item) => {
      return canViewMenuEntry(item);
    }).map((item) => {
      if (!item.children?.length) return item;

      const visibleChildren = item.children.filter((child) => canViewMenuEntry(child));
      
      return { ...item, children: visibleChildren };
    }).filter((item) => !item.children || item.children.length > 0);
  };

  const allGroups = [...menuGroups, adminMenuGroup];

  const visibleMenuGroups = allGroups.map((group) => ({
    ...group,
    items: filterItemsByPermission(group.items),
  })).filter((group) => group.items.length > 0);

  const isItemActive = (item) => {
    if (item.children?.length) {
      return item.page === currentPageName || item.children.some((c) => c.page === currentPageName);
    }
    return item.page === currentPageName;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SgpThemeModeMount isBombeiroMode={isBombeiroMode} />
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
            {visibleMenuGroups.map((group) => (
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
                                const baseHref = child.path || createPageUrl(child.page);
                                const href = child.tab
                                  ? `${baseHref}?tab=${child.tab}`
                                  : baseHref;
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
                        to={item.tab ? `${item.path || createPageUrl(item.page)}?tab=${item.tab}` : (item.path || createPageUrl(item.page))}
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
        <div className="sticky top-16 lg:top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <GlobalMilitarSearch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="ml-auto h-10 min-w-[170px] justify-between gap-2 border-slate-300 bg-white px-3"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <UserCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate text-sm">
                      {user?.full_name || userEmail || 'Perfil'}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="pb-0">
                  Minha conta
                </DropdownMenuLabel>
                <p className="px-2 pb-2 text-xs text-slate-500">
                  {userEmail || 'Usuário autenticado'}
                </p>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-slate-500">
                  Preferências
                </DropdownMenuLabel>
                <SgpThemeProfileSelector
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-red-600 focus:text-red-700">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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