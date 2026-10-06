export function CopyFooter({ enabled, onCopyAll }: { enabled: boolean; onCopyAll: () => void }) {
  return (
    <footer className="copy-footer">
      <button type="button" disabled={!enabled} onClick={onCopyAll}>
        Copy available metadata
      </button>
    </footer>
  );
}
