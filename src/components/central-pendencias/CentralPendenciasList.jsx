import React from 'react';
import CentralPendenciaCard from './CentralPendenciaCard';

export default function CentralPendenciasList({ pendencias = [] }) {
  return (
    <div className="space-y-3">
      {pendencias.map((item) => (
        <CentralPendenciaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
