import CadastrarMilitar from './pages/CadastrarMilitar';
import Militares from './pages/Militares';
import VerMilitar from './pages/VerMilitar';
import CadastrarAtestado from './pages/CadastrarAtestado';
import Atestados from './pages/Atestados';
import VerAtestado from './pages/VerAtestado';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CadastrarMilitar": CadastrarMilitar,
    "Militares": Militares,
    "VerMilitar": VerMilitar,
    "CadastrarAtestado": CadastrarAtestado,
    "Atestados": Atestados,
    "VerAtestado": VerAtestado,
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};