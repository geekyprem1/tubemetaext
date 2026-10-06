import { formatDuration, formatGroupedCount } from '../../domain/format';
import type { Field, MetadataSnapshot } from '../../domain/metadata';
import { isAvailable } from '../../domain/metadata';
import { CONTENT_TYPE_LABELS, PLAYBACK_LABELS } from '../labels';

function fieldText(field: Field<string>): string | null {
  return isAvailable(field) && field.value.length > 0 ? field.value : null;
}

export function Details({ snapshot }: { snapshot: MetadataSnapshot }) {
  const rows: Array<{ label: string; value: string | null; link?: boolean }> = [
    { label: 'Video ID', value: snapshot.videoId },
    { label: 'Video URL', value: snapshot.videoUrl, link: true },
    { label: 'Channel name', value: fieldText(snapshot.channelName) },
    { label: 'Channel URL', value: fieldText(snapshot.channelUrl), link: true },
    { label: 'Thumbnail URL', value: fieldText(snapshot.thumbnailUrl), link: true },
    { label: 'Publish date', value: fieldText(snapshot.publishDate) },
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
    { label: 'Extracted at', value: snapshot.extractedAt },
  ];

  return (
    <section className="details" aria-label="Details">
      <h2>Details</h2>
      <dl>
        {rows.map((row) => (
          <div className="details-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.value === null ? (
                <span className="muted">Not available</span>
              ) : row.link ? (
                <a href={row.value} target="_blank" rel="noreferrer">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
