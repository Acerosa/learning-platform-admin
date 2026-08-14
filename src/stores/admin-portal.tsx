"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AdminDataSnapshot, HubRegistrationResult, PlatformPublicationResult } from "../api/admin-api";
import type { AuthoringDraft } from "../content/types";
import type { HubRegistrationRequest } from "../content/hub-registration";
import { registerDemoHub, updateDemoHub } from "../content/hub-registration";
import {
  DEMO_ADMIN_DATA,
  DEMO_DATA_NOTICE,
} from "../services/demo-admin-service";
import {
  getAdminRuntimeConfig,
  type AdminRuntimeConfig,
} from "../services/admin-runtime-config";
import {
  AdminHubRegistrationError,
  AdminPublicationError,
  AdminReadError,
  claimInitialPlatformAdmin,
  createSupabaseAdminClient,
  createSupabaseAdminReadService,
  loadAdminData,
  publishCurriculum as publishCurriculumRpc,
  registerAdminAccount,
  registerHub as registerHubRpc,
  updateHub as updateHubRpc,
  type AdminSupabaseClient,
} from "../services/supabase-admin-service";
import {
  DEMO_ADMIN_SESSION,
  SIGNED_OUT_ADMIN_SESSION,
  sessionFromStaffContext,
  type AdminSessionSnapshot,
} from "./admin-session";

export type AdminPortalStatus =
  | "loading"
  | "ready"
  | "signed-out"
  | "access-denied"
  | "error";

export interface AdminDataSourceStatus {
  mode: "demo" | "live";
  state: "ready" | "loading" | "unavailable";
  title: string;
  message: string;
}

interface AdminPortalContextValue {
  config: AdminRuntimeConfig;
  status: AdminPortalStatus;
  session: AdminSessionSnapshot;
  data: AdminDataSnapshot | null;
  dataSource: AdminDataSourceStatus;
  authMessage: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  requestMagicLink(email: string): Promise<void>;
  claimInitialAdmin(bootstrapToken: string): Promise<void>;
  registerHub(request: HubRegistrationRequest): Promise<HubRegistrationResult>;
  updateHub(request: HubRegistrationRequest): Promise<HubRegistrationResult>;
  publishCurriculum(record: AuthoringDraft): Promise<PlatformPublicationResult>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
}

interface PortalState {
  status: AdminPortalStatus;
  session: AdminSessionSnapshot;
  data: AdminDataSnapshot | null;
  message: string | null;
}

const AdminPortalContext = createContext<AdminPortalContextValue | null>(null);

function unavailableSession(): AdminSessionSnapshot {
  return {
    state: "error",
    displayName: "Administration unavailable",
    staffReference: null,
    roleLabels: [],
    grantedActions: [],
    source: "unavailable",
  };
}

function redirectUrl() {
  if (typeof window === "undefined") return undefined;
  const usesHashRouting = document.querySelector(
    'meta[name="learning-platform-admin-router"][content="hash"]',
  );
  const path = usesHashRouting ? window.location.pathname : "/";
  return new URL(path, window.location.origin).toString();
}

function resultFromDemoHub(registered: { result: { hub: NonNullable<AdminDataSnapshot["hubs"][number]>; courseKeys: readonly string[] } }): HubRegistrationResult {
  return {
    hubCode: registered.result.hub.hubCode,
    hubName: registered.result.hub.hubName,
    description: registered.result.hub.description,
    hubVersion: registered.result.hub.hubVersion,
    manifestVersion: registered.result.hub.manifestVersion,
    coreVersion: registered.result.hub.coreVersion,
    learnerApiVersion: registered.result.hub.learnerApiVersion,
    submissionContractVersion: registered.result.hub.submissionContractVersion,
    platformVersion: registered.result.hub.platformVersion,
    repositoryUrl: registered.result.hub.repositoryUrl,
    deploymentUrl: registered.result.hub.deploymentUrl,
    activityTypes: registered.result.hub.activityTypes,
    evidenceCapabilities: registered.result.hub.evidenceCapabilities,
    features: registered.result.hub.features,
    compatibility: registered.result.hub.compatibility,
    status: registered.result.hub.status,
    active: registered.result.hub.active,
    courseKeys: registered.result.courseKeys,
  };
}

