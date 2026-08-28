"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type {
  AdminDataSnapshot,
  HubRegistrationResult,
  PlatformPublicationResult,
  ReviewResponseRequest,
  ReviewResponseResult,
  CurriculumDraftSaveResult,
  CurrentCurriculumPackageRecord,
} from "../api/admin-api";
import type {
  AdminBootstrapData,
  AdminModuleCacheState,
  AdminModuleDataKey,
  AdminModulePayload,
} from "../api/admin-module-data";
import {
  createEmptyModuleCache,
  mergeModuleCacheToSnapshot,
  sliceDemoModuleData,
} from "../api/admin-module-data";
import type { AuthoringDraft, ContentPackage } from "../content/types";
import { authoringDraftFromRemote } from "../content/versioning";
import type { HubRegistrationRequest } from "../content/hub-registration";
import { registerDemoHub, updateDemoHub } from "../content/hub-registration";
import {
  DEMO_ADMIN_DATA,
  DEMO_DATA_NOTICE,
  demoAdminService,
} from "../services/demo-admin-service";
import {
  getAdminRuntimeConfig,
  type AdminRuntimeConfig,
} from "../services/admin-runtime-config";
import {
  AdminHubRegistrationError,
  AdminPublicationError,
  AdminReadError,
  AdminReviewError,
  claimInitialPlatformAdmin,
  createSupabaseAdminClient,
  createSupabaseAdminReadService,
  publishCurriculum as publishCurriculumRpc,
  saveCurriculumDraft as saveCurriculumDraftRpc,
  loadCurrentCurriculumPackage as loadCurrentCurriculumPackageRpc,
  getCurriculumDraft as getCurriculumDraftRpc,
  discardCurriculumDraft as discardCurriculumDraftRpc,
  registerAdminAccount,
  registerHub as registerHubRpc,
  reviewResponse as reviewResponseRpc,
  updateHub as updateHubRpc,
  type AdminSupabaseClient,
} from "../services/supabase-admin-service";
import {
  markBootstrapCompleted,
  markBootstrapStarted,
  markModuleLoadCompleted,
  markModuleLoadStarted,
  recordModuleCacheHit,
  resetAdminModulePerformance,
} from "../services/admin-module-performance";
import {
  CURRICULUM_MUTATION_INVALIDATES,
  fetchAdminBootstrapData,
  fetchModuleData,
  HUB_MUTATION_INVALIDATES,
  invalidateModuleCache,
  isModuleReady,
  moduleStatusForLoad,
  REVIEW_MUTATION_INVALIDATES,
  setModuleCacheEntry,
} from "./admin-module-loader";
import {
  DEMO_ADMIN_SESSION,
  SIGNED_OUT_ADMIN_SESSION,
  sessionFromStaffContext,
  type AdminSessionSnapshot,
} from "./admin-session";
import {
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldPreservePortalDataOnRefresh,
} from "./admin-portal-auth";

export type AdminPortalStatus =
  | "loading"
  | "ready"
  | "signed-out"
  | "access-denied"
  | "error";

export interface AdminDataSourceStatus {
  mode: "demo" | "live";
  state: "ready" | "loading" | "refreshing" | "unavailable";
  title: string;
  message: string;
}

interface AdminPortalContextValue {
  config: AdminRuntimeConfig;
  status: AdminPortalStatus;
  session: AdminSessionSnapshot;
  bootstrapReady: boolean;
  bootstrap: AdminBootstrapData | null;
  moduleCache: AdminModuleCacheState;
  data: AdminDataSnapshot | null;
  refreshing: boolean;
  dataSource: AdminDataSourceStatus;
  authMessage: string | null;
  ensureModuleData(key: AdminModuleDataKey): Promise<void>;
  refreshModuleData(key: AdminModuleDataKey): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  requestMagicLink(email: string): Promise<void>;
  claimInitialAdmin(bootstrapToken: string): Promise<void>;
  registerHub(request: HubRegistrationRequest): Promise<HubRegistrationResult>;
  updateHub(request: HubRegistrationRequest): Promise<HubRegistrationResult>;
  publishCurriculum(record: AuthoringDraft): Promise<PlatformPublicationResult>;
  saveCurriculumDraft(record: AuthoringDraft): Promise<CurriculumDraftSaveResult>;
  loadCurrentCurriculumPackage(hubCode: string, courseKey: string): Promise<CurrentCurriculumPackageRecord>;
  getCurriculumDraft(draftId: string): Promise<AuthoringDraft>;
  discardCurriculumDraft(draftId: string): Promise<void>;
  reviewResponse(request: ReviewResponseRequest): Promise<ReviewResponseResult>;
  callRpc(name: string, params: Record<string, unknown>): Promise<unknown[]>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
}

