
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getPostoGraduacaoMilitar, getQuadroMilitar } from '../militarPostoGraduacao.js';

/**
 * Caso Stort - Simulação de Sincronização e Leitura Oficial
 * Militar: Rafael Stort Zulli
 * Matrícula: 415.443-021
 */

describe('Sincronização Caso Stort', () => {

  it('deve priorizar campos oficiais mas detectar aliases divergentes', () => {
    // Cenário: Cadastro com posto oficial "Soldado", mas aliases com "Cabo"
    // Isso simula o que o Efetivo poderia estar lendo se estivesse usando aliases com prioridade errada,
    // ou o que a sincronização deve corrigir.
    const militarStort = {
      id: 'stort-123',
      matricula: '415.443-021',
      nome_completo: 'Rafael Stort Zulli',
      posto_graduacao: 'Soldado', // Oficial
      posto_grad: 'Cabo',          // Alias divergente
      quadro: 'QBMP-1.a'
    };

    // Pela regra de prioridade (1. posto_graduacao, 2. postoGraduacao, 3. posto_grad...),
    // getPostoGraduacaoMilitar deve retornar "Soldado" (o oficial) se ele existir.
    // O problema relatado é que a sincronização diz que atualizou mas o Efetivo continua mostrando o antigo.
    // Se o Efetivo passar a usar o helper, ele lerá "Soldado".

    const postoLido = getPostoGraduacaoMilitar(militarStort);
    assert.strictEqual(postoLido, 'Soldado', 'Deve ler o campo oficial posto_graduacao prioritariamente');
  });

  it('deve retornar o alias se o campo oficial estiver vazio', () => {
    const militarComAlias = {
      id: 'm-alias',
      matricula: '123',
      posto_graduacao: '', // Oficial vazio
      posto_grad: 'Cabo'    // Alias preenchido
    };

    const postoLido = getPostoGraduacaoMilitar(militarComAlias);
    assert.strictEqual(postoLido, 'Cabo', 'Deve retornar o alias se o oficial estiver vazio');
  });

  it('deve simular a correção da sincronização (Caso Stort)', () => {
    // Estado inicial problemático
    let militarStort = {
      id: 'stort-123',
      matricula: '415.443-021',
      posto_graduacao: 'Soldado',
      posto_grad: 'Soldado', // Já tinha Soldado no alias também
      quadro: 'QBMP-1.a'
    };

    // Promoção esperada: Cabo
    const promocaoEsperada = 'Cabo';

    // A função atualizarCadastroMilitar (mockada aqui) atualiza o oficial e o alias conhecido
    militarStort.posto_graduacao = promocaoEsperada;
    militarStort.posto_grad = promocaoEsperada;

    // Verificação após "sincronização"
    const postoApos = getPostoGraduacaoMilitar(militarStort);
    assert.strictEqual(postoApos, 'Cabo', 'Helper deve retornar Cabo após atualização');

    // Se houvesse um alias NÃO mapeado na atualização, o helper ainda assim deveria
    // priorizar o oficial 'Cabo' se ele estiver preenchido corretamente.
    militarStort.postoGraduacao = 'Soldado'; // Alias "esquecido" ou legado divergente

    const postoFinal = getPostoGraduacaoMilitar(militarStort);
    assert.strictEqual(postoFinal, 'Cabo', 'Helper deve priorizar campo oficial atualizado mesmo com aliases divergentes');
  });

});
