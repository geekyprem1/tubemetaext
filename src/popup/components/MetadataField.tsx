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
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTitle = fieldKey === 'title';
  const list = Array.isArray(field.value) ? field.value : null;
  const previewText = typeof field.value === 'string' ? field.value : '';
  const isEmpty = field.value === null || (list ? list.length === 0 : previewText.length === 0);
  const message = field.edited && isEmpty
    ? emptyMessage
    : statusMessage(field.sourceStatus, emptyMessage, unavailableMessage);
  const parsedList = kind === 'list' ? (parseEditorText(text, 'list') as string[]) : null;
  const count = parsedList ? `${parsedList.length} items` : `${text.length} characters`;
  const itemCount = list
    ? `${list.length} ${list.length === 1 ? fieldKey.slice(0, -1) : fieldKey}`
    : null;

  useEffect(() => {
    if (document.activeElement !== titleInputRef.current && document.activeElement !== textareaRef.current) {
      setText(toEditorText(field.value));
    }
  }, [field.value]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function handleChange(next: string) {
    setText(next);
    onEdit(fieldKey, parseEditorText(next, kind));
  }

  return (
    <section className={`field field-${fieldKey}`} aria-label={label}>
      <div className="field-heading">
        <div className="field-label-group">
          <h2>{label}</h2>
          {itemCount ? <span className="field-item-count">{itemCount}</span> : null}
          {field.edited ? <span className="badge">Edited</span> : null}
          {field.isPartial ? (
            <span className="badge badge-partial" title="Some source text was unavailable">
              Partial
            </span>
          ) : null}
        </div>
        <div className="field-actions">
          {field.edited ? (
            <button
              type="button"
              className="quiet-button"
              aria-label={`Reset ${label.toLowerCase()}`}
              onClick={() => {
                setEditing(false);
                onReset(fieldKey);
              }}
            >
              Reset
            </button>
          ) : null}
          {!isTitle ? (
            <button
              type="button"
              className="quiet-button"
              aria-expanded={editing}
              onClick={() => {
                if (editing) onFlush(fieldKey);
                setEditing(!editing);
              }}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          ) : null}
          <button
            type="button"
            className="quiet-button copy-button"
            aria-label={`Copy ${label.toLowerCase()}`}
            disabled={copyText === null}
            onClick={() => {
              if (copyText !== null) onCopy(copyText);
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {isTitle ? (
        <div className="field-editor title-editor">
          <input
            ref={titleInputRef}
            className="field-input"
            type="text"
            value={text}
            aria-label={label}
            placeholder={message}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={() => onFlush(fieldKey)}
          />
          <span className="field-count">{count}</span>
        </div>
      ) : editing ? (
        <div className="field-editor">
          <textarea
            ref={textareaRef}
            className="field-input"
            rows={kind === 'text' ? 7 : 5}
            value={text}
            aria-label={kind === 'list' ? `${label} (one item per line)` : label}
            placeholder={message}
            spellCheck={kind === 'text'}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={() => onFlush(fieldKey)}
          />
          <span className="field-count">
            {kind === 'list' ? 'One item per line · ' : ''}{count}
          </span>
        </div>
      ) : kind === 'list' && list && list.length > 0 ? (
        <div className="token-list" aria-label={`${label} preview`}>
          {list.slice(0, 3).map((token, index) => (
            <span className="token" key={`${token}-${index}`} title={token}>{token}</span>
          ))}
          {list.length > 3 ? <span className="token token-more">+{list.length - 3}</span> : null}
        </div>
      ) : !isEmpty ? (
        <div className="field-preview">
          <p className={expanded ? 'field-preview-text is-expanded' : 'field-preview-text'}>
            {previewText}
          </p>
          {previewText.length > 180 ? (
            <button
              type="button"
              className="expand-button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : 'Show full description'}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="field-empty">{message}</p>
      )}
    </section>
  );
}
