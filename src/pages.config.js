import CadastrarMilitar from './pages/CadastrarMilitar';
import Militares from './pages/Militares';
import VerMilitar from './pages/VerMilitar';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CadastrarMilitar": CadastrarMilitar,
    "Militares": Militares,
    "VerMilitar": VerMilitar,
}

export const pagesConfig = {
    mainPage: "CadastrarMilitar",
    Pages: PAGES,
    Layout: __Layout,
};