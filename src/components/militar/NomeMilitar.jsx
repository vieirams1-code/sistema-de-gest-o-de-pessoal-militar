import React from 'react';

/**
 * Abreviações de posto/graduação
 */
const abreviacoes = {
  'Coronel': 'Cel',
  'Tenente Coronel': 'TC',
  'Major': 'Maj',
  'Capitão': 'Cap',
  '1º Tenente': '1º Ten',
  '2º Tenente': '2º Ten',
  'Aspirante': 'Asp',
  'Subtenente': 'ST',
  '1º Sargento': '1º Sgt',
  '2º Sargento': '2º Sgt',
  '3º Sargento': '3º Sgt',
  'Cabo': 'Cb',
  'Soldado': 'Sd',
};

/**
 * Abreviações de quadro
 */
const abrevQuadro = {
  'QOBM': 'QOBM',
  'QAOBM': 'QAOBM',
  'QOEBM': 'QOEBM',
  'QOSAU': 'QOSAU',
  'QBMP-1.a': 'QBMP',
  'QBMP-1.b': 'QBMP',
  'QBMP-2': 'QBMP',
  'QBMPT': 'QBMPT',
};

/**
 * Dado nome completo e nome de guerra, retorna JSX com o nome de guerra destacado (negrito+sublinhado)
 * dentro do nome completo.
 *
 * Regra:
 * - Se nome de guerra = "L.Silva", encontra no nome completo o primeiro nome que começa com "L" e "Silva"
 *   e sublinha/negrita essas partes.
 * - Caso contrário, apenas sublinha o trecho que corresponde ao nome de guerra no nome completo.
 */
function destacarNomeGuerra(nomeCompleto, nomeGuerra) {
  if (!nomeCompleto) return null;
  if (!nomeGuerra) return <span>{nomeCompleto}</span>;

  const nomeParts = nomeCompleto.trim().split(/\s+/);

  // Detectar padrão "L.Silva" (letra.nome)
  const letraMatch = nomeGuerra.match(/^([A-Za-z])\.(.+)$/);
  if (letraMatch) {
    const letra = letraMatch[1].toUpperCase();
    const sobrenome = letraMatch[2].toLowerCase();

    return (
      <span>
        {nomeParts.map((part, i) => {
          const partLower = part.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñü]/gi, '');
          const isLetra = part.toUpperCase().startsWith(letra) && i === 0;
          const isSobrenome = partLower === sobrenome || part.toLowerCase() === sobrenome;

          if (isLetra || isSobrenome) {
            return (
              <React.Fragment key={i}>
                <strong className="underline">{part}</strong>
                {i < nomeParts.length - 1 ? ' ' : ''}
              </React.Fragment>
            );
          }
          return <React.Fragment key={i}>{part}{i < nomeParts.length - 1 ? ' ' : ''}</React.Fragment>;
        })}
      </span>
    );
  }

  // Padrão simples: sublinhar a parte do nome que corresponde ao nome de guerra
  const guerraParts = nomeGuerra.trim().toLowerCase().split(/\s+/);
  return (
    <span>
      {nomeParts.map((part, i) => {
        const partLower = part.toLowerCase();
        if (guerraParts.includes(partLower)) {
          return (
            <React.Fragment key={i}>
              <strong className="underline">{part}</strong>
              {i < nomeParts.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}{i < nomeParts.length - 1 ? ' ' : ''}</React.Fragment>;
      })}
    </span>
  );
}

/**
 * Componente que exibe o nome militar formatado:
 * Abrev.Posto Quadro NomeCompleto (com nome de guerra sublinhado/negritado)
 *
 * Props:
 *  - posto: string
 *  - quadro: string (opcional)
 *  - nomeCompleto: string
 *  - nomeGuerra: string (opcional)
 *  - className: string (opcional)
 */
export default function NomeMilitar({ posto, quadro, nomeCompleto, nomeGuerra, className = '' }) {
  const abrevPosto = abreviacoes[posto] || posto || '';
  const quadroStr = quadro ? `/${quadro}` : '';

  return (
    <span className={className}>
      {abrevPosto && <span className="font-medium">{abrevPosto}{quadroStr} </span>}
      {destacarNomeGuerra(nomeCompleto, nomeGuerra)}
    </span>
  );
}

/**
 * Função utilitária que retorna string simples (sem JSX) com posto abreviado + nome
 * Para uso em contextos que precisam de string pura
 */
export function formatNomeMilitarTexto(posto, nomeCompleto, nomeGuerra) {
  const abrevPosto = abreviacoes[posto] || posto || '';
  const nome = nomeGuerra || nomeCompleto || '';
  return abrevPosto ? `${abrevPosto} ${nome}` : nome;
}

export { abreviacoes };