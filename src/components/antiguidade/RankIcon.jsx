import React from 'react';

const normalizeRank = (rank = '') => String(rank || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/º|°/g, 'o')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export default function RankIcon({ postoGraduacao }) {
  const getIconProps = (rankName) => {
    if (!rankName) return { type: 'circle' };
    const lowerRank = normalizeRank(rankName);

    if (lowerRank.includes('soldado')) return { type: 'divisas_simples', divisasList: ['gray'] };
    if (lowerRank.includes('cabo')) return { type: 'divisas_simples', divisasList: ['gray', 'gray'] };
    if (lowerRank.includes('3o sargento') || lowerRank.includes('terceiro sargento')) return { type: 'divisas_simples', divisasList: ['gray', 'gray', 'gray'] };
    if (lowerRank.includes('2o sargento') || lowerRank.includes('segundo sargento')) return { type: 'divisas_simples', divisasList: ['gray', 'gray', 'gray', 'white', 'gray'] };
    if (lowerRank.includes('1o sargento') || lowerRank.includes('primeiro sargento')) return { type: 'divisas_simples', divisasList: ['gray', 'gray', 'gray', 'white', 'gray', 'gray'] };
    if (lowerRank.includes('subtenente')) return { type: 'triangulo_subtenente' };

    if (lowerRank.includes('aspirante')) return { type: 'stars', starsList: ['simples'] };
    if (lowerRank.includes('2o tenente') || lowerRank.includes('segundo tenente')) return { type: 'stars', starsList: ['azul'] };
    if (lowerRank.includes('1o tenente') || lowerRank.includes('primeiro tenente')) return { type: 'stars', starsList: ['azul', 'azul'] };
    if (lowerRank.includes('capitao')) return { type: 'stars', starsList: ['azul', 'azul', 'azul'] };
    if (lowerRank.includes('major')) return { type: 'stars', starsList: ['amarela', 'azul', 'azul'] };
    if (lowerRank.includes('tenente coronel')) return { type: 'stars', starsList: ['amarela', 'amarela', 'azul'] };
    if (lowerRank.includes('coronel')) return { type: 'stars', starsList: ['amarela', 'amarela', 'amarela'] };

    return { type: 'circle' };
  };

  const { type, starsList, divisasList } = getIconProps(postoGraduacao);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      {type === 'divisas_simples' && (
        <svg className="w-[28px] h-[36px] drop-shadow-sm" viewBox="0 0 24 38">
          {divisasList.map((colorName, i) => {
            const spacing = 5;
            const tipDiff = 9;
            const totalHeight = (divisasList.length - 1) * spacing + tipDiff;
            const topEdgeY = 19 - totalHeight / 2;
            const edgeY = topEdgeY + (divisasList.length - 1 - i) * spacing;
            const tipY = edgeY + tipDiff;
            return (
              <path
                key={i}
                d={`M 3 ${edgeY} L 12 ${tipY} L 21 ${edgeY}`}
                stroke={colorName === 'gray' ? '#64748B' : '#FFFFFF'}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="square"
                strokeLinejoin="miter"
                style={colorName === 'white' ? { filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.25))' } : {}}
              />
            );
          })}
        </svg>
      )}

      {type === 'triangulo_subtenente' && (
        <svg className="w-[22px] h-[22px] drop-shadow-sm" viewBox="0 0 24 24">
          <polygon points="12,3 22,20 2,20" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )}

      {type === 'stars' && (
        <div className="flex flex-row flex-nowrap justify-center items-center gap-[2px]">
          {starsList.map((starType, i) => {
            if (starType === 'simples') {
              return (
                <svg key={i} className="w-[20px] h-[20px] drop-shadow-sm" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#EAB308" />
                  <path d="M12 2L12 12M15.09 8.26L12 12M22 9.27L12 12M17 14.14L12 12M18.18 21.02L12 12M12 17.77L12 12M5.82 21.02L12 12M7 14.14L12 12M2 9.27L12 12M8.91 8.26L12 12" stroke="#CA8A04" strokeWidth="0.5" opacity="0.6" />
                </svg>
              );
            }
            if (starType === 'azul') {
              return (
                <svg key={i} className="w-[24px] h-[24px] drop-shadow-sm" viewBox="0 0 24 24">
                  <path d="M12 1L16 9L23 12L16 15L12 23L8 15L1 12L8 9Z" fill="#94A3B8" />
                  <path d="M12 3L14.5 9.5L20.5 12L14.5 14.5L12 21L9.5 14.5L3.5 12L9.5 9.5Z" fill="#CBD5E1" />
                  <path d="M12 5L13.5 10.5L18 12L13.5 13.5L12 19L10.5 13.5L6 12L10.5 10.5Z" fill="#F8FAFC" />
                  <circle cx="12" cy="12" r="5" fill="#1E3A8A" stroke="#94A3B8" strokeWidth="0.5" />
                  <path d="M10.5 10.5L13.5 13.5M13.5 10.5L10.5 13.5" stroke="#F8FAFC" strokeWidth="1" strokeLinecap="round" />
                </svg>
              );
            }
            if (starType === 'amarela') {
              return (
                <svg key={i} className="w-[24px] h-[24px] drop-shadow-sm" viewBox="0 0 24 24">
                  <path d="M12 1L14.5 8L22 8L16 12.5L18.5 20L12 15L5.5 20L8 12.5L2 8L9.5 8Z" fill="#CA8A04" />
                  <path d="M12 3L13.5 8.5L19 8.5L14.5 12L16 17.5L12 14L8 17.5L9.5 12L5 8.5L10.5 8.5Z" fill="#FDE047" />
                  <circle cx="12" cy="12" r="5" fill="#1E3A8A" stroke="#CA8A04" strokeWidth="0.5" />
                  <circle cx="12" cy="12" r="3" fill="#DC2626" />
                  <path d="M10.5 10.5L13.5 13.5M13.5 10.5L10.5 13.5" stroke="#FDE047" strokeWidth="1" strokeLinecap="round" />
                </svg>
              );
            }
            return null;
          })}
        </div>
      )}

      {type === 'circle' && <div className="w-3 h-3 bg-slate-300 rounded-full" />}
    </div>
  );
}
