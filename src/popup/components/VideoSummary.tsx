import { formatDuration, formatGroupedCount } from '../../domain/format';
import type { MetadataSnapshot } from '../../domain/metadata';
import { isAvailable } from '../../domain/metadata';
import { CONTENT_TYPE_LABELS } from '../labels';

export function VideoSummary({ snapshot }: { snapshot: MetadataSnapshot }) {
  const title = isAvailable(snapshot.title) ? snapshot.title.value : 'Metadata unavailable';
  const channel = isAvailable(snapshot.channelName) ? snapshot.channelName.value : null;
  const duration = isAvailable(snapshot.durationSeconds)
    ? formatDuration(snapshot.durationSeconds.value)
    : null;
  const views = isAvailable(snapshot.views) ? `${formatGroupedCount(snapshot.views.value)} views` : null;
  const thumbnail = isAvailable(snapshot.thumbnailUrl) ? snapshot.thumbnailUrl.value : null;
  const parts = [CONTENT_TYPE_LABELS[snapshot.contentType], duration, views].filter(
    (part): part is string => part !== null,
  );

  return (
    <section className="summary" aria-label="Video summary">
      {thumbnail ? (
        <img className="summary-thumb" src={thumbnail} alt="" />
      ) : (
        <div className="summary-thumb summary-thumb-empty" aria-hidden="true" />
      )}
      <div className="summary-text">
        <strong className="summary-title">{title}</strong>
        {channel ? <span className="summary-channel">{channel}</span> : null}
        <span className="summary-details">{parts.join(' · ')}</span>
      </div>
    </section>
  );
}
