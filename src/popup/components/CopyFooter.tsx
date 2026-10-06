export function CopyFooter({
  enabled,
  copied,
  onCopyAll,
}: {
  enabled: boolean;
  copied: boolean;
  onCopyAll: () => void;
}) {
  return (
    <footer className="copy-footer">
      <button type="button" disabled={!enabled} onClick={onCopyAll}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="6" y="5" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {copied ? 'Copied all metadata' : 'Copy all metadata'}
      </button>
      <p>Includes available fields and video details</p>
    </footer>
  );
}
