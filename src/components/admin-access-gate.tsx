"use client";

import { useState } from "react";
import { AUTH_USER_MESSAGES } from "../stores/admin-portal-auth";
import { registrationValidationMessage } from "../services/supabase-admin-service";

export function AdminLoadingState({
  title = "Connecting to the live backend",
  message = "Restoring the staff session and checking backend authority.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-live="polite">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <span className="loading-line" aria-hidden="true" />
      </section>
    </main>
  );
}

export function AdminSignIn({
  message,
  onSignIn,
  onMagicLink,
  onForgotPassword,
}: {
  message: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onMagicLink: (email: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const switchMode = (nextMode: "sign-in" | "forgot-password") => {
    setMode(nextMode);
    setPassword("");
    setValidationMessage(null);
  };

  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-labelledby="staff-sign-in-title">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <h1 id="staff-sign-in-title">
          {mode === "sign-in" ? "Staff sign in" : "Reset password"}
        </h1>
        <p>
          {mode === "sign-in"
            ? "Sign in with your staff email and password. Access is granted only after the backend confirms an active platform administrator role."
            : "Enter the email for your staff account. If an account exists, Supabase Auth will send a password reset link."}
        </p>
        {validationMessage || message ? (
          <div className="access-message" role="status">{validationMessage ?? message}</div>
        ) : null}
        <form
          className="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            setValidationMessage(null);
            if (mode === "forgot-password") {
              void onForgotPassword(email.trim());
              return;
            }
            void onSignIn(email.trim(), password);
          }}
        >
          <div>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {mode === "sign-in" ? (
            <div>
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : null}
          <button className="button button--primary" type="submit">
            {mode === "sign-in" ? "Sign in" : "Send reset email"}
          </button>
          {mode === "sign-in" ? (
            <>
              <button
                className="access-form__link"
                type="button"
                onClick={() => switchMode("forgot-password")}
              >
                Forgot password
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={!email.trim()}
                onClick={() => void onMagicLink(email.trim())}
              >
                Email me a sign-in link
              </button>
            </>
          ) : (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => switchMode("sign-in")}
            >
              Back to sign in
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

export function AdminPasswordReset({
  message,
  onUpdatePassword,
  onCancel,
}: {
  message: string | null;
  onUpdatePassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  return (
    <main className="access-page" id="admin-main">
      <section className="access-card" aria-labelledby="staff-reset-title">
        <span className="access-card__mark" aria-hidden="true">LP</span>
        <p className="eyebrow">Learning Platform Administration</p>
        <h1 id="staff-reset-title">Choose a new password</h1>
        <p>This recovery session is valid only for setting a new password. It does not grant Admin Portal access by itself.</p>
        {validationMessage || message ? (
          <div className="access-message" role="status">{validationMessage ?? message}</div>
        ) : null}
        <form
          className="access-form"
          onSubmit={(event) => {
            event.preventDefault();
            const validation = registrationValidationMessage(password, confirmPassword)
              ?? (password.trim() ? null : AUTH_USER_MESSAGES.passwordMismatch);
            if (validation) {
              setValidationMessage(validation);
              return;
            }
            setValidationMessage(null);
            void onUpdatePassword(password);
          }}
        >
          <div>
            <label htmlFor="admin-new-password">New password</label>
            <input
              id="admin-new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-confirm-password">Confirm password</label>
            <input
              id="admin-confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <button className="button button--primary" type="submit">Update password</button>
          <button className="button button--secondary" type="button" onClick={() => void onCancel()}>
            Cancel
          </button>
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
        <h1>Admin Portal access required</h1>
        <p>
          <strong>{displayName}</strong> is authenticated, but the backend did not grant this account
          platform administration access.
        </p>
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
