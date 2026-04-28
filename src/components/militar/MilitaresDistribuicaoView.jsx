import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ShieldCheck, User, Users } from 'lucide-react';

const SEM_LOTACAO_LABEL = 'Sem lotação';
const SEM_POSTO_LABEL = 'Sem Posto/Graduação';

const ORDEM_POSTOS = [
  'Coronel',
  'Tenente Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
  'Sem Posto',
  SEM_POSTO_LABEL,
];

const getStatusCounts = (militares = []) => {
  const ativos = militares.filter((m) => m.status_cadastro === 'Ativo' || !m.status_cadastro).length;
  return {
    total: militares.length,
    ativos,
    inativos: militares.length - ativos,
  };
};

const getNomeMilitar = (militar) => militar.nome_guerra || militar.nome_completo || 'Sem nome';

const getPostoIndex = (posto) => {
  const normalized = (posto || '').trim();
  const idx = ORDEM_POSTOS.indexOf(normalized || SEM_POSTO_LABEL);
  return idx === -1 ? ORDEM_POSTOS.length : idx;
};

export default function MilitaresDistribuicaoView({
  militares,
  onView,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  searchTerm,
}) {
  const [lotacoesAbertas, setLotacoesAbertas] = useState({});
  const [postosAbertos, setPostosAbertos] = useState({});

  const distribuicao = useMemo(() => {
    const gruposPorLotacao = new Map();

    for (const militar of militares) {
      const lotacao = (militar.lotacao || '').trim() || SEM_LOTACAO_LABEL;
      const posto = (militar.posto_graduacao || '').trim() || SEM_POSTO_LABEL;

      if (!gruposPorLotacao.has(lotacao)) {
        gruposPorLotacao.set(lotacao, {
          nome: lotacao,
          militares: [],
          postos: new Map(),
        });
      }

      const grupoLotacao = gruposPorLotacao.get(lotacao);
      grupoLotacao.militares.push(militar);

      if (!grupoLotacao.postos.has(posto)) {
        grupoLotacao.postos.set(posto, {
          nome: posto,
          militares: [],
        });
      }

      grupoLotacao.postos.get(posto).militares.push(militar);
    }

    const lotacoes = Array.from(gruposPorLotacao.values()).map((grupoLotacao) => {
      const postosOrdenados = Array.from(grupoLotacao.postos.values())
        .sort((a, b) => {
          const diff = getPostoIndex(a.nome) - getPostoIndex(b.nome);
          if (diff !== 0) return diff;
          return a.nome.localeCompare(b.nome, 'pt-BR');
        })
        .map((grupoPosto) => ({
          ...grupoPosto,
          status: getStatusCounts(grupoPosto.militares),
          militares: [...grupoPosto.militares].sort((a, b) => getNomeMilitar(a).localeCompare(getNomeMilitar(b), 'pt-BR')),
        }));

      return {
        nome: grupoLotacao.nome,
        status: getStatusCounts(grupoLotacao.militares),
        postos: postosOrdenados,
      };
    });

    return lotacoes.sort((a, b) => {
      if (a.nome === SEM_LOTACAO_LABEL) return 1;
      if (b.nome === SEM_LOTACAO_LABEL) return -1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [militares]);

  const toggleLotacao = (lotacaoNome) => {
    setLotacoesAbertas((atual) => ({ ...atual, [lotacaoNome]: !atual[lotacaoNome] }));
  };

  const togglePosto = (lotacaoNome, postoNome) => {
    const key = `${lotacaoNome}::${postoNome}`;
    setPostosAbertos((atual) => ({ ...atual, [key]: !atual[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Exibindo distribuição dos militares carregados. Use “Carregar mais” para ampliar a visualização.
      </div>

      {distribuicao.map((lotacao) => {
        const lotacaoAberta = !!lotacoesAbertas[lotacao.nome];

        return (
          <div key={lotacao.nome} className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <button
              type="button"
              onClick={() => toggleLotacao(lotacao.nome)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {lotacaoAberta ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <h3 className="text-base md:text-lg font-semibold text-[#1e3a5f] truncate">{lotacao.nome}</h3>
                <Badge variant="secondary">{lotacao.status.total}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                <Badge variant="outline">Ativos: {lotacao.status.ativos}</Badge>
                <Badge variant="outline">Inativos: {lotacao.status.inativos}</Badge>
              </div>
            </button>

            {lotacaoAberta && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                {lotacao.postos.map((posto) => {
                  const postoKey = `${lotacao.nome}::${posto.nome}`;
                  const postoAberto = !!postosAbertos[postoKey];

                  return (
                    <div key={postoKey} className="rounded-lg border border-slate-100 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => togglePosto(lotacao.nome, posto.nome)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {postoAberto ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                          <p className="font-medium text-slate-700 truncate">{posto.nome}</p>
                          <Badge variant="secondary">{posto.status.total}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                          <span>Ativos: {posto.status.ativos}</span>
                          <span>Inativos: {posto.status.inativos}</span>
                        </div>
                      </button>

                      {postoAberto && (
                        <div className="border-t border-slate-100 p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {posto.militares.map((militar) => (
                            <div key={militar.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">
                                    {militar.posto_graduacao ? `${militar.posto_graduacao} ` : ''}
                                    {getNomeMilitar(militar)}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">Mat: {militar.matricula || '—'}</p>
                                </div>
                                <Badge variant={militar.status_cadastro === 'Inativo' ? 'destructive' : 'default'} className="text-[10px]">
                                  {militar.status_cadastro || 'Ativo'}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
                                  <ShieldCheck className="w-3 h-3" />
                                  {militar.quadro || 'Sem quadro'}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
                                  <Users className="w-3 h-3" />
                                  {(militar.lotacao || '').trim() || SEM_LOTACAO_LABEL}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => onView(militar)}>
                                  <User className="w-3 h-3 mr-1" />
                                  Ver
                                </Button>
                                {canEdit && (
                                  <Button size="sm" variant="outline" onClick={() => onEdit(militar)}>
                                    Editar
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button size="sm" variant="destructive" onClick={() => onDelete(militar)}>
                                    Excluir
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {searchTerm && distribuicao.length > 0 && (
        <p className="text-xs text-slate-500 px-1">Resultados agrupados automaticamente pelos filtros ativos.</p>
      )}
    </div>
  );
}
