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
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};