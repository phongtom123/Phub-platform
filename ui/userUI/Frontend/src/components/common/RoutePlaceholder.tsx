type Props = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({ eyebrow, title, description }: Props) {
  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-5xl items-center px-6 py-16">
      <div className="max-w-2xl">
        <span className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
          {eyebrow}
        </span>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">{description}</p>
      </div>
    </section>
  );
}
