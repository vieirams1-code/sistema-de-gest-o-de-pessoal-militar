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
import AgendarJISO from './pages/AgendarJISO';
import Armamentos from './pages/Armamentos';
import Atestados from './pages/Atestados';
import CadastrarArmamento from './pages/CadastrarArmamento';
import CadastrarAtestado from './pages/CadastrarAtestado';
import CadastrarFerias from './pages/CadastrarFerias';
import CadastrarMedalha from './pages/CadastrarMedalha';
import CadastrarMilitar from './pages/CadastrarMilitar';
import CadastrarPublicacao from './pages/CadastrarPublicacao';
import CadastrarPunicao from './pages/CadastrarPunicao';
import CadastrarRegistroLivro from './pages/CadastrarRegistroLivro';
import Configuracoes from './pages/Configuracoes';
import DashboardAtestados from './pages/DashboardAtestados';
import EditarJISO from './pages/EditarJISO';
import Ferias from './pages/Ferias';
import FichaMilitar from './pages/FichaMilitar';
import Home from './pages/Home';
import Medalhas from './pages/Medalhas';
import Militares from './pages/Militares';
import PeriodosAquisitivos from './pages/PeriodosAquisitivos';
import PlanoAnualFerias from './pages/PlanoAnualFerias';
import Publicacoes from './pages/Publicacoes';
import Punicoes from './pages/Punicoes';
import TemplatesTexto from './pages/TemplatesTexto';
import TiposMedalha from './pages/TiposMedalha';
import VerAtestado from './pages/VerAtestado';
import VerMilitar from './pages/VerMilitar';
import Processos from './pages/Processos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgendarJISO": AgendarJISO,
    "Armamentos": Armamentos,
    "Atestados": Atestados,
    "CadastrarArmamento": CadastrarArmamento,
    "CadastrarAtestado": CadastrarAtestado,
    "CadastrarFerias": CadastrarFerias,
    "CadastrarMedalha": CadastrarMedalha,
    "CadastrarMilitar": CadastrarMilitar,
    "CadastrarPublicacao": CadastrarPublicacao,
    "CadastrarPunicao": CadastrarPunicao,
    "CadastrarRegistroLivro": CadastrarRegistroLivro,
    "Configuracoes": Configuracoes,
    "DashboardAtestados": DashboardAtestados,
    "EditarJISO": EditarJISO,
    "Ferias": Ferias,
    "FichaMilitar": FichaMilitar,
    "Home": Home,
    "Medalhas": Medalhas,
    "Militares": Militares,
    "PeriodosAquisitivos": PeriodosAquisitivos,
    "PlanoAnualFerias": PlanoAnualFerias,
    "Publicacoes": Publicacoes,
    "Punicoes": Punicoes,
    "TemplatesTexto": TemplatesTexto,
    "TiposMedalha": TiposMedalha,
    "VerAtestado": VerAtestado,
    "VerMilitar": VerMilitar,
    "Processos": Processos,
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};