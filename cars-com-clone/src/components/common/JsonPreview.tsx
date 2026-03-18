type Props = {
  title: string;
  data: unknown;
};

export default function JsonPreview({ title, data }: Props) {
  return (
    <section className="rounded-2xl border p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
