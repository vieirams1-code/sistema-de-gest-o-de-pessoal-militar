import React from 'react';
import CentralPendenciaCard from './CentralPendenciaCard';

export default function CentralPendenciasList({ pendencias = [] }) {
  const pendenciasAtestado = pendencias.filter((item) => item?.categoriaSlug === 'atestados');
  const indiceAtestadoPorId = pendenciasAtestado.reduce((acc, item, index) => {
    acc[item.id] = index;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {pendencias.map((item) => (
        <CentralPendenciaCard
          key={item.id}
          item={item}
          pendenciasAtestado={pendenciasAtestado}
          indiceAtestado={indiceAtestadoPorId[item.id] ?? -1}
        />
      ))}
    </div>
  );
}
