"use client";

export default function Error({ error, reset }) {
  const clearAndReload = () => {
    try { localStorage.removeItem("renovationWages"); } catch (e) {}
    if (typeof window !== "undefined") window.location.reload();
  };
  return (
    <div className="wrap">
      <div className="card">
        <h2>Something went wrong</h2>
        <p className="small muted">The app hit an unexpected error. Try again first — your saved data is safe.</p>
        <div className="rowbtns">
          <button className="btn primary" onClick={() => reset()}>Try again</button>
          <button className="btn" onClick={() => typeof window !== "undefined" && window.location.reload()}>Reload page</button>
        </div>
        <div className="divider" />
        <p className="small muted">Still broken after reload? This clears the saved data on this device and reloads the starting data (use only if the page won’t open at all):</p>
        <button className="btn warn" onClick={clearAndReload}>Clear saved data &amp; reload</button>
      </div>
    </div>
  );
}
