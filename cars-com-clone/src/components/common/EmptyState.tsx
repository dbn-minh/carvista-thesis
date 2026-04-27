type Props = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/12 bg-white/5 px-5 py-6 text-center text-sm leading-6 text-slate-300 backdrop-blur-sm sm:px-6">
      <p className="text-base font-medium leading-7 text-white">{title}</p>
      {description ? <p className="mt-2 break-words">{description}</p> : null}
    </div>
  );
}
