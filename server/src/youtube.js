const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

// The YouTube Data API returns snippet titles/channel names pre-escaped as
// HTML (e.g. "Fool&#39;s Garden", "Huey Lewis &amp; The News") — decode the
// handful of XML-predefined entities it actually uses before this reaches
// storage/display, since nothing downstream (React text rendering, SQLite)
// decodes HTML entities on its own.
function decodeHtmlEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Searches YouTube for videos matching `query`. Callers typically append
 * "karaoke" themselves in the query text (e.g. from the UI's search box),
 * since "karaoke version" isn't a distinct YouTube category — it's just
 * a normal search term convention.
 */
export async function searchYoutube(query, maxResults = 12) {
  if (!YT_API_KEY) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Get one from https://console.cloud.google.com/apis/credentials " +
        "(enable 'YouTube Data API v3' first) and set it in your .env file."
    );
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", YT_API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
  const data = await res.json();

  return (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
  }));
}
