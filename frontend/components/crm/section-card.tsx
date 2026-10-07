import { ReactNode } from 'react';

export function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <div className="mb-4 flex items-center gap-2 text-slate-700">
        {icon}
        <h4 className="font-bold text-slate-950">{title}</h4>
      </div>
      {children}
    </section>
  );
}
