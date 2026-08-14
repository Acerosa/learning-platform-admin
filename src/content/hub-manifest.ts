import type { HubLifecycle, HubRecord, PlatformContractRecord } from "../api/admin-api.ts";
import type { ValidationIssue } from "./types.ts";

export const HUB_MANIFEST_FILENAME = "learning-platform-hub.json";
export const SUPPORTED_HUB_MANIFEST_VERSION = "1.0.0";

const TOP_LEVEL_KEYS = [
  "manifestVersion",
  "hubId",
  "name",
  "description",
  "version",
  "repositoryUrl",
  "deploymentUrl",
  "courses",
  "compatibility",
  "capabilities",
  "featureFlags",
  "certification",
] as const;

const REQUIRED_TOP_LEVEL_KEYS = TOP_LEVEL_KEYS.filter((key) => key !== "certification");
const STABLE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FEATURE_FLAG = /^[a-z][A-Za-z0-9]*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
export const HUB_LIFECYCLES: readonly HubLifecycle[] = [
  "planned",
  "development",
  "testing",
  "production",
  "maintenance",
  "deprecated",
  "archived",
];

export interface HubManifestCompatibility {
  required: {
    coreVersion: string;
    learnerApiContractVersion: string;
    submissionContractVersion: string;
  };
  testedCombinations: readonly {
    coreVersion: string;
    learnerApiContractVersion: string;
    submissionContractVersion: string;
  }[];
}

export interface HubManifest {
  manifestVersion: string;
  hubId: string;
  name: string;
  description: string;
  version: string;
  repositoryUrl: string;
  deploymentUrl: string;
  courses: readonly string[];
  compatibility: HubManifestCompatibility;
  capabilities: {
    evidence: readonly string[];
    activities: readonly string[];
  };
  featureFlags: Readonly<Record<string, boolean>>;
  certification?: Readonly<Record<string, unknown>>;
}

export interface HubRegistrationFormState {
  hubId: string;
  name: string;
  description: string;
  version: string;
  status: HubLifecycle;
  active: boolean;
  repositoryUrl: string;
  deploymentUrl: string;
  manifestVersion: string;
  coreVersion: string;
  learnerApiVersion: string;
  submissionContractVersion: string;
  courses: string;
  evidence: string;
  activities: string;
  featureFlags: string;
}

export interface HubManifestValidationContext {
  activeContracts?: readonly PlatformContractRecord[];
  knownCourseKeys?: readonly string[];
  existingHubCodes?: readonly string[];
  existingRepositoryUrls?: readonly string[];
  existingDeploymentUrls?: readonly string[];
  currentHubCode?: string;
}

export interface HubManifestValidationReport {
  valid: boolean;
  issues: readonly ValidationIssue[];
  manifest: HubManifest | null;
}

