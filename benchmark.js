import { executarMergeManualMilitares } from './src/services/militarIdentidadeService.js';
import * as base44Sdk from '@base44/sdk';

// Mock getEntity
let calls = 0;
const mockUpdate = async () => { await new Promise(r => setTimeout(r, 10)); };
const mockList = async (entityName) => {
  await new Promise(r => setTimeout(r, 50));
  return [
    { id: '1', militar_id: 'origem_1' },
    { id: '2', militar_id: 'origem_1' },
    { id: '3', militar_id: 'origem_1' },
    { id: '4', militar_id: 'origem_1' },
    { id: '5', militar_id: 'origem_1' },
    { id: '6', militar_id: 'outromilitar' }
  ];
};

const mockGetEntity = async (entityName) => {
  return {
    list: () => mockList(entityName),
    update: mockUpdate,
    filter: async (args) => {
        if (entityName === 'Militar') {
            if (args.id === 'origem_1') return [{id: 'origem_1', matricula: '123'}];
            if (args.id === 'destino_1') return [{id: 'destino_1', matricula: '456'}];
        }
        return [];
    },
    create: async () => ({ id: 'log_1' })
  };
};

// Override getEntity using node modules or global if possible
import { getEntity } from './src/services/militarIdentidadeService.js'; // This is imported, probably can't mock like this directly without jest/test runner. Let's just create a test that measures the specific logic block.
