export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-5xl">{title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
