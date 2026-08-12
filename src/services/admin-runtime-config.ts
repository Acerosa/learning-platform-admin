export type AdminDataMode = "demo" | "live";

export interface AdminRuntimeConfig {
  mode: AdminDataMode;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  valid: boolean;
  message: string | null;
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

declare const __ADMIN_PUBLIC_ENV__: RuntimeEnvironment;

function isLegacyAnonKey(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3 || typeof globalThis.atob !== "function") return false;
  try {
    const encoded = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(globalThis.atob(encoded)) as { role?: unknown };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function isBrowserSafeSupabaseKey(value: string) {
  return value.startsWith("sb_publishable_") || isLegacyAnonKey(value);
}

export function resolveAdminRuntimeConfig(
  environment: RuntimeEnvironment,
): AdminRuntimeConfig {
  const mode = environment.NEXT_PUBLIC_ADMIN_DATA_MODE || "demo";
  if (mode !== "demo" && mode !== "live") {
    return {
      mode: "demo",
      supabaseUrl: null,
      supabasePublishableKey: null,
      valid: false,
      message: "NEXT_PUBLIC_ADMIN_DATA_MODE must be either demo or live.",
    };
  }

  if (mode === "demo") {
    return {
      mode,
      supabaseUrl: null,
      supabasePublishableKey: null,
      valid: true,
      message: null,
    };
  }

  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!/^https?:\/\/[^\s]+$/i.test(supabaseUrl)) {
    return {
      mode,
      supabaseUrl: null,
      supabasePublishableKey: null,
      valid: false,
      message: "Live mode requires a valid NEXT_PUBLIC_SUPABASE_URL.",
    };
  }

  if (!isBrowserSafeSupabaseKey(supabasePublishableKey)) {
    return {
      mode,
      supabaseUrl,
      supabasePublishableKey: null,
      valid: false,
      message:
        "Live mode requires a Supabase publishable key or legacy anon key; secret and service-role credentials are rejected.",
    };
  }

  return {
    mode,
    supabaseUrl,
    supabasePublishableKey,
    valid: true,
    message: null,
  };
}

export function getAdminRuntimeConfig() {
  const environment =
    typeof __ADMIN_PUBLIC_ENV__ === "undefined" ? {} : __ADMIN_PUBLIC_ENV__;
  return resolveAdminRuntimeConfig(environment);
}
