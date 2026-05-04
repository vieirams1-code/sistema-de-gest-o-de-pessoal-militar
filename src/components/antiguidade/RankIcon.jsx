import React from 'react';

const normalizeRank = (rank = '') => String(rank || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/º|°/g, 'o')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

function Star({ x, y, size = 4.6, color = '#f8fafc' }) {
  const points = `${x},${y - size} ${x + size * 0.3},${y - size * 0.3} ${x + size},${y - size * 0.3} ${x + size * 0.5},${y + size * 0.1} ${x + size * 0.68},${y + size} ${x},${y + size * 0.52} ${x - size * 0.68},${y + size} ${x - size * 0.5},${y + size * 0.1} ${x - size},${y - size * 0.3} ${x - size * 0.3},${y - size * 0.3}`;
  return <polygon points={points} fill={color} />;
}

function Divisas({ total = 3 }) {
  const yPositions = Array.from({ length: total }, (_, i) => 13 + i * 8);
  return <>{yPositions.map((y) => <rect key={y} x="11" y={y} width="26" height="4" rx="2" fill="#f8fafc" />)}</>;
}

export default function RankIcon({ postoGraduacao, className = 'w-10 h-10' }) {
  const rank = normalizeRank(postoGraduacao);

  let content = <rect x="10" y="9" width="28" height="30" rx="4" fill="#94a3b8" />;
  if (rank.includes('soldado')) content = <circle cx="24" cy="24" r="7" fill="#f8fafc" />;
  else if (rank.includes('cabo')) content = <Divisas total={2} />;
  else if (rank.includes('3o sargento') || rank.includes('terceiro sargento')) content = <Divisas total={3} />;
  else if (rank.includes('2o sargento') || rank.includes('segundo sargento')) content = <Divisas total={4} />;
  else if (rank.includes('1o sargento') || rank.includes('primeiro sargento')) content = <Divisas total={5} />;
  else if (rank.includes('subtenente')) content = <polygon points="24,10 11,36 37,36" fill="#cbd5e1" />;
  else if (rank.includes('aspirante')) content = <Star x={24} y={24} />;
  else if (rank.includes('2o tenente') || rank.includes('segundo tenente')) content = <><Star x={18} y={24} /><Star x={30} y={24} /></>;
  else if (rank.includes('1o tenente') || rank.includes('primeiro tenente')) content = <><Star x={14} y={24} /><Star x={24} y={24} /><Star x={34} y={24} /></>;
  else if (rank.includes('capitao')) content = <><Star x={18} y={19} /><Star x={30} y={19} /><Star x={18} y={30} /><Star x={30} y={30} /></>;
  else if (rank.includes('major')) content = <><Star x={14} y={24} /><Star x={24} y={16} /><Star x={34} y={24} /><Star x={24} y={32} /></>;
  else if (rank.includes('tenente coronel')) content = <><Star x={14} y={24} /><Star x={24} y={16} /><Star x={24} y={32} /><Star x={34} y={24} /><Star x={24} y={24} /></>;
  else if (rank.includes('coronel')) content = <><Star x={14} y={16} /><Star x={24} y={16} /><Star x={34} y={16} /><Star x={14} y={32} /><Star x={24} y={32} /><Star x={34} y={32} /></>;

  return <div className={className}><svg viewBox="0 0 48 48" className="w-full h-full rounded-lg"><defs><linearGradient id="rankBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0f172a" /><stop offset="100%" stopColor="#1e293b" /></linearGradient></defs><rect x="1" y="1" width="46" height="46" rx="11" fill="url(#rankBg)" stroke="#334155" strokeWidth="1.2" />{content}</svg></div>;
}
