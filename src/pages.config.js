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
import Ferias from './pages/Ferias';
import Home from './pages/Home';
import Medalhas from './pages/Medalhas';
import Militares from './pages/Militares';
import PeriodosAquisitivos from './pages/PeriodosAquisitivos';
import PlanoAnualFerias from './pages/PlanoAnualFerias';
import Publicacoes from './pages/Publicacoes';
import Punicoes from './pages/Punicoes';
import TiposMedalha from './pages/TiposMedalha';
import VerAtestado from './pages/VerAtestado';
import VerMilitar from './pages/VerMilitar';
import DashboardAtestados from './pages/DashboardAtestados';
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
    "Ferias": Ferias,
    "Home": Home,
    "Medalhas": Medalhas,
    "Militares": Militares,
    "PeriodosAquisitivos": PeriodosAquisitivos,
    "PlanoAnualFerias": PlanoAnualFerias,
    "Publicacoes": Publicacoes,
    "Punicoes": Punicoes,
    "TiposMedalha": TiposMedalha,
    "VerAtestado": VerAtestado,
    "VerMilitar": VerMilitar,
    "DashboardAtestados": DashboardAtestados,
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};