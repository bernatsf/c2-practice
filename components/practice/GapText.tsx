// Renders a sentence with "____" replaced by a styled blank.
export function GapText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split("____");
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="mx-1 inline-block min-w-[3.5rem] border-b-2 border-accent/70 align-baseline" />
          )}
        </span>
      ))}
    </span>
  );
}
