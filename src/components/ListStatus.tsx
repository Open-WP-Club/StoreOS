/** Visually hidden polite live region announcing list loading / result-count changes. */
export default function ListStatus({
  loading,
  count,
  noun,
}: {
  loading: boolean;
  count: number;
  noun: string;
}): React.ReactElement {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {loading ? `Loading ${noun}…` : `${count} ${noun} found`}
    </div>
  );
}