export function AdminPortalProvider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => getAdminRuntimeConfig(), []);
  const [client] = useState<AdminSupabaseClient | null>(() =>
    config.mode === "live" && config.valid
      ? createSupabaseAdminClient(config)
      : null,
  );
  const [state, setState] = useState<PortalState>(() => {
    if (config.mode === "demo" && config.valid) {
      return {
        status: "ready",
        session: DEMO_ADMIN_SESSION,
        data: DEMO_ADMIN_DATA,
        message: null,
      };
    }
    if (!config.valid) {
      return {
        status: "error",
        session: unavailableSession(),
        data: null,
        message: config.message,
      };
    }
    return {
      status: "loading",
      session: { ...SIGNED_OUT_ADMIN_SESSION, state: "loading" },
      data: null,
      message: null,
    };
  });

  const refresh = useCallback(async () => {
    if (!client) return;
    setState((current) => ({
      ...current,
      status: "loading",
      data: null,
      message: null,
    }));

    const { data: authData, error: authError } = await client.auth.getSession();
    if (authError) {
      setState({
        status: "error",
        session: unavailableSession(),
        data: null,
        message: "The authentication service is currently unavailable.",
      });
      return;
    }

    if (!authData.session) {
      setState({
        status: "signed-out",
        session: SIGNED_OUT_ADMIN_SESSION,
        data: null,
        message: null,
      });
      return;
    }

    const service = createSupabaseAdminReadService(client);
    try {
      const staffContext = await service.getCurrentStaffContext();
      const session = sessionFromStaffContext(staffContext);
      if (session.state !== "authenticated") {
        setState({
          status: "access-denied",
          session,
          data: null,
          message:
            "This authenticated account does not have an active platform administrator role.",
        });
        return;
      }

      const data = await loadAdminData(service);
      setState({ status: "ready", session, data, message: null });
    } catch (error) {
      const denied = error instanceof AdminReadError && error.code === "access-denied";
      setState({
        status: denied ? "access-denied" : "error",
        session: denied
          ? { ...SIGNED_OUT_ADMIN_SESSION, state: "access-denied" }
          : unavailableSession(),
        data: null,
        message: denied
          ? "The backend denied access to administrative data."
          : "Live administrative data is currently unavailable. No demo data has been substituted.",
      });
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const { data } = client.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0);
    });
    return () => {
      window.clearTimeout(initialRefresh);
      data.subscription.unsubscribe();
    };
  }, [client, refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) return;
    setState((current) => ({ ...current, status: "loading", message: null }));
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setState({
        status: "signed-out",
        session: SIGNED_OUT_ADMIN_SESSION,
        data: null,
        message: "Sign-in failed. Check the account details and try again.",
      });
      return;
    }
    await refresh();
  }, [client, refresh]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!client) return;
    setState((current) => ({ ...current, status: "loading", message: null }));
    try {
      const result = await registerAdminAccount(
        client,
        email,
        password,
        redirectUrl() ?? window.location.origin,
      );
      if (result.confirmationRequired) {
        setState({
          status: "signed-out",
          session: SIGNED_OUT_ADMIN_SESSION,
          data: null,
          message:
            "Check your email to confirm the account, then sign in. Account creation does not grant administration access by itself.",
        });
        return;
      }
      await refresh();
    } catch {
      setState({
        status: "signed-out",
        session: SIGNED_OUT_ADMIN_SESSION,
        data: null,
        message:
          "The account could not be created. Check the details and try again, or sign in if the account already exists.",
      });
    }
  }, [client, refresh]);

  const requestMagicLink = useCallback(async (email: string) => {
    if (!client) return;
    setState((current) => ({ ...current, status: "loading", message: null }));
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectUrl(),
      },
    });
    setState({
      status: "signed-out",
      session: SIGNED_OUT_ADMIN_SESSION,
      data: null,
      message: error
        ? "A sign-in link could not be sent. Check the staff email and try again."
        : "Check the staff inbox for a time-limited sign-in link.",
    });
  }, [client]);

  const claimInitialAdmin = useCallback(async (bootstrapToken: string) => {
    if (!client) return;
    setState((current) => ({
      ...current,
      status: "loading",
      data: null,
      message: null,
    }));
    try {
      await claimInitialPlatformAdmin(client, bootstrapToken);
      await refresh();
    } catch {
      setState((current) => ({
        ...current,
        status: "access-denied",
        data: null,
        message:
          "Initial administrator setup could not be completed. Check the one-time setup code or contact the platform owner.",
      }));
    }
  }, [client, refresh]);

  const registerHub = useCallback(async (request: HubRegistrationRequest) => {
    if (!client) {
      if (config.mode !== "demo") {
        throw new AdminHubRegistrationError("unavailable");
      }
      const current = state.data ?? DEMO_ADMIN_DATA;
      try {
        const registered = registerDemoHub(current, request);
        setState((existing) => (
          existing.status === "ready"
            ? { ...existing, data: registered.snapshot }
            : existing
        ));
        return resultFromDemoHub(registered);
      } catch (caught) {
        throw new AdminHubRegistrationError(
          caught instanceof Error ? caught.message : "registration-failed",
        );
      }
    }
    const result = await registerHubRpc(client, request);
    const service = createSupabaseAdminReadService(client);
    const data = await loadAdminData(service);
    setState((current) => (
      current.status === "ready" ? { ...current, data } : current
    ));
    return result;
  }, [client, config.mode, state.data]);

  const updateHub = useCallback(async (request: HubRegistrationRequest) => {
    if (!client) {
      if (config.mode !== "demo") {
        throw new AdminHubRegistrationError("unavailable");
      }
      const current = state.data ?? DEMO_ADMIN_DATA;
      try {
        const updated = updateDemoHub(current, request);
        setState((existing) => (
          existing.status === "ready"
            ? { ...existing, data: updated.snapshot }
            : existing
        ));
        return resultFromDemoHub(updated);
      } catch (caught) {
        throw new AdminHubRegistrationError(
          caught instanceof Error ? caught.message : "registration-failed",
        );
      }
    }
    const result = await updateHubRpc(client, request);
    const service = createSupabaseAdminReadService(client);
    const data = await loadAdminData(service);
    setState((current) => (
      current.status === "ready" ? { ...current, data } : current
    ));
    return result;
  }, [client, config.mode, state.data]);

  const publishCurriculum = useCallback(async (record: AuthoringDraft) => {
    if (!client) {
      throw new AdminPublicationError("unavailable");
    }
    const result = await publishCurriculumRpc(client, record);
    const service = createSupabaseAdminReadService(client);
    const data = await loadAdminData(service);
    setState((current) => (
      current.status === "ready" ? { ...current, data } : current
    ));
    return result;
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setState({
      status: "signed-out",
      session: SIGNED_OUT_ADMIN_SESSION,
      data: null,
      message: null,
    });
  }, [client]);

  const dataSource = useMemo<AdminDataSourceStatus>(() => {
    if (config.mode === "demo") {
      return {
        mode: "demo",
        state: "ready",
        title: DEMO_DATA_NOTICE.title,
        message: DEMO_DATA_NOTICE.message,
      };
    }
    if (state.status === "ready") {
      return {
        mode: "live",
        state: "ready",
        title: "Live backend",
        message: "Authenticated, RLS-protected reads from the admin_api schema.",
      };
    }
    if (state.status === "loading") {
      return {
        mode: "live",
        state: "loading",
        title: "Connecting to live backend",
        message: "Restoring the staff session and loading authorised admin_api data.",
      };
    }
    return {
      mode: "live",
      state: "unavailable",
      title: "Live backend unavailable",
      message:
        state.message ?? "Administrative data could not be loaded safely.",
    };
  }, [config.mode, state.message, state.status]);

  const value = useMemo<AdminPortalContextValue>(() => ({
    config,
    status: state.status,
    session: state.session,
    data: state.data,
    dataSource,
    authMessage: state.message,
    signIn,
    signUp,
    requestMagicLink,
    claimInitialAdmin,
    registerHub,
    updateHub,
    publishCurriculum,
    signOut,
    retry: refresh,
  }), [claimInitialAdmin, config, dataSource, publishCurriculum, refresh, registerHub, requestMagicLink, signIn, signOut, signUp, state, updateHub]);

  return (
    <AdminPortalContext.Provider value={value}>
      {children}
    </AdminPortalContext.Provider>
  );
}

export function useAdminPortal() {
  const context = useContext(AdminPortalContext);
  if (!context) {
    throw new Error("useAdminPortal must be used inside AdminPortalProvider.");
  }
  return context;
}
