export const BARRIOS_LULES = [
  'Centro',
  'Barrio Pilar',
  'La Reducción',
  'El Manantial',
  'Mercedes',
  'San Rafael',
  'Las Tipas',
  'Villa del Carmen',
  '25 de Mayo',
  '9 de Julio',
  'Belgrano',
  'San Martín',
  'La Quebrada',
] as const;

export type BarrioLules = (typeof BARRIOS_LULES)[number];
