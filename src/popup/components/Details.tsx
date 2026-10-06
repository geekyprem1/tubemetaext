import { formatDuration, formatGroupedCount } from '../../domain/format';
import type { Field, MetadataSnapshot } from '../../domain/metadata';
import { isAvailable } from '../../domain/metadata';
import { CONTENT_TYPE_LABELS, PLAYBACK_LABELS } from '../labels';

function fieldText(field: Field<string>): string | null {
  return isAvailable(field) && field.value.length > 0 ? field.value : null;
}

function displayDate(value: string | null, withTime = false): string | null {
  if (value === null) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

export function Details({ snapshot }: { snapshot: MetadataSnapshot }) {
  const rows: Array<{ label: string; value: string | null; linkLabel?: string }> = [
    { label: 'Video ID', value: snapshot.videoId },
    { label: 'Video URL', value: snapshot.videoUrl, linkLabel: 'Open video' },
    { label: 'Channel name', value: fieldText(snapshot.channelName) },
    { label: 'Channel URL', value: fieldText(snapshot.channelUrl), linkLabel: 'Open channel' },
    { label: 'Thumbnail URL', value: fieldText(snapshot.thumbnailUrl), linkLabel: 'Open thumbnail' },
    { label: 'Publish date', value: displayDate(fieldText(snapshot.publishDate)) },
    {
      label: 'Duration',
      value: isAvailable(snapshot.durationSeconds)
        ? formatDuration(snapshot.durationSeconds.value)
        : null,
    },
    {
      label: 'Views',
      value: isAvailable(snapshot.views) ? formatGroupedCount(snapshot.views.value) : null,
    },
    {
      label: 'Content type',
      value:
        snapshot.contentType === 'unknown'
          ? 'Unknown'
          : CONTENT_TYPE_LABELS[snapshot.contentType],
    },
    { label: 'Playback', value: PLAYBACK_LABELS[snapshot.playbackStatus] },
    { label: 'Extracted at', value: displayDate(snapshot.extractedAt, true) },
  ];

  return (
    <details className="details">
      <summary>
        <span>More video details</span>
        <span className="details-chevron" aria-hidden="true">⌄</span>
      </summary>
      <dl>
        {rows.map((row) => (
          <div className="details-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.value === null ? (
                <span className="muted">Not available</span>
              ) : row.linkLabel ? (
                <a href={row.value} target="_blank" rel="noreferrer" title={row.value}>
                  {row.linkLabel} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
