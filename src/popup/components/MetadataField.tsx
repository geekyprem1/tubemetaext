import { useEffect, useRef, useState } from 'react';
import type { ProjectedField } from '../../domain/drafts';
import type { EditableFieldKey, FieldStatus } from '../../domain/metadata';
import { parseEditorText, toEditorText } from '../editor-text';

export interface MetadataFieldProps {
  label: string;
  fieldKey: EditableFieldKey;
  kind: 'text' | 'list';
  field: ProjectedField<string> | ProjectedField<string[]>;
  copyText: string | null;
  emptyMessage: string;
  unavailableMessage: string;
  onEdit: (field: EditableFieldKey, value: string | string[]) => void;
  onFlush: (field: EditableFieldKey) => void;
  onReset: (field: EditableFieldKey) => void;
  onCopy: (text: string) => void;
}

function statusMessage(status: FieldStatus, emptyMessage: string, unavailableMessage: string): string {
  if (status === 'empty') return emptyMessage;
  if (status === 'error') return "This field couldn't be read.";
  return unavailableMessage;
}

export function MetadataField({
  label,
  fieldKey,
  kind,
  field,
  copyText,
  emptyMessage,
  unavailableMessage,
  onEdit,
  onFlush,
  onReset,
  onCopy,
}: MetadataFieldProps) {
  const [text, setText] = useState(() => toEditorText(field.value));
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current?.contains(document.activeElement)) {
      setText(toEditorText(field.value));
    }
  }, [field.value]);

  const parsedList = kind === 'list' ? (parseEditorText(text, 'list') as string[]) : null;
  const count = parsedList ? `${parsedList.length} items` : `${text.length} characters`;
  const message = statusMessage(field.sourceStatus, emptyMessage, unavailableMessage);

  function handleChange(next: string) {
    setText(next);
    onEdit(fieldKey, parseEditorText(next, kind));
  }

  return (
    <section className="field" aria-label={label} ref={sectionRef}>
      <div className="field-heading">
        <strong>{label}</strong>
        <div className="field-badges">
          {field.edited ? <span className="badge">Edited</span> : null}
          {field.isPartial ? <span className="badge badge-partial">Partial</span> : null}
        </div>
        {field.edited ? (
          <button
            type="button"
            className="small-button"
            aria-label={`Reset ${label.toLowerCase()}`}
            onClick={() => onReset(fieldKey)}
          >
            Reset
          </button>
        ) : null}
        <button
          type="button"
          className="small-button"
          aria-label={`Copy ${label.toLowerCase()}`}
          disabled={copyText === null}
          onClick={() => {
            if (copyText !== null) onCopy(copyText);
          }}
        >
          Copy
        </button>
      </div>
      {kind === 'text' && fieldKey === 'title' ? (
        <input
          className="field-input"
          type="text"
          value={text}
          aria-label={label}
          placeholder={message}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => onFlush(fieldKey)}
        />
      ) : (
        <textarea
          className="field-input"
          rows={kind === 'text' ? 5 : 4}
          value={text}
          aria-label={kind === 'list' ? `${label} (one token per line)` : label}
          placeholder={message}
          spellCheck={false}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => onFlush(fieldKey)}
        />
      )}
      <p className="field-count">
        {kind === 'list' ? 'One token per line · ' : ''}
        {count}
      </p>
    </section>
  );
}
