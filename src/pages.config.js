/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AgendaAcoesOperacionais from './pages/AgendaAcoesOperacionais';
import AgendarJISO from './pages/AgendarJISO';
import AuditoriaComportamento from './pages/AuditoriaComportamento';
import AvaliacaoComportamento from './pages/AvaliacaoComportamento';
import Armamentos from './pages/Armamentos';
import ApuracaoMedalhasTempoServico from './pages/ApuracaoMedalhasTempoServico';
import Atestados from './pages/Atestados';
import CadastrarArmamento from './pages/CadastrarArmamento';
import CadastrarAtestado from './pages/CadastrarAtestado';
import CadastrarFerias from './pages/CadastrarFerias';
import CadastrarMedalha from './pages/CadastrarMedalha';
import CadastrarMilitar from './pages/CadastrarMilitar';
import CadastrarPublicacao from './pages/CadastrarPublicacao';
import CadastrarPunicao from './pages/CadastrarPunicao';
import ClassificacaoPendentesLegado from './pages/ClassificacaoPendentesLegado';
import CadastrarRegistroLivro from './pages/CadastrarRegistroLivro';
import ConciliacaoBoletim from './pages/ConciliacaoBoletim';
import CreditosExtraordinariosFerias from './pages/CreditosExtraordinariosFerias';
import Configuracoes from './pages/Configuracoes';
import DetalheComportamento from './pages/DetalheComportamento';
import EditarJISO from './pages/EditarJISO';
import Ferias from './pages/Ferias';
import FichaMilitar from './pages/FichaMilitar';
import FolhaAlteracoes from './pages/FolhaAlteracoes';
import Home from './pages/Home';
import HistoricoImportacoesMilitares from './pages/HistoricoImportacoesMilitares';
import IndicacoesDomPedroII from './pages/IndicacoesDomPedroII';
import Medalhas from './pages/Medalhas';
import Militares from './pages/Militares';
import PeriodosAquisitivos from './pages/PeriodosAquisitivos';
import PlanoAnualFerias from './pages/PlanoAnualFerias';
import Processos from './pages/Processos';
import Publicacoes from './pages/Publicacoes';
import Punicoes from './pages/Punicoes';
import QuadroOperacional from './pages/QuadroOperacional';
import SolicitacoesAtualizacao from './pages/SolicitacoesAtualizacao';
import TemplatesTexto from './pages/TemplatesTexto';
import TiposMedalha from './pages/TiposMedalha';
import VerAtestado from './pages/VerAtestado';
import VerMilitar from './pages/VerMilitar';
import EstruturaOrganizacional from './pages/EstruturaOrganizacional';
import LotacaoMilitares from './pages/LotacaoMilitares';
import Livro from './pages/Livro';
import MigracaoMilitares from './pages/MigracaoMilitares';
import MigracaoAlteracoesLegado from './pages/MigracaoAlteracoesLegado';
import PerfisPermissao from './pages/PerfisPermissao';
import PermissoesUsuarios from './pages/PermissoesUsuarios';
import RP from './pages/RP';
import RegistrosMilitar from './pages/RegistrosMilitar';
import CadastrarRegistroRP from './pages/CadastrarRegistroRP';
import CentralPendencias from './pages/CentralPendencias';
import RevisaoDuplicidadesMilitar from './pages/RevisaoDuplicidadesMilitar';
import ProcedimentosProcessos from './pages/ProcedimentosProcessos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgendaAcoesOperacionais": AgendaAcoesOperacionais,
    "AgendarJISO": AgendarJISO,
    "AuditoriaComportamento": AuditoriaComportamento,
    "AvaliacaoComportamento": AvaliacaoComportamento,
    "Armamentos": Armamentos,
    "ApuracaoMedalhasTempoServico": ApuracaoMedalhasTempoServico,
    "Atestados": Atestados,
    "CadastrarArmamento": CadastrarArmamento,
    "CadastrarAtestado": CadastrarAtestado,
    "CadastrarFerias": CadastrarFerias,
    "CadastrarMedalha": CadastrarMedalha,
    "CadastrarMilitar": CadastrarMilitar,
    "CadastrarPublicacao": CadastrarPublicacao,
    "CadastrarPunicao": CadastrarPunicao,
    "ClassificacaoPendentesLegado": ClassificacaoPendentesLegado,
    "CadastrarRegistroLivro": CadastrarRegistroLivro,
    "ConciliacaoBoletim": ConciliacaoBoletim,
    "CreditosExtraordinariosFerias": CreditosExtraordinariosFerias,
    "Configuracoes": Configuracoes,
    "DetalheComportamento": DetalheComportamento,
    "EditarJISO": EditarJISO,
    "Ferias": Ferias,
    "FichaMilitar": FichaMilitar,
    "FolhaAlteracoes": FolhaAlteracoes,
    "Home": Home,
    "HistoricoImportacoesMilitares": HistoricoImportacoesMilitares,
    "IndicacoesDomPedroII": IndicacoesDomPedroII,
    "Medalhas": Medalhas,
    "Militares": Militares,
    "PeriodosAquisitivos": PeriodosAquisitivos,
    "PlanoAnualFerias": PlanoAnualFerias,
    "Processos": Processos,
    "Publicacoes": Publicacoes,
    "Punicoes": Punicoes,
    "QuadroOperacional": QuadroOperacional,
    "SolicitacoesAtualizacao": SolicitacoesAtualizacao,
    "TemplatesTexto": TemplatesTexto,
    "TiposMedalha": TiposMedalha,
    "VerAtestado": VerAtestado,
    "VerMilitar": VerMilitar,
    "EstruturaOrganizacional": EstruturaOrganizacional,
    "LotacaoMilitares": LotacaoMilitares,
    "Livro": Livro,
    "MigracaoMilitares": MigracaoMilitares,
    "MigracaoAlteracoesLegado": MigracaoAlteracoesLegado,
    "PerfisPermissao": PerfisPermissao,
    "PermissoesUsuarios": PermissoesUsuarios,
    "RP": RP,
    "RegistrosMilitar": RegistrosMilitar,
    "CadastrarRegistroRP": CadastrarRegistroRP,
    "CentralPendencias": CentralPendencias,
    "RevisaoDuplicidadesMilitar": RevisaoDuplicidadesMilitar,
    "ProcedimentosProcessos": ProcedimentosProcessos,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};