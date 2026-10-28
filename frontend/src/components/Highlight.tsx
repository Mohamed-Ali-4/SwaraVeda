/** Marks each query word inside the text, ignoring case. */
export default function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? <mark key={i} className="rounded bg-saffron-100 px-0.5 text-ink">{p}</mark> : <span key={i}>{p}</span>,
      )}
    </>
  );
}
