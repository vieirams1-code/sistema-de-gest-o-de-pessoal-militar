const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

const tableDefSearch = `function GratificacoesTable({ gratificacoes, tipos, canManageRascunhos = false, onEditRascunho }) {`;
const tableDefReplace = `function GratificacoesTable({ gratificacoes, tipos, canManageRascunhos = false, onEditRascunho, onEnviarDP, onAguardandoPublicacao }) {`;
code = code.replace(tableDefSearch, tableDefReplace);

const tableRowSearch = `{canManageRascunhos && <td className="px-4 py-4 text-right">{item.status === GRATIFICACAO_STATUS.RASCUNHO ? <Button type="button" variant="outline" size="sm" onClick={() => onEditRascunho(item)}><Edit className="h-3.5 w-3.5" /> Editar</Button> : <span className="text-xs text-slate-400">Somente rascunho</span>}</td>}`;

const tableRowReplace = `{canManageRascunhos && <td className="px-4 py-4 text-right">
  {item.status === GRATIFICACAO_STATUS.RASCUNHO ? (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onEditRascunho(item)}><Edit className="h-3.5 w-3.5" /> Editar</Button>
      <Button type="button" variant="outline" size="sm" className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-700" onClick={() => onEnviarDP(item)}>Enviar à DP</Button>
    </div>
  ) : item.status === GRATIFICACAO_STATUS.SOLICITADO_DP ? (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700" onClick={() => onAguardandoPublicacao(item)}>Aguardando Publicação</Button>
    </div>
  ) : (
    <span className="text-xs text-slate-400">Somente rascunho/DP</span>
  )}
</td>}`;

code = code.replace(tableRowSearch, tableRowReplace);
fs.writeFileSync(filepath, code);
