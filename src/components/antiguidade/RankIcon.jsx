import React from 'react';

const normalizeRank = (rank = '') => String(rank || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/º|°/g, 'o')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

function Star({ x, y, size = 6, color = '#f8fafc' }) {
  const points = `${x},${y - size} ${x + size * 0.28},${y - size * 0.28} ${x + size},${y - size * 0.28} ${x + size * 0.45},${y + size * 0.12} ${x + size * 0.65},${y + size} ${x},${y + size * 0.45} ${x - size * 0.65},${y + size} ${x - size * 0.45},${y + size * 0.12} ${x - size},${y - size * 0.28} ${x - size * 0.28},${y - size * 0.28}`;
  return <polygon points={points} fill={color} />;
}

function Divisas({ extras = 0 }) {
  const lines = [10, 18, 26, ...Array.from({ length: extras }, (_, i) => 40 + i * 8)];
  return <>{lines.slice(0, 3).map((y) => <rect key={y} x="8" y={y} width="32" height="4" rx="2" fill="#f8fafc" />)}{extras > 0 && <rect x="8" y="34" width="32" height="2" rx="1" fill="#fff" />}{lines.slice(3).map((y) => <rect key={y} x="8" y={y} width="32" height="4" rx="2" fill="#f8fafc" />)}</>;
}

export default function RankIcon({ postoGraduacao, className = 'w-10 h-10' }) {
  const rank = normalizeRank(postoGraduacao);

  let content = <rect x="10" y="8" width="28" height="36" rx="4" fill="#94a3b8" />;
  if (rank.includes('soldado')) content = <circle cx="24" cy="24" r="8" fill="#f8fafc" />;
  else if (rank.includes('cabo')) content = <Divisas extras={0} />;
  else if (rank.includes('3o sargento') || rank.includes('terceiro sargento')) content = <Divisas extras={0} />;
  else if (rank.includes('2o sargento') || rank.includes('segundo sargento')) content = <Divisas extras={1} />;
  else if (rank.includes('1o sargento') || rank.includes('primeiro sargento')) content = <Divisas extras={2} />;
  else if (rank.includes('subtenente')) content = <polygon points="24,8 8,40 40,40" fill="#cbd5e1" />;
  else if (rank.includes('aspirante')) content = <Star x={24} y={24} />;
  else if (rank.includes('2o tenente') || rank.includes('segundo tenente')) content = <><Star x={17} y={24} /><Star x={31} y={24} /></>;
  else if (rank.includes('1o tenente') || rank.includes('primeiro tenente')) content = <><Star x={14} y={24} /><Star x={24} y={24} /><Star x={34} y={24} /></>;
  else if (rank.includes('capitao')) content = <><Star x={17} y={18} /><Star x={31} y={18} /><Star x={17} y={31} /><Star x={31} y={31} /></>;
  else if (rank.includes('major')) content = <><Star x={14} y={24} /><Star x={24} y={16} /><Star x={34} y={24} /><Star x={24} y={32} /></>;
  else if (rank.includes('tenente coronel')) content = <><Star x={14} y={24} /><Star x={24} y={16} /><Star x={24} y={32} /><Star x={34} y={24} /><Star x={24} y={24} /></>;
  else if (rank.includes('coronel')) content = <><Star x={14} y={16} /><Star x={24} y={16} /><Star x={34} y={16} /><Star x={14} y={32} /><Star x={24} y={32} /><Star x={34} y={32} /></>;

  return <div className={className}><svg viewBox="0 0 48 48" className="w-full h-full rounded-lg bg-slate-700">{content}</svg></div>;
}
