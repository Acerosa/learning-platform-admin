"use client";

import { useState } from "react";

export function AdminLoadingState() {
  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-live="polite">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <h1>Connecting to the live backend</h1>
        <p>Restoring the staff session and checking backend authority.</p>
        <span className="loading-line" aria-hidden="true" />
      </section>
    </main>
  );
}

export function AdminSignIn({
  message,
  onSignIn,
  onMagicLink,
}: {
  message: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onMagicLink: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-labelledby="staff-sign-in-title">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <h1 id="staff-sign-in-title">Staff sign in</h1>
        <p>Use an existing staff account. Access is granted only after the backend confirms an active platform administrator role.</p>
        {message ? <div className="access-message" role="status">{message}</div> : null}
        <form
          className="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSignIn(email.trim(), password);
          }}
        >
          <div>
            <label htmlFor="admin-email">Staff email</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="button button--primary" type="submit">Sign in</button>
          <button className="button button--secondary" type="button" disabled={!email.trim()} onClick={() => void onMagicLink(email.trim())}>Email a sign-in link</button>
        </form>
      </section>
    </main>
  );
}

export function AdminAccessDenied({
  displayName,
  message,
  onSignOut,
}: {
  displayName: string;
  message: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <main className="access-page" id="admin-main">
      <section className="access-card">
        <span className="access-card__mark access-card__mark--warning" aria-hidden="true">!</span>
        <p className="eyebrow">Access denied</p>
        <h1>Platform administrator role required</h1>
        <p><strong>{displayName}</strong> is authenticated, but the backend did not grant this account platform administration access.</p>
        {message ? <div className="access-message" role="alert">{message}</div> : null}
        <button className="button button--secondary" type="button" onClick={() => void onSignOut()}>Sign out</button>
      </section>
    </main>
  );
}

export function AdminUnavailable({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => Promise<void>;
}) {
  return (
    <main className="access-page" id="admin-main">
      <section className="access-card">
        <span className="access-card__mark access-card__mark--warning" aria-hidden="true">!</span>
        <p className="eyebrow">Live backend</p>
        <h1>Administration is unavailable</h1>
        <p>{message ?? "The live administrative service could not be reached safely."}</p>
        <p className="access-card__detail">Synthetic data has not been substituted.</p>
        <button className="button button--primary" type="button" onClick={() => void onRetry()}>Try again</button>
      </section>
    </main>
  );
}