interface PortalState {
  status: AdminPortalStatus;
  session: AdminSessionSnapshot;
  bootstrap: AdminBootstrapData | null;
  bootstrapReady: boolean;
  moduleCache: AdminModuleCacheState;
  demoSnapshot: AdminDataSnapshot | null;
  message: string | null;
  refreshing: boolean;
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

function resultFromDemoHub(registered: {
  result: { hub: NonNullable<AdminDataSnapshot["hubs"][number]>; courseKeys: readonly string[] };
}): HubRegistrationResult {
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

function clearedPortalState(message: string | null = null): PortalState {
  return {
    status: "signed-out",
    session: SIGNED_OUT_ADMIN_SESSION,
    bootstrap: null,
    bootstrapReady: false,
    moduleCache: createEmptyModuleCache(),
    demoSnapshot: null,
    message,
    refreshing: false,
  };
}

function createDemoModuleCache(): AdminModuleCacheState {
  return {
    dashboard: {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "dashboard"),
      error: null,
    },
    "hubs-curriculum": {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "hubs-curriculum"),
      error: null,
    },
    people: {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "people"),
      error: null,
    },
    "assignments-results": {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "assignments-results"),
      error: null,
    },
    analytics: {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "analytics"),
      error: null,
    },
    system: {
      status: "ready",
      data: sliceDemoModuleData(DEMO_ADMIN_DATA, "system"),
      error: null,
    },
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
        bootstrap: { dashboardSummary: DEMO_ADMIN_DATA.dashboardSummary },
        bootstrapReady: true,
        moduleCache: createDemoModuleCache(),
        demoSnapshot: DEMO_ADMIN_DATA,
        message: null,
        refreshing: false,
      };
    }
    if (!config.valid) {
      return {
        status: "error",
        session: unavailableSession(),
        bootstrap: null,
        bootstrapReady: false,
        moduleCache: createEmptyModuleCache(),
        demoSnapshot: null,
        message: config.message,
        refreshing: false,
      };
    }
    return {
      status: "loading",
      session: { ...SIGNED_OUT_ADMIN_SESSION, state: "loading" },
      bootstrap: null,
      bootstrapReady: false,
      moduleCache: createEmptyModuleCache(),
      demoSnapshot: null,
      message: null,
      refreshing: false,
    };
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const moduleLoadPromises = useRef(new Map<AdminModuleDataKey, Promise<void>>());

  const loadModuleData = useCallback(async (
    key: AdminModuleDataKey,
    options?: { refresh?: boolean },
  ) => {
    const current = stateRef.current;
    const entry = current.moduleCache[key];
    const refresh = options?.refresh ?? false;

    if (!refresh && isModuleReady(entry)) {
      recordModuleCacheHit(key);
      return;
    }

    const existing = moduleLoadPromises.current.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      markModuleLoadStarted(key);
      setState((portal) => ({
        ...portal,
        moduleCache: setModuleCacheEntry(portal.moduleCache, key, {
          status: moduleStatusForLoad(portal.moduleCache[key].status, refresh),
          error: null,
        }),
      }));

      try {
        const demoSnapshot = stateRef.current.demoSnapshot;
        const service = client
          ? createSupabaseAdminReadService(client)
          : demoSnapshot
            ? demoAdminService
            : null;
        if (!service) {
          throw new AdminReadError("unavailable", key);
        }

        const data = await fetchModuleData(key, service, {
          bootstrap: stateRef.current.bootstrap,
          demoSnapshot,
        });

        setState((portal) => ({
          ...portal,
          moduleCache: setModuleCacheEntry(portal.moduleCache, key, {
            status: "ready",
            data: data as AdminModulePayload[typeof key],
            error: null,
          }),
        }));
        markModuleLoadCompleted(key);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "This module could not be loaded.";
        setState((portal) => ({
          ...portal,
          moduleCache: setModuleCacheEntry(portal.moduleCache, key, {
            status: "error",
            error: message,
          }),
        }));
        markModuleLoadCompleted(key);
      }
    })();

    moduleLoadPromises.current.set(key, promise);
    try {
      await promise;
    } finally {
      moduleLoadPromises.current.delete(key);
    }
  }, [client]);

  const ensureModuleData = useCallback(async (key: AdminModuleDataKey) => {
    await loadModuleData(key);
  }, [loadModuleData]);

  const refreshModuleData = useCallback(async (key: AdminModuleDataKey) => {
    await loadModuleData(key, { refresh: true });
  }, [loadModuleData]);

  const invalidateAndRefreshModules = useCallback(async (keys: readonly AdminModuleDataKey[]) => {
    setState((portal) => ({
      ...portal,
      moduleCache: invalidateModuleCache(portal.moduleCache, keys),
    }));
    await Promise.all(keys.map((key) => loadModuleData(key, { refresh: true })));
  }, [loadModuleData]);

  const bootstrapSession = useCallback(async (
    session: Session | null,
    options?: { background?: boolean },
  ) => {
    if (!client) return;

    setState((current) => {
      if (shouldPreservePortalDataOnRefresh(current, options)) {
        return { ...current, refreshing: true, message: null };
      }
      resetAdminModulePerformance();
      return {
        ...current,
        status: "loading",
        bootstrap: null,
        bootstrapReady: false,
        moduleCache: createEmptyModuleCache(),
        demoSnapshot: null,
        message: null,
        refreshing: false,
      };
    });

    if (!session) {
      setState(clearedPortalState());
      return;
    }

    const service = createSupabaseAdminReadService(client);
    try {
      markBootstrapStarted();
      const staffContext = await service.getCurrentStaffContext();
      const nextSession = sessionFromStaffContext(staffContext);
      if (nextSession.state !== "authenticated") {
        setState({
          status: "access-denied",
          session: nextSession,
          bootstrap: null,
          bootstrapReady: false,
          moduleCache: createEmptyModuleCache(),
          demoSnapshot: null,
          message:
            "This authenticated account does not have an active platform administrator role.",
          refreshing: false,
        });
        return;
      }

      const bootstrap = await fetchAdminBootstrapData(service);
      setState({
        status: "ready",
        session: nextSession,
        bootstrap,
        bootstrapReady: true,
        moduleCache: createEmptyModuleCache(),
        demoSnapshot: null,
        message: null,
        refreshing: false,
      });
      markBootstrapCompleted();
    } catch (error) {
      const denied = error instanceof AdminReadError && error.code === "access-denied";
      setState((current) => ({
        status: denied ? "access-denied" : "error",
        session: denied
          ? { ...SIGNED_OUT_ADMIN_SESSION, state: "access-denied" }
          : unavailableSession(),
        bootstrap: null,
        bootstrapReady: shouldPreservePortalDataOnRefresh(current, options)
          ? current.bootstrapReady
          : false,
        moduleCache: shouldPreservePortalDataOnRefresh(current, options)
          ? current.moduleCache
          : createEmptyModuleCache(),
        demoSnapshot: null,
        message: denied
          ? "The backend denied access to administrative data."
          : "Live administrative data is currently unavailable. No demo data has been substituted.",
        refreshing: false,
      }));
    }
  }, [client]);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    if (!client) return;
    const { data: authData, error: authError } = await client.auth.getSession();
    if (authError) {
      setState({
        status: "error",
        session: unavailableSession(),
        bootstrap: null,
        bootstrapReady: false,
        moduleCache: createEmptyModuleCache(),
        demoSnapshot: null,
        message: "The authentication service is currently unavailable.",
        refreshing: false,
      });
      return;
    }
    await bootstrapSession(authData.session, options);
  }, [bootstrapSession, client]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (shouldClearAdminData(event)) {
        resetAdminModulePerformance();
        moduleLoadPromises.current.clear();
        setState(clearedPortalState());
        return;
      }
      if (shouldBootstrapAdminData(event)) {
        void bootstrapSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [bootstrapSession, client]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) return;
    setState((current) => ({ ...current, status: "loading", message: null }));
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setState(clearedPortalState("Sign-in failed. Check the account details and try again."));
    }
  }, [client]);

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
        setState(clearedPortalState(
          "Check your email to confirm the account, then sign in. Account creation does not grant administration access by itself.",
        ));
      }
    } catch {
      setState(clearedPortalState(
        "The account could not be created. Check the details and try again, or sign in if the account already exists.",
      ));
    }
  }, [client]);

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
    setState(clearedPortalState(
      error
        ? "A sign-in link could not be sent. Check the staff email and try again."
        : "Check the staff inbox for a time-limited sign-in link.",
    ));
  }, [client]);

  const claimInitialAdmin = useCallback(async (bootstrapToken: string) => {
    if (!client) return;
    setState((current) => ({
      ...current,
      status: "loading",
      bootstrap: null,
      bootstrapReady: false,
      moduleCache: createEmptyModuleCache(),
      message: null,
      refreshing: false,
    }));
    try {
      await claimInitialPlatformAdmin(client, bootstrapToken);
      const { data: authData } = await client.auth.getSession();
      await bootstrapSession(authData.session);
    } catch {
      setState((current) => ({
        ...current,
        status: "access-denied",
        bootstrap: null,
        bootstrapReady: false,
        moduleCache: createEmptyModuleCache(),
        message:
          "Initial administrator setup could not be completed. Check the one-time setup code or contact the platform owner.",
        refreshing: false,
      }));
    }
  }, [bootstrapSession, client]);

  const registerHub = useCallback(async (request: HubRegistrationRequest) => {
    if (!client) {
      if (config.mode !== "demo") {
        throw new AdminHubRegistrationError("unavailable");
      }
      const current = stateRef.current.demoSnapshot ?? DEMO_ADMIN_DATA;
      try {
        const registered = registerDemoHub(current, request);
        setState((existing) => (
          existing.status === "ready"
            ? {
                ...existing,
                demoSnapshot: registered.snapshot,
                moduleCache: invalidateModuleCache(existing.moduleCache, HUB_MUTATION_INVALIDATES),
              }
            : existing
        ));
        await invalidateAndRefreshModules(HUB_MUTATION_INVALIDATES);
        return resultFromDemoHub(registered);
      } catch (caught) {
        throw new AdminHubRegistrationError(
          caught instanceof Error ? caught.message : "registration-failed",
        );
      }
    }
    const result = await registerHubRpc(client, request);
    await invalidateAndRefreshModules(HUB_MUTATION_INVALIDATES);
    return result;
  }, [client, config.mode, invalidateAndRefreshModules]);

  const updateHub = useCallback(async (request: HubRegistrationRequest) => {
    if (!client) {
      if (config.mode !== "demo") {
        throw new AdminHubRegistrationError("unavailable");
      }
      const current = stateRef.current.demoSnapshot ?? DEMO_ADMIN_DATA;
      try {
        const updated = updateDemoHub(current, request);
        setState((existing) => (
          existing.status === "ready"
            ? {
                ...existing,
                demoSnapshot: updated.snapshot,
                moduleCache: invalidateModuleCache(existing.moduleCache, HUB_MUTATION_INVALIDATES),
              }
            : existing
        ));
        await invalidateAndRefreshModules(HUB_MUTATION_INVALIDATES);
        return resultFromDemoHub(updated);
      } catch (caught) {
        throw new AdminHubRegistrationError(
          caught instanceof Error ? caught.message : "registration-failed",
        );
      }
    }
    const result = await updateHubRpc(client, request);
    await invalidateAndRefreshModules(HUB_MUTATION_INVALIDATES);
    return result;
  }, [client, config.mode, invalidateAndRefreshModules]);

  const publishCurriculum = useCallback(async (record: AuthoringDraft) => {
    if (!client) {
      throw new AdminPublicationError("unavailable");
    }
    const result = await publishCurriculumRpc(client, record);
    await invalidateAndRefreshModules(CURRICULUM_MUTATION_INVALIDATES);
    return result;
  }, [client, invalidateAndRefreshModules]);

  const saveCurriculumDraft = useCallback(async (record: AuthoringDraft) => {
    if (!client) throw new AdminPublicationError("unavailable");
    return saveCurriculumDraftRpc(client, record);
  }, [client]);

  const loadCurrentCurriculumPackage = useCallback(async (hubCode: string, courseKey: string) => {
    if (!client) throw new AdminPublicationError("unavailable");
    return loadCurrentCurriculumPackageRpc(client, hubCode, courseKey);
  }, [client]);

  const getCurriculumDraft = useCallback(async (draftId: string) => {
    if (!client) throw new AdminPublicationError("unavailable");
    const record = await getCurriculumDraftRpc(client, draftId);
    return authoringDraftFromRemote({
      ...record,
      package: record.package as unknown as ContentPackage,
    }, stateRef.current.session.displayName);
  }, [client]);

  const discardRemoteCurriculumDraft = useCallback(async (draftId: string) => {
    if (!client) throw new AdminPublicationError("unavailable");
    return discardCurriculumDraftRpc(client, draftId);
  }, [client]);

  const reviewResponse = useCallback(async (request: ReviewResponseRequest) => {
    if (config.mode === "demo") {
      const snapshot = mergeModuleCacheToSnapshot(stateRef.current.moduleCache);
      const demoSnapshot = stateRef.current.demoSnapshot ?? DEMO_ADMIN_DATA;
      const source = snapshot.responses.length ? snapshot : demoSnapshot;
      if (!source.responses.length) throw new AdminReviewError("unavailable");
      const current = source.responses.find((response) => response.responseId === request.responseId);
      if (!current) throw new AdminReviewError("REVIEW_RESPONSE_NOT_FOUND");
      const markedAt = new Date().toISOString();
      const responses = source.responses.map((response) => (
        response.responseId === request.responseId
          ? {
              ...response,
              score: request.awardedScore,
              isCorrect: request.isCorrect,
              requiresReview: false,
              markingSource: "teacher",
              markedAt,
              feedbackSummary: request.feedbackSummary,
              feedbackNextStep: request.feedbackNextStep ?? null,
            }
          : response
      ));
      const attemptResponses = responses.filter((response) => response.attemptId === current.attemptId);
      const attemptScore = attemptResponses.reduce((sum, response) => sum + (response.score ?? 0), 0);
      const attempts = source.attempts.map((attempt) => (
        attempt.attemptId === current.attemptId
          ? {
              ...attempt,
              score: attemptScore,
              markingSource: "teacher",
              requiresReview: attemptResponses.some((response) => response.requiresReview),
            }
          : attempt
      ));
      const nextSnapshot = { ...demoSnapshot, responses, attempts };
      setState((portal) => (
        portal.status === "ready"
          ? {
              ...portal,
              demoSnapshot: nextSnapshot,
              moduleCache: invalidateModuleCache(portal.moduleCache, REVIEW_MUTATION_INVALIDATES),
            }
          : portal
      ));
      await invalidateAndRefreshModules(REVIEW_MUTATION_INVALIDATES);
      return {
        responseId: request.responseId,
        attemptId: current.attemptId,
        awardedScore: request.awardedScore,
        maxScore: current.maxScore,
        isCorrect: request.isCorrect,
        requiresReview: false,
        markingSource: "teacher",
        feedbackSummary: request.feedbackSummary,
        feedbackNextStep: request.feedbackNextStep ?? null,
        markedAt,
        attemptScore,
        attemptMarkingSource: "teacher",
        idempotent: false,
      } satisfies ReviewResponseResult;
    }

    if (!client) throw new AdminReviewError("unavailable");
    const result = await reviewResponseRpc(client, request);
    await invalidateAndRefreshModules(REVIEW_MUTATION_INVALIDATES);
    return result;
  }, [client, config.mode, invalidateAndRefreshModules]);

  const callRpc = useCallback(async (name: string, params: Record<string, unknown>): Promise<unknown[]> => {
    if (!client) throw new Error("Platform not connected");
    const { data: rpcData, error } = await client.schema("admin_api").rpc(name, params);
    if (error) throw new Error(error.message);
    return Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    resetAdminModulePerformance();
    moduleLoadPromises.current.clear();
    setState(clearedPortalState());
  }, [client]);

  const data = useMemo(
    () => (state.bootstrapReady ? mergeModuleCacheToSnapshot(state.moduleCache, state.bootstrap) : null),
    [state.bootstrap, state.bootstrapReady, state.moduleCache],
  );

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
      if (state.refreshing) {
        return {
          mode: "live",
          state: "refreshing",
          title: "Live backend",
          message: "Refreshing authorised admin_api data.",
        };
      }
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
  }, [config.mode, state.message, state.refreshing, state.status]);

  const retry = useCallback(async () => {
    await refresh({
      background: state.status === "ready" && state.bootstrapReady,
    });
  }, [refresh, state.bootstrapReady, state.status]);

  const value = useMemo<AdminPortalContextValue>(() => ({
    config,
    status: state.status,
    session: state.session,
    bootstrapReady: state.bootstrapReady,
    bootstrap: state.bootstrap,
    moduleCache: state.moduleCache,
    data,
    refreshing: state.refreshing,
    dataSource,
    authMessage: state.message,
    ensureModuleData,
    refreshModuleData,
    signIn,
    signUp,
    requestMagicLink,
    claimInitialAdmin,
    registerHub,
    updateHub,
    publishCurriculum,
    saveCurriculumDraft,
    loadCurrentCurriculumPackage,
    getCurriculumDraft,
    discardCurriculumDraft: discardRemoteCurriculumDraft,
    reviewResponse,
    callRpc,
    signOut,
    retry,
  }), [callRpc, claimInitialAdmin, config, data, dataSource, discardRemoteCurriculumDraft, ensureModuleData, getCurriculumDraft, loadCurrentCurriculumPackage, publishCurriculum, refreshModuleData, registerHub, requestMagicLink, retry, reviewResponse, saveCurriculumDraft, signIn, signOut, signUp, state, updateHub]);

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

export type { AdminModuleDataKey };
