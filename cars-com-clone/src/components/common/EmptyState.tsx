type Props = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-cars-gray-light/40 dark:text-slate-300">
      <p className="font-medium text-slate-800 dark:text-white">{title}</p>
      {description ? <p className="mt-2">{description}</p> : null}
    </div>
  );
}