export const EMPTY_HUB_REGISTRATION_FORM: HubRegistrationFormState = Object.freeze({
  hubId: "",
  name: "",
  description: "",
  version: "0.1.0",
  status: "planned",
  active: false,
  repositoryUrl: "",
  deploymentUrl: "",
  manifestVersion: SUPPORTED_HUB_MANIFEST_VERSION,
  coreVersion: "0.1.0",
  learnerApiVersion: "0.1.0",
  submissionContractVersion: "0.1.0",
  courses: "",
  evidence: "question-level",
  activities: "",
  featureFlags: "authentication, onboarding, progress",
});

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function canonicalUrl(value: string) {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.port && parsed.port !== "443")
      || /\s/.test(value)
      || path.endsWith("/")
    ) {
      return null;
    }
    return `https://${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function versionsEqual(
  left: HubManifestCompatibility["required"],
  right: HubManifestCompatibility["required"],
) {
  return left.coreVersion === right.coreVersion
    && left.learnerApiContractVersion === right.learnerApiContractVersion
    && left.submissionContractVersion === right.submissionContractVersion;
}

function contractIsActive(
  contracts: readonly PlatformContractRecord[] | undefined,
  contractKey: string,
  version: string,
) {
  if (!contracts) return true;
  return contracts.some((contract) => (
    contract.contractKey === contractKey
    && contract.version === version
    && contract.status === "active"
  ));
}

export function defaultHubRegistrationForm(
  defaults?: Partial<HubRegistrationFormState>,
): HubRegistrationFormState {
  return { ...EMPTY_HUB_REGISTRATION_FORM, ...defaults };
}

export function manifestFromForm(form: HubRegistrationFormState): HubManifest {
  const required = {
    coreVersion: form.coreVersion.trim(),
    learnerApiContractVersion: form.learnerApiVersion.trim(),
    submissionContractVersion: form.submissionContractVersion.trim(),
  };
  const featureFlags = Object.fromEntries(
    csv(form.featureFlags).map((flag) => [flag, true]),
  );
  return {
    manifestVersion: form.manifestVersion.trim(),
    hubId: form.hubId.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    version: form.version.trim(),
    repositoryUrl: form.repositoryUrl.trim(),
    deploymentUrl: form.deploymentUrl.trim(),
    courses: csv(form.courses),
    compatibility: {
      required,
      testedCombinations: [required],
    },
    capabilities: {
      evidence: csv(form.evidence),
      activities: csv(form.activities),
    },
    featureFlags,
  };
}

export function formFromManifest(
  manifest: HubManifest,
  status: HubLifecycle = "planned",
  active = false,
): HubRegistrationFormState {
  return {
    hubId: manifest.hubId,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    status,
    active,
    repositoryUrl: manifest.repositoryUrl,
    deploymentUrl: manifest.deploymentUrl,
    manifestVersion: manifest.manifestVersion,
    coreVersion: manifest.compatibility.required.coreVersion,
    learnerApiVersion: manifest.compatibility.required.learnerApiContractVersion,
    submissionContractVersion: manifest.compatibility.required.submissionContractVersion,
    courses: manifest.courses.join(", "),
    evidence: manifest.capabilities.evidence.join(", "),
    activities: manifest.capabilities.activities.join(", "),
    featureFlags: Object.entries(manifest.featureFlags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag)
      .join(", "),
  };
}

export function parseHubManifestJson(raw: string): { manifest: unknown; issues: ValidationIssue[] } {
  try {
    const parsed: unknown = JSON.parse(raw);
    return { manifest: parsed, issues: [] };
  } catch (error) {
    return {
      manifest: null,
      issues: [issue("INVALID_JSON", "$", error instanceof Error ? error.message : "Manifest JSON could not be parsed.")],
    };
  }
}

export function activeLifecycleAllowed(status: HubLifecycle, active: boolean) {
  return !active || status === "testing" || status === "production" || status === "maintenance";
}

export function validateHubManifest(
  value: unknown,
  context: HubManifestValidationContext = {},
): HubManifestValidationReport {
  const issues: ValidationIssue[] = [];
  if (!isObject(value)) {
    return { valid: false, issues: [issue("SCHEMA_TYPE", "$", "must be an object")], manifest: null };
  }

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in value)) issues.push(issue("SCHEMA_REQUIRED", `$.${key}`, "is required"));
  }
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.includes(key as typeof TOP_LEVEL_KEYS[number])) {
      issues.push(issue("SCHEMA_UNKNOWN_FIELD", `$.${key}`, "is not allowed"));
    }
  }

  const text = (key: string, maximum: number) => {
    const candidate = value[key];
    if (typeof candidate !== "string") {
      issues.push(issue("SCHEMA_TYPE", `$.${key}`, "must be a string"));
      return "";
    }
    if (!candidate || candidate !== candidate.trim()) {
      issues.push(issue("NAMING_CONVENTION", `$.${key}`, "must be non-blank without surrounding whitespace"));
    }
    if (candidate.length > maximum) {
      issues.push(issue("SCHEMA_LENGTH", `$.${key}`, `must not exceed ${maximum} characters`));
    }
    return candidate;
  };

  const hubId = text("hubId", 128);
  if (hubId && !STABLE_KEY.test(hubId)) {
    issues.push(issue("NAMING_CONVENTION", "$.hubId", "must be a lower-case kebab-case stable key"));
  }
  text("name", 160);
  text("description", 1000);
  const version = text("version", 128);
  if (version && !SEMVER.test(version)) {
    issues.push(issue("INVALID_SEMVER", "$.version", "must be a Semantic Versioning 2.0.0 version"));
  }
  const manifestVersion = text("manifestVersion", 128);
  if (manifestVersion && !SEMVER.test(manifestVersion)) {
    issues.push(issue("INVALID_SEMVER", "$.manifestVersion", "must be a Semantic Versioning 2.0.0 version"));
  }
  if (manifestVersion && manifestVersion !== SUPPORTED_HUB_MANIFEST_VERSION) {
    issues.push(issue("UNSUPPORTED_MANIFEST_VERSION", "$.manifestVersion", `this workflow supports ${SUPPORTED_HUB_MANIFEST_VERSION}`));
  }
  if (manifestVersion && !contractIsActive(context.activeContracts, "hub-manifest", manifestVersion)) {
    issues.push(issue("UNSUPPORTED_MANIFEST_VERSION", "$.manifestVersion", `hub-manifest ${manifestVersion} is not active`));
  }

  const checkUrl = (key: "repositoryUrl" | "deploymentUrl") => {
    const candidate = text(key, 2048);
    if (!candidate) return "";
    const canonical = canonicalUrl(candidate);
    if (!canonical) {
      issues.push(issue("INVALID_URL", `$.${key}`, "must be an HTTPS URL without credentials, query, fragment or trailing slash"));
      return candidate;
    }
    return canonical;
  };
  const repositoryUrl = checkUrl("repositoryUrl");
  const deploymentUrl = checkUrl("deploymentUrl");

  const readKeys = (raw: unknown, path: string) => {
    if (!Array.isArray(raw)) {
      issues.push(issue("SCHEMA_TYPE", path, "must be an array"));
      return [];
    }
    if (!raw.length) issues.push(issue("SCHEMA_MIN_ITEMS", path, "must contain at least one item"));
    const items = raw.filter((item): item is string => typeof item === "string");
    if (items.length !== raw.length) issues.push(issue("SCHEMA_TYPE", path, "must contain strings"));
    const unique = new Set(items);
    if (unique.size !== items.length) issues.push(issue("SCHEMA_UNIQUE_ITEMS", path, "must not contain duplicates"));
    for (const [index, item] of items.entries()) {
      if (!STABLE_KEY.test(item)) {
        issues.push(issue("NAMING_CONVENTION", `${path}[${index}]`, "must be a lower-case kebab-case stable key"));
      }
    }
    return items;
  };

  const courses = readKeys(value.courses, "$.courses");
  if (context.knownCourseKeys) {
    for (const [index, course] of courses.entries()) {
      if (!context.knownCourseKeys.includes(course)) {
        issues.push(issue("UNKNOWN_COURSE", `$.courses[${index}]`, `${course} is not a known active course`));
      }
    }
  }

  if (!isObject(value.compatibility)) {
    issues.push(issue("SCHEMA_TYPE", "$.compatibility", "must be an object"));
  }
  const requiredRaw = isObject(value.compatibility) ? value.compatibility.required : null;
  const testedRaw = isObject(value.compatibility) ? value.compatibility.testedCombinations : null;
  const readVersionSet = (raw: unknown, path: string) => {
    if (!isObject(raw)) {
      issues.push(issue("SCHEMA_TYPE", path, "must be an object"));
      return {
        coreVersion: "",
        learnerApiContractVersion: "",
        submissionContractVersion: "",
      };
    }
    const readVersion = (field: string, contractKey: string) => {
      const candidate = raw[field];
      if (typeof candidate !== "string" || !SEMVER.test(candidate)) {
        issues.push(issue("INVALID_SEMVER", `${path}.${field}`, "must be a Semantic Versioning 2.0.0 version"));
        return "";
      }
      if (!contractIsActive(context.activeContracts, contractKey, candidate)) {
        issues.push(issue("UNSUPPORTED_PLATFORM_VERSION", `${path}.${field}`, `${contractKey} ${candidate} is not active`));
      }
      return candidate;
    };
    return {
      coreVersion: readVersion("coreVersion", "learning-platform-core"),
      learnerApiContractVersion: readVersion("learnerApiContractVersion", "learner-api"),
      submissionContractVersion: readVersion("submissionContractVersion", "submission"),
    };
  };
  const required = readVersionSet(requiredRaw, "$.compatibility.required");
  const tested = Array.isArray(testedRaw)
    ? testedRaw.map((item, index) => readVersionSet(item, `$.compatibility.testedCombinations[${index}]`))
    : [];
  if (!Array.isArray(testedRaw) || !testedRaw.length) {
    issues.push(issue("SCHEMA_MIN_ITEMS", "$.compatibility.testedCombinations", "must contain at least one item"));
  } else if (!tested.some((item) => versionsEqual(item, required))) {
    issues.push(issue("REQUIRED_COMBINATION_NOT_TESTED", "$.compatibility.testedCombinations", "must include the exact required platform version combination"));
  }

  if (!isObject(value.capabilities)) {
    issues.push(issue("SCHEMA_TYPE", "$.capabilities", "must be an object"));
  }
  const evidence = readKeys(isObject(value.capabilities) ? value.capabilities.evidence : [], "$.capabilities.evidence");
  const activities = readKeys(isObject(value.capabilities) ? value.capabilities.activities : [], "$.capabilities.activities");

  if (!isObject(value.featureFlags)) {
    issues.push(issue("SCHEMA_TYPE", "$.featureFlags", "must be an object"));
  } else {
    for (const [flag, enabled] of Object.entries(value.featureFlags)) {
      if (!FEATURE_FLAG.test(flag)) {
        issues.push(issue("NAMING_CONVENTION", `$.featureFlags.${flag}`, "must be a lower-camel-case flag name"));
      }
      if (typeof enabled !== "boolean") {
        issues.push(issue("SCHEMA_TYPE", `$.featureFlags.${flag}`, "must be a boolean"));
      }
    }
  }

  if (context.currentHubCode && hubId && hubId !== context.currentHubCode) {
    issues.push(issue("HUB_CODE_MISMATCH", "$.hubId", "the hub code cannot be changed after registration"));
  }
  if (context.existingHubCodes?.includes(hubId)) {
    issues.push(issue("DUPLICATE_HUB_ID", "$.hubId", "a hub with this code is already registered"));
  }
  const conflictUrl = (candidate: string) => candidate.replace(/\/$/, "").toLowerCase();
  if (repositoryUrl && context.existingRepositoryUrls?.some((url) => conflictUrl(url) === conflictUrl(repositoryUrl))) {
    issues.push(issue("DUPLICATE_REPOSITORY", "$.repositoryUrl", "already registered to another hub"));
  }
  if (deploymentUrl && context.existingDeploymentUrls?.some((url) => url && conflictUrl(url) === conflictUrl(deploymentUrl))) {
    issues.push(issue("DUPLICATE_DEPLOYMENT", "$.deploymentUrl", "already registered to another hub"));
  }

  const manifest: HubManifest = {
    manifestVersion,
    hubId,
    name: typeof value.name === "string" ? value.name.trim() : "",
    description: typeof value.description === "string" ? value.description.trim() : "",
    version,
    repositoryUrl,
    deploymentUrl,
    courses,
    compatibility: { required, testedCombinations: tested },
    capabilities: { evidence, activities },
    featureFlags: isObject(value.featureFlags)
      ? Object.fromEntries(
        Object.entries(value.featureFlags).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
      )
      : {},
    ...(isObject(value.certification) ? { certification: value.certification } : {}),
  };

  return { valid: issues.length === 0, issues, manifest: issues.length ? null : manifest };
}

export function hubRecordFromManifest(
  manifest: HubManifest,
  status: HubLifecycle,
  active: boolean,
): HubRecord {
  const certification = manifest.certification;
  const certificationState = certification && typeof certification.status === "string"
    ? certification.status
    : null;
  return {
    hubCode: manifest.hubId,
    hubName: manifest.name,
    description: manifest.description,
    hubVersion: manifest.version,
    manifestVersion: manifest.manifestVersion,
    coreVersion: manifest.compatibility.required.coreVersion,
    learnerApiVersion: manifest.compatibility.required.learnerApiContractVersion,
    submissionContractVersion: manifest.compatibility.required.submissionContractVersion,
    platformVersion: manifest.compatibility.required.coreVersion,
    subject: null,
    repositoryUrl: manifest.repositoryUrl,
    deploymentUrl: manifest.deploymentUrl,
    curriculumModel: null,
    activityTypes: manifest.capabilities.activities,
    evidenceCapabilities: manifest.capabilities.evidence,
    features: manifest.featureFlags,
    compatibility: manifest.compatibility as unknown as Readonly<Record<string, unknown>>,
    status,
    active,
    certificationState,
  };
}

export function manifestFromHubRecord(
  hub: HubRecord,
  courseKeys: readonly string[],
): HubManifest {
  const required = {
    coreVersion: hub.coreVersion,
    learnerApiContractVersion: hub.learnerApiVersion,
    submissionContractVersion: hub.submissionContractVersion,
  };
  const compatibility = hub.compatibility as unknown as HubManifest["compatibility"];
  const tested = Array.isArray(compatibility?.testedCombinations) && compatibility.testedCombinations.length
    ? compatibility.testedCombinations
    : [required];
  return {
    manifestVersion: hub.manifestVersion,
    hubId: hub.hubCode,
    name: hub.hubName,
    description: hub.description,
    version: hub.hubVersion,
    repositoryUrl: hub.repositoryUrl.replace(/\/+$/, ""),
    deploymentUrl: (hub.deploymentUrl ?? "").replace(/\/+$/, ""),
    courses: courseKeys,
    compatibility: {
      required: compatibility?.required ?? required,
      testedCombinations: tested,
    },
    capabilities: {
      evidence: [...hub.evidenceCapabilities],
      activities: [...hub.activityTypes],
    },
    featureFlags: { ...hub.features },
  };
}
