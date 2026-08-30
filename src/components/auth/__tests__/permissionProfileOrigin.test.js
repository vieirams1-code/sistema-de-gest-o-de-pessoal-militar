import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractProfileOriginIdFromDescription,
  mergeProfileDescriptionWithMatrix,
  mergeProfileOriginIntoDescription,
} from '../../../services/permissionMatrixService.js';

test('perfil personalizado preserva o perfil base de origem dentro da descrição', () => {
  const origemId = 'perfil-base-123';
  const descricaoComOrigem = mergeProfileOriginIntoDescription('Perfil personalizado para usuário.', origemId);
  const descricaoFinal = mergeProfileDescriptionWithMatrix(descricaoComOrigem, {
    acesso_militares: true,
    perm_visualizar_militares: true,
  });

  assert.equal(extractProfileOriginIdFromDescription(descricaoFinal), origemId);
  assert.match(descricaoFinal, /\[SGP_PERMISSIONS_MATRIX\]/);
});

test('atualizar origem substitui marcador antigo sem criar duplicidade', () => {
  const primeira = mergeProfileOriginIntoDescription('Perfil personalizado para usuário.', 'perfil-antigo');
  const segunda = mergeProfileOriginIntoDescription(primeira, 'perfil-novo');

  assert.equal(extractProfileOriginIdFromDescription(segunda), 'perfil-novo');
  assert.equal((segunda.match(/\[SGP_PROFILE_ORIGIN\]/g) || []).length, 1);
});
