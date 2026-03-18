type Props = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-600">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-2">{description}</p> : null}
    </div>
  );
}
