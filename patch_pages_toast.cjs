const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// I should update the rascunhoMutation success toast to be more generic, or just leave it. Leaving it is fine as it says "Rascunho salvo". But for `enviar_dp` it is not saving a rascunho anymore.
// I will patch the toast description.
const mutationSearch = `  const rascunhoMutation = useMutation({
    mutationFn: gerirRascunhoGratificacaoFuncao,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gratificacoes-funcao-painel'] });
      setGratificacaoModal({ open: false, data: null });
      toast({ title: 'Rascunho salvo', description: 'Gratificação de Função salva como rascunho, sem ativação ou nomeação.' });
    },
    onError: (error) => toast({ title: 'Falha ao salvar rascunho', description: error?.message || 'Erro ao salvar rascunho.', variant: 'destructive' }),
  });`;

const mutationReplace = `  const rascunhoMutation = useMutation({
    mutationFn: gerirRascunhoGratificacaoFuncao,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['gratificacoes-funcao-painel'] });
      setGratificacaoModal({ open: false, data: null });

      const operacao = variables?.operacao || '';
      if (operacao === 'enviar_dp') {
        toast({ title: 'Enviado à DP', description: 'Solicitação registrada com sucesso.' });
      } else if (operacao === 'marcar_aguardando_publicacao') {
        toast({ title: 'Status Atualizado', description: 'Gratificação marcada como aguardando publicação.' });
      } else {
        toast({ title: 'Rascunho salvo', description: 'Gratificação de Função salva como rascunho, sem ativação ou nomeação.' });
      }
    },
    onError: (error) => toast({ title: 'Falha na operação', description: error?.message || 'Erro ao processar a operação.', variant: 'destructive' }),
  });`;

code = code.replace(mutationSearch, mutationReplace);
fs.writeFileSync(filepath, code);
