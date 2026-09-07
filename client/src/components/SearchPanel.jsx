import { useState } from "react";
import { emitAsync } from "../socket.js";

export default function SearchPanel({ onPick }) {
  const [query, setQuery] = useState("");
  const [karaokeOnly, setKaraokeOnly] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    const finalQuery = karaokeOnly ? `${query} karaoke` : query;
    const res = await emitAsync("search_youtube", { query: finalQuery });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResults(res.results);
  }

  return (
    <div className="stack">
      <form onSubmit={search} className="stack">
        <input
          type="text"
          placeholder="Search for a song…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="row" style={{ fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={karaokeOnly}
            onChange={(e) => setKaraokeOnly(e.target.checked)}
            style={{ width: "auto" }}
          />
          Karaoke versions only
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="stack">
        {results.map((r) => (
          <div key={r.videoId} className="search-result" onClick={() => onPick(r)}>
            <img src={r.thumbnail} alt="" />
            <div>
              <div style={{ fontWeight: 500 }}>{r.title}</div>
              <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                {r.channelTitle}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
