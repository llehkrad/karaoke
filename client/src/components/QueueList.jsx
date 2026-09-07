import { useSortableList } from "../useSortableList.js";

export default function QueueList({ queue, nowPlaying, onShuffle, onRemove, onReorder }) {
  const sortable = useSortableList({
    items: queue,
    getId: (item) => item.id,
    onReorder,
  });

  return (
    <div className="stack">
      {nowPlaying && (
        <div className="stack">
          <p className="text-dim" style={{ marginBottom: -4 }}>
            Now playing
          </p>
          <div className="queue-item now-playing">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{nowPlaying.title}</div>
              <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                Pitch {nowPlaying.pitch_semitones > 0 ? "+" : ""}
                {nowPlaying.pitch_semitones}
                {nowPlaying.added_by ? ` · picked by ${nowPlaying.added_by}` : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <p className="text-dim" style={{ margin: 0 }}>
          Up next ({queue.length})
        </p>
        {queue.length > 1 && (
          <button className="btn btn-secondary" onClick={onShuffle}>
            Shuffle
          </button>
        )}
      </div>

      {queue.length === 0 && (
        <p className="text-dim">No songs queued yet — search above to add one.</p>
      )}

      <div className="queue-list-items">
        {sortable.items.map((item, idx) => {
          const isActive = sortable.activeId === item.id;
          return (
            <div
              key={item.id}
              ref={sortable.setRowRef(item.id)}
              className={`queue-item ${isActive ? "dragging" : ""}`}
              style={isActive ? { transform: `translateY(${sortable.dragOffset}px)` } : undefined}
            >
              <span className="drag-handle" {...sortable.dragHandleProps(item.id)}>
                ⠿
              </span>
              <div className="queue-position">{idx + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{item.title}</div>
                <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                  Pitch {item.pitch_semitones > 0 ? "+" : ""}
                  {item.pitch_semitones}
                  {item.added_by ? ` · picked by ${item.added_by}` : ""}
                </div>
              </div>
              <button className="btn btn-danger" onClick={() => onRemove(item.id)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
