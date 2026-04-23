import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  classificarPublicacaoLegadoPendente,
  listarPublicacoesLegadoPendentesClassificacao,
} from '@/services/migracaoAlteracoesLegadoService';

export default function ClassificacaoPendentesLegado() {
  const { isAdmin, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(false);
  const [salvandoId, setSalvandoId] = useState('');
  const [tiposValidos, setTiposValidos] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [tiposSelecionados, setTiposSelecionados] = useState({});

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [pendentes, tiposCustom] = await Promise.all([
        listarPublicacoesLegadoPendentesClassificacao(),
        base44.entities.TipoPublicacaoCustom.list('-created_date').catch(() => []),
      ]);
      const tipos = (tiposCustom || [])
        .map((item) => String(item?.nome || item?.value || item?.label || '').trim())
        .filter(Boolean);
      const unicos = Array.from(new Set(tipos)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setTiposValidos(unicos);
      setLinhas(pendentes || []);
    } catch (error) {
      toast({
        title: 'Falha ao carregar pendentes',
        description: error?.message || 'Não foi possível carregar as publicações pendentes de classificação.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isAccessResolved && isAdmin) carregarDados();
  }, [isAccessResolved, isAdmin]);

  const linhasFiltradas = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((item) => [
      item?.militar_nome,
      item?.militar_matricula,
      item?.materia_legado,
      item?.tipo_bg_legado,
      item?.nota_id_legado,
      item?.numero_bg,
    ].join(' ').toLowerCase().includes(termo));
  }, [linhas, filtro]);

  const handleSalvarClassificacao = async (item) => {
    const tipo = tiposSelecionados[item.id];
    if (!tipo) {
      toast({ title: 'Tipo obrigatório', description: 'Selecione um tipo antes de salvar.', variant: 'destructive' });
      return;
    }
    try {
      setSalvandoId(item.id);
      const usuario = await base44.auth.me();
      await classificarPublicacaoLegadoPendente({
        publicacaoId: item.id,
        tipoPublicacaoConfirmado: tipo,
        usuario,
        tiposPublicacaoCustom: tiposValidos.map((nome) => ({ value: nome, label: nome })),
      });
      toast({ title: 'Classificação salva', description: 'A publicação legado foi classificada com sucesso.' });
      await carregarDados();
    } catch (error) {
      toast({ title: 'Falha ao classificar', description: error?.message || 'Não foi possível salvar a classificação.', variant: 'destructive' });
    } finally {
      setSalvandoId('');
    }
  };

  if (isLoading || !isAccessResolved) return null;
  if (!isAdmin) return <AccessDenied modulo="Classificação Pendente Legado" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Classificação Pendente Legado</h1>
        <p className="text-sm text-slate-500">
          Ferramenta administrativa de migração para classificar publicações de origem legado publicadas com tipo <code>LEGADO_NAO_CLASSIFICADO</code>.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2">
          <Input
            placeholder="Filtrar por militar, matéria, tipo BG, nota ou BG"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
          />
          <Button variant="outline" onClick={carregarDados} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">Militar</th>
                <th className="text-left p-3">Matéria legado</th>
                <th className="text-left p-3">Tipo BG legado</th>
                <th className="text-left p-3">Trecho</th>
                <th className="text-left p-3">Selecionar tipo</th>
                <th className="text-left p-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="p-3">{item.militar_nome || item.nome_completo_legado || '—'}</td>
                  <td className="p-3">{item.materia_legado || '—'}</td>
                  <td className="p-3">{item.tipo_bg_legado || '—'}</td>
                  <td className="p-3 max-w-[340px] truncate" title={item.conteudo_trecho_legado || ''}>{item.conteudo_trecho_legado || '—'}</td>
                  <td className="p-3">
                    <Select
                      value={tiposSelecionados[item.id] || '__none__'}
                      onValueChange={(valor) => setTiposSelecionados((prev) => ({ ...prev, [item.id]: valor === '__none__' ? '' : valor }))}
                    >
                      <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Escolher tipo válido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecionar</SelectItem>
                        {tiposValidos.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Button size="sm" disabled={salvandoId === item.id} onClick={() => handleSalvarClassificacao(item)}>
                      {salvandoId === item.id ? 'Salvando...' : 'Salvar classificação'}
                    </Button>
                  </td>
                </tr>
              ))}
              {!linhasFiltradas.length && (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={6}>
                    Nenhuma publicação legado pendente de classificação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
