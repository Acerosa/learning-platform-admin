"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLink } from "../components/admin-link";
import { DataSourceBanner } from "../components/data-source-banner";
import {
  getAdminModule,
  getModuleHref,
  primaryNavigationModules,
  resolveNavigationModule,
  type AdminModuleId,
  type PrimaryNavigationId,
} from "../router/modules";
import type { AdminDataSourceStatus } from "../stores/admin-portal";
import type { AdminSessionSnapshot } from "../stores/admin-session";
import { usePlatformTheme } from "../theme/use-platform-theme";

export function AdminShell({
  activeModule,
  session,
  dataSource,
  onSignOut,
  children,
}: {
  activeModule: AdminModuleId;
  session: AdminSessionSnapshot;
  dataSource: AdminDataSourceStatus;
  onSignOut?: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, toggleTheme } = usePlatformTheme();
  const navigationModule = resolveNavigationModule(activeModule);
  const currentModule = getAdminModule(navigationModule);
  const primaryModules = primaryNavigationModules();
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return primaryModules.filter((module) =>
      `${module.label} ${module.description}`.toLowerCase().includes(query),
    ).slice(0, 6);
  }, [search, primaryModules]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (
        event.key === "/"
        && !event.metaKey
        && !event.ctrlKey
        && !(event.target instanceof HTMLInputElement)
        && !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="admin-app">
      <a className="skip-link" href="#admin-main">Skip to main content</a>
      <aside className={`admin-sidebar${navigationOpen ? " admin-sidebar--open" : ""}`} aria-label="Administration navigation">
        <div className="admin-brand">
          <span className="admin-brand__mark" aria-hidden="true"><span>LP</span></span>
          <span><strong>Learning Platform</strong><small>Administration</small></span>
        </div>
        <nav className="admin-navigation">
          <section className="admin-navigation__group" aria-labelledby="nav-primary">
            <h2 id="nav-primary" className="sr-only">Primary navigation</h2>
            <ul>
              {primaryModules.map((module) => (
                <li key={module.id}>
                  <AdminLink
                    href={getModuleHref(module.id as PrimaryNavigationId)}
                    aria-current={navigationModule === module.id ? "page" : undefined}
                    onClick={() => setNavigationOpen(false)}
                  >
                    <span className="admin-navigation__icon" aria-hidden="true">{module.shortLabel}</span>
                    <span>{module.label}</span>
                    {module.dataState === "pending" ? <span className="admin-navigation__pending" aria-label="Integration pending" /> : null}
                  </AdminLink>
                </li>
              ))}
            </ul>
          </section>
        </nav>
        <div className="admin-sidebar__footer">
          <span className="environment-pill"><span aria-hidden="true" /> {dataSource.mode === "live" ? "Live" : "Demo"}</span>
          <small>Portal 0.2.0</small>
        </div>
      </aside>
      {navigationOpen ? <button className="navigation-backdrop" type="button" onClick={() => setNavigationOpen(false)} aria-label="Close navigation" /> : null}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="icon-button admin-topbar__menu"
            type="button"
            aria-label="Open navigation"
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="admin-topbar__context">
            <span>Administration</span>
            <strong>{currentModule.label}</strong>
          </div>
          <div className="admin-search">
            <label className="sr-only" htmlFor="admin-global-search">Search administration areas</label>
            <span aria-hidden="true" className="admin-search__icon">⌕</span>
            <input
              id="admin-global-search"
              ref={searchRef}
              type="search"
              placeholder="Search areas"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
            <kbd aria-hidden="true">/</kbd>
            {searchResults.length ? (
              <ul className="admin-search__results" aria-label="Search results">
                {searchResults.map((module) => (
                  <li key={module.id}>
                    <AdminLink href={getModuleHref(module.id as PrimaryNavigationId)} onClick={() => setSearch("")}>
                      <strong>{module.label}</strong>
                      <span>{module.description}</span>
                    </AdminLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Use ${resolvedTheme === "dark" ? "light" : "dark"} theme`} title="Switch theme">
            <span aria-hidden="true">{resolvedTheme === "dark" ? "☀" : "◐"}</span>
          </button>
          <div className="admin-profile" aria-label="Current administration context">
            <span className="admin-profile__avatar" aria-hidden="true">{session.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            <span><strong>{session.displayName}</strong><small>{session.source === "backend" ? session.roleLabels.join(", ") : "Demonstration context"}</small></span>
          </div>
          {onSignOut ? <button className="button button--small button--secondary admin-sign-out" type="button" onClick={() => void onSignOut()}>Sign out</button> : null}
        </header>
        <DataSourceBanner status={dataSource} />
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
