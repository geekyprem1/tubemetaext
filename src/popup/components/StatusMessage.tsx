export function StatusMessage({ text }: { text: string }) {
  return (
    <div className="status" role="status" aria-live="polite">
      {text}
    </div>
  );
}
