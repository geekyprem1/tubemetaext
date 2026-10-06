import { formatDuration, formatGroupedCount } from '../../domain/format';
import type { MetadataSnapshot } from '../../domain/metadata';
import { isAvailable } from '../../domain/metadata';
import { CONTENT_TYPE_LABELS } from '../labels';

export function VideoSummary({
  snapshot,
  stale = false,
  refreshing = false,
}: {
  snapshot: MetadataSnapshot;
  stale?: boolean;
  refreshing?: boolean;
}) {
  const title = isAvailable(snapshot.title) ? snapshot.title.value : 'Metadata unavailable';
  const channel = isAvailable(snapshot.channelName) ? snapshot.channelName.value : null;
  const duration = isAvailable(snapshot.durationSeconds)
    ? formatDuration(snapshot.durationSeconds.value)
    : null;
  const views = isAvailable(snapshot.views) ? `${formatGroupedCount(snapshot.views.value)} views` : null;
  const thumbnail = isAvailable(snapshot.thumbnailUrl) ? snapshot.thumbnailUrl.value : null;
  const parts = [channel, duration, views].filter(
    (part): part is string => part !== null,
  );

  return (
    <section className="video-card" aria-label="Current video">
      <div className="video-card-topline">
        <span className="section-eyebrow">CURRENT VIDEO</span>
        <span className={`source-state${stale ? ' source-state-stale' : ''}`}>
          <span className="source-state-dot" aria-hidden="true" />
          {stale ? 'Previous data' : refreshing ? 'Refreshing' : 'Ready to copy'}
        </span>
      </div>
      <div className="video-card-content">
        {thumbnail ? (
          <img className="summary-thumb" src={thumbnail} alt="" />
        ) : (
          <div className="summary-thumb summary-thumb-empty" aria-hidden="true" />
        )}
        <div className="summary-text">
          <span className="video-type">{CONTENT_TYPE_LABELS[snapshot.contentType]}</span>
          <strong className="summary-title" title={title}>{title}</strong>
          {parts.length > 0 ? <span className="summary-details">{parts.join(' · ')}</span> : null}
        </div>
      </div>
    </section>
  );
}
