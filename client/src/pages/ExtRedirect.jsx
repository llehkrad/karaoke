import { useEffect } from "react";

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/dbakpahjhjbllhhnffgdinnalcmbiapi";

export default function ExtRedirect() {
  useEffect(() => {
    document.title = "Opening Pitch Sync extension… - Sing!";
    window.location.replace(EXTENSION_URL);
  }, []);

  return (
    <div className="guest-page" style={{ textAlign: "center", paddingTop: "4rem" }}>
      <p>
        Redirecting to the Pitch Sync Chrome extension…{" "}
        <a href={EXTENSION_URL}>Click here if you're not redirected.</a>
      </p>
    </div>
  );
}
