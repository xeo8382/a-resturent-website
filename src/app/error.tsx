"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-wrap empty-state">
      <h1>Something needs a little attention.</h1>
      <p>
        We couldn’t load this page. Check that the database is running, then try
        again.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
