const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// Also inject the modal states into `GratificacoesFuncao`
const injectStateSearch = `  const [cotaModal, setCotaModal] = useState({ open: false, data: null });
  const [gratificacaoModal, setGratificacaoModal] = useState({ open: false, data: null });`;

const injectStateReplace = `  const [cotaModal, setCotaModal] = useState({ open: false, data: null });
  const [gratificacaoModal, setGratificacaoModal] = useState({ open: false, data: null });
  const [enviarDPModal, setEnviarDPModal] = useState({ open: false, data: null });
  const [aguardandoPublicacaoModal, setAguardandoPublicacaoModal] = useState({ open: false, data: null });`;

code = code.replace(injectStateSearch, injectStateReplace);
fs.writeFileSync(filepath, code);
