import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Facturas y tickets | Davofrío',
  description: 'Revisión de facturas y tickets de los técnicos de Davofrío',
};
export default function FacturasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
