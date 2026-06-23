import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  CalendarMinus2,
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
  Archive,
  FileUp,
  History,
  UserCircle2,
  ListOrdered,
  PanelLeftClose,
  Pin,
  Tags as TagsIcon,
  Stethoscope,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import useVerificacaoComportamentoDiaria from '@/hooks/useVerificacaoComportamentoDiaria';
import useQuickAccessPreferences from '@/hooks/useQuickAccessPreferences';
import { DEFAULT_WIDGET } from '@/services/quickAccessPreferencesService';
import GlobalMilitarSearch from '@/components/militar/GlobalMilitarSearch';
import ImpersonationBanner from '@/components/auth/ImpersonationBanner';
import { clearImpersonation } from '@/utils/impersonation';
import AlertasOperacionais from '@/components/quadro/AlertasOperacionais';
import QuickAccessWidget from '@/components/layout/QuickAccessWidget';
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
    title: 'GERAL',
    sections: [
      {
        title: 'Painel Inicial',
        description: 'Acesso rápido ao panorama operacional',
        items: [{ name: 'Dashboard', page: 'Home', icon: Home, viewPermission: 'visualizar_militares' }],
      },
    ],
  },
  {
    title: 'GESTÃO MILITAR',
    sections: [
      {
        title: 'Efetivo',
        icon: Users,
        description: 'Consulta e vínculos funcionais',
        items: [
          { name: 'Consulta Militar', page: 'Militares', icon: Users, moduleKey: 'militares', actionKey: 'visualizar_militares' },
          { name: 'Organograma', page: 'VisualizacaoGestorEfetivo', icon: GitBranch, moduleKey: 'militares', actionKey: 'visualizar_militares' },
          {
            name: 'Contratos Designados',
            page: 'ContratosDesignacao',
            icon: ClipboardList,
            anyOf: [
              { type: 'action', key: 'visualizar_contratos_designacao' },
              { type: 'action', key: 'gerir_contratos_designacao' },
            ],
          },
          { name: 'Gratificação de Função', page: 'GratificacoesFuncao', icon: Medal, viewPermission: 'visualizar_gratificacoes_funcao' },
          { name: 'Folha Alterações', page: 'FolhaAlteracoes', icon: FileSpreadsheet, moduleKey: 'folha_alteracoes', actionKey: 'perm_visualizar_folha_alteracoes' },
          { name: 'Registros Militar', page: 'RegistrosMilitar', icon: ScrollText, moduleKey: 'registros_militar', actionKey: 'perm_visualizar_registros_militar' },
          { name: 'Conferência Cadastral', page: 'ConferenciasMilitares', icon: ShieldCheck, moduleKey: 'acesso_conferencias_militares', actionKey: 'perm_visualizar_conferencias_militares' },
          { name: 'Armamentos', page: 'Armamentos', icon: Sword, moduleKey: 'armamentos', actionKey: 'perm_visualizar_armamentos' },
        ],
      },
      {
        title: 'Férias',
        icon: CalendarDays,
        description: 'Gestão de períodos e dias adicionais',
        items: [
          { name: 'Férias', page: 'Ferias', icon: CalendarDays, moduleKey: 'ferias', actionKey: 'visualizar_ferias' },
          { name: 'Dias Adicionais', page: 'CreditosExtraordinariosFerias', icon: CalendarDays, moduleKey: 'ferias', actionKey: 'visualizar_creditos_ferias' },
          { name: 'Descontos em Férias', page: 'DescontosFerias', icon: CalendarMinus2, adminOnly: true },
        ],
      },
      {
        title: 'Livro e Publicações',
        icon: BookMarked,
        description: 'Registros e conciliações administrativas',
        items: [
          { name: 'RP', page: 'RP', icon: BookMarked, moduleKey: 'rp', actionKey: 'visualizar_rp' },
          { name: 'Publicações', page: 'Publicacoes', icon: Shield, moduleKey: 'controle_publicacoes', actionKey: 'visualizar_controle_publicacoes' },
          { name: 'Conciliação', page: 'ConciliacaoBoletim', icon: ArrowLeftRight, moduleKey: 'conciliacao_boletim', actionKey: 'visualizar_conciliacao_boletim' },
          {
            name: 'Documentos Históricos',
            page: 'DashboardAcervo',
            icon: Archive,
            actionKey: 'visualizar_acervo_historico',
          },
        ],
      },
      {
        title: 'Saúde',
        icon: HeartPulse,
        description: 'Atestados e controle de vínculos temporários',
        items: [
          { name: 'Atestados', page: 'Atestados', icon: HeartPulse, moduleKey: 'atestados', actionKey: 'visualizar_atestados' },
          { name: 'Extrato de Atestados', page: 'ExtratoAtestadosMedicos', path: '/ExtratoAtestadosMedicos', icon: ScrollText, moduleKey: 'atestados', actionKey: 'visualizar_atestados' },
          { name: 'Cadastro de Médicos', page: 'Medicos', icon: Stethoscope, adminOnly: true, moduleKey: 'atestados' },
          { name: 'Atestados - T', page: 'ControleAtestadosTemporarios', icon: HeartPulse, moduleKey: 'controle_atestados_temporarios', actionKey: 'visualizar_controle_atestados_temporarios' },
        ],
      },
      {
        title: 'Carreira',
        icon: Medal,
        description: 'Progressão e reconhecimento funcional',
        items: [
          { name: 'Promoções', page: 'Promocoes', icon: ListOrdered, moduleKey: 'antiguidade', actionKey: 'visualizar_rastreamento_promocoes' },
          {
            name: 'Antiguidade',
            page: 'AntiguidadePrevia',
            icon: ListOrdered,
            moduleKey: 'antiguidade',
            actionKey: 'visualizar_rastreamento_promocoes',
            anyOf: [
              { type: 'module', key: 'antiguidade' },
              { type: 'action', key: 'visualizar_rastreamento_promocoes' },
            ],
          },
          { name: 'Medalhas', page: 'Medalhas', icon: Medal, moduleKey: 'medalhas', actionKey: 'visualizar_medalhas' },
          { name: 'Cursos de Formação', page: 'CursosFormacao', icon: GraduationCap, moduleKey: 'cursos_formacao', actionKey: 'visualizar_cursos_formacao' },
          { name: 'Configuração de Quadros', page: 'AntiguidadeConfigQuadros', icon: ListOrdered, adminOnly: true, moduleKey: 'antiguidade' },
        ],
      },
      {
        title: 'Disciplina',
        icon: Shield,
        description: 'Conduta e comportamento funcional',
        items: [
          { name: 'Comportamento', page: 'AvaliacaoComportamento', icon: ScrollText, moduleKey: 'controle_comportamento', actionKey: 'visualizar_controle_comportamento' },
          { name: 'Punições', page: 'Punicoes', icon: Shield, moduleKey: 'punicoes', actionKey: 'visualizar_punicoes' },
          { name: 'Auditar Comportamento', page: 'AuditoriaComportamento', icon: ShieldCheck, adminOnly: true },
        ],
      },
      {
        title: 'Trello',
        icon: FolderKanban,
        description: 'Emprego operacional e controle de recursos',
        items: [
          { name: 'Quadros', page: 'QuadroOperacional', icon: FolderKanban, moduleKey: 'quadro_operacional', actionKey: 'visualizar_quadro_operacional' },
          { name: 'Tarefas', page: 'AgendaAcoesOperacionais', icon: CalendarClock, moduleKey: 'quadro_operacional', actionKey: 'visualizar_quadro_operacional' },
        ],
      },
    ],
  },
  {
    title: 'SISTEMA',
    sections: [
      {
        title: 'Administração do Sistema',
        icon: Wrench,
        description: 'Governança técnica, segurança e manutenção',
        items: [
          { name: 'Tags', page: 'Tags', icon: TagsIcon, moduleKey: 'efetivo', actionKey: 'gerir_configuracoes', menuGroup: 'Cadastros' },
          { name: 'Templates', page: 'TemplatesTexto', icon: ClipboardList, actionKey: 'gerir_templates', menuGroup: 'Cadastros' },
          { name: 'Subtipos DOEMS', page: 'SubtiposDOEMS', icon: BookMarked, adminOnly: true, moduleKey: 'rp', menuGroup: 'Cadastros' },
          {
            name: 'Funções',
            page: 'Funcoes',
            icon: ShieldCheck,
            anyOf: [{ type: 'module', key: 'adicoes_personalizacoes' }, { type: 'action', key: 'gerir_adicoes_personalizacoes' }],
            menuGroup: 'Cadastros',
          },
          {
            name: 'Permissões',
            page: 'PermissoesUsuarios',
            icon: Users,
            anyOf: [{ type: 'module', key: 'permissoes_usuarios' }, { type: 'action', key: 'gerir_permissoes_usuarios' }],
            menuGroup: 'Administração',
          },
          {
            name: 'Perfis de Permissão',
            page: 'PerfisPermissao',
            icon: Shield,
            anyOf: [{ type: 'module', key: 'perfis_permissao' }, { type: 'action', key: 'gerir_perfis_permissao' }],
            menuGroup: 'Administração',
          },
          { name: 'Estrutura', page: 'EstruturaOrganizacional', icon: GitBranch, moduleKey: 'estrutura_organizacional', actionKey: 'visualizar_estrutura_organizacional', menuGroup: 'Administração' },
          { name: 'Lotação', page: 'LotacaoMilitares', icon: Building2, moduleKey: 'lotacao_militares', actionKey: 'visualizar_lotacao_militares', menuGroup: 'Administração' },
          {
            name: 'Migração',
            page: 'MigracaoMilitares',
            icon: FileUp,
            anyOf: [
              { type: 'module', key: 'migracao_militares' },
              { type: 'module', key: 'migracao_alteracoes_legado' },
            ],
            children: [
              { name: 'Importar Dom Pedro II', page: 'ImportarMedalhaDomPedroII', icon: Medal, moduleKey: 'migracao_alteracoes_legado', menuGroup: 'Medalhas' },
              { name: 'Importar Medalhas Tempo Serviço', page: 'ImportarMedalhaTempoServico', icon: Medal, moduleKey: 'migracao_alteracoes_legado', menuGroup: 'Medalhas' },
              { name: 'Migração de Militares', page: 'MigracaoMilitares', icon: FileUp, moduleKey: 'migracao_militares', actionKey: 'visualizar_importacao_militares', menuGroup: 'Diversos' },
              { name: 'Histórico de Importações', page: 'HistoricoImportacoesMilitares', icon: History, moduleKey: 'migracao_militares', actionKey: 'ver_historico_importacoes', menuGroup: 'Diversos' },
              { name: 'Migração Alterações Legado', page: 'MigracaoAlteracoesLegado', icon: FileSpreadsheet, moduleKey: 'migracao_alteracoes_legado', actionKey: 'migrar_alteracoes_legado', menuGroup: 'Diversos' },
              { name: 'Classificação Pendentes Legado', page: 'ClassificacaoPendentesLegado', icon: Archive, moduleKey: 'migracao_alteracoes_legado', actionKey: 'classificar_legado', menuGroup: 'Diversos' },
              { name: 'Classificações Históricas', page: 'ClassificacoesHistoricasAlteracoes', icon: Archive, moduleKey: 'migracao_alteracoes_legado', actionKey: 'gerir_classificacoes_historicas', menuGroup: 'Diversos' },
            ],
          },
          {
            name: 'Configurações',
            page: 'Configuracoes',
            path: '/Configuracoes',
            icon: Wrench,
            tab: 'adicoes',
            anyOf: [{ type: 'module', key: 'adicoes_personalizacoes' }, { type: 'action', key: 'gerir_adicoes_personalizacoes' }],
          },
          { name: 'Backup do Sistema', page: 'BackupSistema', icon: Archive, adminOnly: true },
        ],
      },
    ],
  },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [expandedSection, setExpandedSection] = useState('');
  const [hoveredSection, setHoveredSection] = useState(null);
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
  const {
    pinnedItems,
    togglePin,
    widgetPreferences,
    updateWidgetPreferences,
  } = useQuickAccessPreferences(userEmail);
  const hasAbsoluteAccess = canAccessAll || permissions === 'ALL';
  const temPermissao = (actionKey) => canAccessAction(actionKey);
  useVerificacaoComportamentoDiaria({ enabled: canAccessModule('militares') || isAdmin });

  const toggleExpanded = (sectionTitle) => {
    setExpandedSection((prev) => (prev === sectionTitle ? '' : sectionTitle));
  };
  const [expandedMenuItems, setExpandedMenuItems] = useState({});

  const toggleMenuItem = (itemName) => {
    setExpandedMenuItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  const hoverCloseTimeoutRef = useRef(null);

  const clearHoverCloseTimeout = () => {
    if (hoverCloseTimeoutRef.current) {
      clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearHoverCloseTimeout();
    hoverCloseTimeoutRef.current = setTimeout(() => {
      setHoveredSection(null);
      hoverCloseTimeoutRef.current = null;
    }, 250);
  };

  const openSectionFlyout = (sectionTitle) => {
    clearHoverCloseTimeout();
    setHoveredSection(sectionTitle);
  };

  useEffect(() => () => {
    clearHoverCloseTimeout();
  }, []);

  const sidebarFlyoutOpen = compactSidebar && hoveredSection !== null;


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
    return items
      .filter((item) => canViewMenuEntry(item))
      .map((item) => {
        if (!item.children?.length) return item;
        const visibleChildren = item.children.filter((child) => canViewMenuEntry(child));
        return { ...item, children: visibleChildren };
      })
      .filter((item) => !item.children || item.children.length > 0);
  };

  const visibleMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({
          ...section,
          items: filterItemsByPermission(section.items),
        }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.sections.length > 0);


  const allVisibleItems = useMemo(() => visibleMenuGroups.flatMap((group) =>
    group.sections.flatMap((section) => section.items.flatMap((item) => [item, ...(item.children || [])]))
  ), [visibleMenuGroups]);

  const getPinKey = (item) => `${item.page}::${item.tab || ''}`;

  const pinnedVisibleItems = useMemo(() => {
    const visibleByKey = new Map(allVisibleItems.map((item) => [getPinKey(item), item]));
    return pinnedItems
      .map((pinnedItem) => visibleByKey.get(`${pinnedItem.page}::${pinnedItem.tab || ''}`))
      .filter(Boolean);
  }, [allVisibleItems, pinnedItems]);

  const isPinned = (item) => pinnedItems.some((pinnedItem) => pinnedItem.page === item.page && (pinnedItem.tab || null) === (item.tab || null));


  const isItemActive = (item) => {
    if (item.children?.length) {
      return item.page === currentPageName || item.children.some((c) => c.page === currentPageName);
    }
    return item.page === currentPageName;
  };

  const groupItemsByMenuGroup = (items) => items.reduce((groups, item) => {
    const lastGroup = groups[groups.length - 1];
    const groupLabel = item.menuGroup || null;

    if (lastGroup?.label === groupLabel) {
      lastGroup.items.push(item);
      return groups;
    }

    groups.push({ label: groupLabel, items: [item] });
    return groups;
  }, []);

  const renderMenuSectionLabel = (label, nested = false) => (
    <p className={`${nested ? 'ml-7 mt-2' : 'mt-2'} px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200/60 first:mt-0`}>
      {label}
    </p>
  );

  const renderMenuItems = (items, { nested = false } = {}) => (
    groupItemsByMenuGroup(items).map((group, groupIndex) => (
      <React.Fragment key={`${nested ? 'nested' : 'root'}-${group.label || 'ungrouped'}-${groupIndex}`}>
        {group.label && renderMenuSectionLabel(group.label, nested)}
        {group.items.map((item) => {
          const active = isItemActive(item);
          const hasChildren = item.children?.length > 0;
          const childrenExpanded = hasChildren && (expandedMenuItems[item.name] || active);
          const baseHref = item.path || createPageUrl(item.page);
          const href = item.tab ? `${baseHref}?tab=${item.tab}` : baseHref;
          const itemTextSize = nested ? 'text-[12px]' : 'text-[13px]';
          const itemIndent = nested ? 'ml-4' : '';

          return (
            <div key={item.name}>
              <div className={`group flex items-center rounded-lg ${active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'} ${itemIndent}`}>
                <Link
                  to={href}
                  onClick={() => {
                    clearHoverCloseTimeout();
                    setHoveredSection(null);
                    setSidebarOpen(false);
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 ${itemTextSize}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
                <div className="flex items-center pr-2">
                  <button
                    type="button"
                    aria-label={`Fixar ${item.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      togglePin(item);
                    }}
                    className={`transition-opacity ${isPinned(item) ? 'text-blue-300 opacity-100' : 'text-white/50 opacity-0 hover:text-white group-hover:opacity-100'}`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  {hasChildren && (
                    <button
                      type="button"
                      aria-label={childrenExpanded ? `Recolher ${item.name}` : `Expandir ${item.name}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleMenuItem(item.name);
                      }}
                      className="ml-1 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      {childrenExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {childrenExpanded && (
                <div className="mt-1 space-y-1">
                  {renderMenuItems(item.children, { nested: true })}
                </div>
              )}
            </div>
          );
        })}
      </React.Fragment>
    ))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <SgpThemeModeMount isBombeiroMode={isBombeiroMode} />
      <ImpersonationBanner />
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#173764] text-white z-40 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-2xl border border-white/20 p-2 bg-white/5">
            <Shield className="w-6 h-6 text-blue-300" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-lg block leading-tight">SGP Militar</span>
            <span className="text-[10px] text-white/60 uppercase tracking-wide">Sistema de Gestão</span>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-white hover:bg-white/10">
          <Menu className="w-6 h-6" />
        </Button>
      </header>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
                                        clearHoverCloseTimeout();
                                        setHoveredSection(null);
                                        setSidebarOpen(false);
                                      }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed top-0 left-0 h-screen bg-[#173764] text-white z-50
          flex flex-col
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${compactSidebar ? 'w-20' : 'w-80'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="border-b border-white/10 px-3 py-3 shrink-0">
          <div className={`${compactSidebar ? 'flex justify-center' : 'flex items-center justify-between gap-3'}`}>
            {!compactSidebar && (
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-2xl border border-white/20 p-2 bg-white/5 shrink-0">
                  <Shield className="w-6 h-6 text-blue-300" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-lg block leading-tight">SGP Militar</span>
                  <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Sistema de Gestão de Pessoal</span>
                </div>
              </div>
            )}

            <div className={`flex items-center ${compactSidebar ? 'justify-center' : 'gap-1'}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setCompactSidebar((prev) => {
                    const next = !prev;
                    if (next) {
                      setExpandedSection('');
                      clearHoverCloseTimeout();
                      setHoveredSection(null);
                    }
                    return next;
                  })
                }
                className="hidden lg:flex text-white hover:bg-white/10 shrink-0"
              >
                {compactSidebar ? <Menu className="w-5 h-5" /> : <PanelLeftClose className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => {
                                        clearHoverCloseTimeout();
                                        setHoveredSection(null);
                                        setSidebarOpen(false);
                                      }} className="lg:hidden text-white hover:bg-white/10 shrink-0">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        <nav
          className={`flex-1 px-2.5 py-4 custom-scrollbar ${compactSidebar ? 'overflow-visible' : 'overflow-y-auto'}`}
        >
          <div className={`${compactSidebar ? 'space-y-3' : 'space-y-6'}`}>
            {visibleMenuGroups.map((group) => (
              <div key={group.title}>
                {!compactSidebar && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{group.title}</p>}
                {compactSidebar && <div className="mx-auto mb-2 h-px w-10 bg-white/15" />}
                <div className={`${compactSidebar ? 'space-y-1.5' : 'space-y-2'}`}>
                  {group.sections.map((section) => {
                    const expanded = expandedSection === section.title;
                    const flyoutOpen = compactSidebar && hoveredSection === section.title;
                    const sectionHasActive = section.items.some(isItemActive);
                    const SectionIcon = section.icon;
                    return (
                      <div
                        key={section.title}
                        className="relative"
                        onMouseEnter={() => compactSidebar && openSectionFlyout(section.title)}
                        onMouseLeave={() => compactSidebar && scheduleClose()}
                      >
                        <button
                          onClick={() => !compactSidebar && toggleExpanded(section.title)}
                          className={`flex w-full items-center ${compactSidebar ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-left transition-all ${sectionHasActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                        >
                          <div className={`flex items-center min-w-0 ${compactSidebar ? '' : 'gap-3'}`}>
                            {SectionIcon ? <SectionIcon className={`${compactSidebar ? 'w-5 h-5' : 'w-4 h-4'} shrink-0 text-blue-300`} /> : <span className="h-2 w-2 rounded-full bg-blue-300/90 shrink-0" />}
                            {!compactSidebar && <span className="truncate text-sm font-semibold">{section.title}</span>}
                          </div>
                          {!compactSidebar && (expanded ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />)}
                        </button>

                        {((!compactSidebar && expanded) || (compactSidebar && flyoutOpen)) && (
                          <div
                            onMouseEnter={() => compactSidebar && clearHoverCloseTimeout()}
                            onMouseLeave={() => compactSidebar && scheduleClose()}
                            className={`${compactSidebar ? 'absolute left-full top-0 ml-1 w-72 rounded-xl border border-white/15 bg-[#102b4f] p-3 shadow-2xl z-[400] max-h-[80vh] overflow-y-auto' : 'mt-1 ml-3 pl-3 border-l border-white/10 space-y-1'}`}
                        >
                            {compactSidebar && (
                              <>
                                <p className="text-xs font-semibold mb-1">{section.title}</p>
                                <div className="absolute -left-3 top-4 h-10 w-3" />
                                <div className="absolute -left-1 top-5 h-2.5 w-2.5 rotate-45 border-l border-t border-white/15 bg-[#102b4f]" />
                              </>
                            )}
                            <div className="space-y-1">
                              {renderMenuItems(section.items)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4 shrink-0 bg-black/10">
          <button onClick={() => { clearImpersonation(); base44.auth.logout(); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-300 transition-all hover:bg-red-500/10 hover:text-red-200">
            <LogOut className="w-5 h-5 shrink-0" />
            {!compactSidebar && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <main className={`${compactSidebar ? 'lg:pl-20' : 'lg:pl-80'} pt-16 lg:pt-0 min-h-screen`}>
        <div className="sticky top-16 lg:top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex w-full max-w-none items-center gap-3">
            <GlobalMilitarSearch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto h-10 min-w-[170px] justify-between gap-2 border-slate-300 bg-white px-3">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <UserCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate text-sm">{user?.full_name || userEmail || 'Perfil'}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="pb-0">Minha conta</DropdownMenuLabel>
                <p className="px-2 pb-2 text-xs text-slate-500">{userEmail || 'Usuário autenticado'}</p>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-slate-500">Preferências</DropdownMenuLabel>
                <SgpThemeProfileSelector themeMode={themeMode} setThemeMode={setThemeMode} />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { clearImpersonation(); base44.auth.logout(); }} className="text-red-600 focus:text-red-700">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {children}
      </main>


      <QuickAccessWidget
        items={pinnedVisibleItems}
        getPinKey={getPinKey}
        widgetPreferences={widgetPreferences}
        onWidgetChange={updateWidgetPreferences}
        defaultWidget={DEFAULT_WIDGET}
        sidebarFlyoutOpen={sidebarFlyoutOpen}
        createHref={(item) => {
          const baseHref = item.path || createPageUrl(item.page);
          return item.tab ? `${baseHref}?tab=${item.tab}` : baseHref;
        }}
      />

      {canAccessAction('perm_visualizar_quadro_operacional') && <AlertasOperacionais />}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.22); }
      `}</style>
    </div>
  );
}