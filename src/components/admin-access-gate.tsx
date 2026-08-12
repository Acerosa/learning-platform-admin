"use client";

import { useState } from "react";
import { registrationValidationMessage } from "../services/supabase-admin-service";

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
  onSignUp,
  onMagicLink,
}: {
  message: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onMagicLink: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "create-account">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const switchMode = (nextMode: "sign-in" | "create-account") => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setValidationMessage(null);
  };

  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-labelledby="staff-sign-in-title">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <div className="access-tabs" role="tablist" aria-label="Administrator account access">
          <button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => switchMode("sign-in")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "create-account"} onClick={() => switchMode("create-account")}>Create account</button>
        </div>
        <h1 id="staff-sign-in-title">{mode === "sign-in" ? "Staff sign in" : "Create staff account"}</h1>
        <p>
          {mode === "sign-in"
            ? "Use an existing staff account. Access is granted only after the backend confirms an active platform administrator role."
            : "Create a Supabase Auth account. Administration access still requires secure backend provisioning."}
        </p>
        {validationMessage || message ? <div className="access-message" role="status">{validationMessage ?? message}</div> : null}
        <form
          className="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            setValidationMessage(null);
            if (mode === "create-account") {
              const validation = registrationValidationMessage(password, confirmPassword);
              if (validation) {
                setValidationMessage(validation);
                return;
              }
              void onSignUp(email.trim(), password);
              return;
            }
            void onSignIn(email.trim(), password);
          }}
        >
          <div>
            <label htmlFor="admin-email">Staff email</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {mode === "create-account" ? (
            <div>
              <label htmlFor="admin-confirm-password">Confirm password</label>
              <input id="admin-confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
          ) : null}
          <button className="button button--primary" type="submit">{mode === "sign-in" ? "Sign in" : "Create account"}</button>
          {mode === "sign-in" ? <button className="button button--secondary" type="button" disabled={!email.trim()} onClick={() => void onMagicLink(email.trim())}>Email a sign-in link</button> : null}
        </form>
      </section>
    </main>
  );
}

export function AdminAccessDenied({
  displayName,
  message,
  onClaimInitialAdmin,
  onSignOut,
}: {
  displayName: string;
  message: string | null;
  onClaimInitialAdmin: (bootstrapToken: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [bootstrapToken, setBootstrapToken] = useState("");

  return (
    <main className="access-page" id="admin-main">
      <section className="access-card">
        <span className="access-card__mark access-card__mark--warning" aria-hidden="true">!</span>
        <p className="eyebrow">Access denied</p>
        <h1>Platform administrator role required</h1>
        <p><strong>{displayName}</strong> is authenticated, but the backend did not grant this account platform administration access.</p>
        {message ? <div className="access-message" role="alert">{message}</div> : null}
        <div className="access-setup">
          <h2>Initial administrator setup</h2>
          <p>If you were issued the one-time setup code, enter it here. The backend will verify the code and your authenticated identity.</p>
          <form
            className="access-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onClaimInitialAdmin(bootstrapToken.trim());
            }}
          >
            <div>
              <label htmlFor="admin-bootstrap-token">One-time setup code</label>
              <input id="admin-bootstrap-token" name="bootstrap-token" type="password" autoComplete="off" required value={bootstrapToken} onChange={(event) => setBootstrapToken(event.target.value)} />
            </div>
            <button className="button button--primary" type="submit">Complete initial setup</button>
          </form>
        </div>
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
