'use client';

export default function ServicePrintButton() {
  return <button className="rounded-lg bg-blue-950 px-4 py-2 font-semibold text-white"
    onClick={() => window.print()}>Imprimir o guardar como PDF</button>;
}
