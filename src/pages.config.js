import CadastrarMilitar from './pages/CadastrarMilitar';
import Militares from './pages/Militares';
import VerMilitar from './pages/VerMilitar';
import CadastrarAtestado from './pages/CadastrarAtestado';
import Atestados from './pages/Atestados';
import VerAtestado from './pages/VerAtestado';
import PeriodosAquisitivos from './pages/PeriodosAquisitivos';
import CadastrarFerias from './pages/CadastrarFerias';
import Ferias from './pages/Ferias';
import PlanoAnualFerias from './pages/PlanoAnualFerias';
import CadastrarRegistroLivro from './pages/CadastrarRegistroLivro';
import Publicacoes from './pages/Publicacoes';
import Configuracoes from './pages/Configuracoes';
import Home from './pages/Home';
import Punicoes from './pages/Punicoes';
import CadastrarPunicao from './pages/CadastrarPunicao';
import Medalhas from './pages/Medalhas';
import CadastrarMedalha from './pages/CadastrarMedalha';
import TiposMedalha from './pages/TiposMedalha';
import Armamentos from './pages/Armamentos';
import CadastrarArmamento from './pages/CadastrarArmamento';
import CadastrarPublicacao from './pages/CadastrarPublicacao';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CadastrarMilitar": CadastrarMilitar,
    "Militares": Militares,
    "VerMilitar": VerMilitar,
    "CadastrarAtestado": CadastrarAtestado,
    "Atestados": Atestados,
    "VerAtestado": VerAtestado,
    "PeriodosAquisitivos": PeriodosAquisitivos,
    "CadastrarFerias": CadastrarFerias,
    "Ferias": Ferias,
    "PlanoAnualFerias": PlanoAnualFerias,
    "CadastrarRegistroLivro": CadastrarRegistroLivro,
    "Publicacoes": Publicacoes,
    "Configuracoes": Configuracoes,
    "Home": Home,
    "Punicoes": Punicoes,
    "CadastrarPunicao": CadastrarPunicao,
    "Medalhas": Medalhas,
    "CadastrarMedalha": CadastrarMedalha,
    "TiposMedalha": TiposMedalha,
    "Armamentos": Armamentos,
    "CadastrarArmamento": CadastrarArmamento,
    "CadastrarPublicacao": CadastrarPublicacao,
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};