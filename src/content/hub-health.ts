import type {
  AdminDataSnapshot,
  HubRecord,
  PlatformContractRecord,
} from "../api/admin-api.ts";
import type { AuthoringDraft } from "./types.ts";
import { hubPublicationStatus } from "./hub-publication.ts";

export type HubHealthStatus = "pass" | "warn" | "fail" | "info";

export interface HubHealthCheck {
  id: string;
  label: string;
  status: HubHealthStatus;
  detail: string;
}

export interface HubHealthReport {
  status: HubHealthStatus;
  summary: string;
  checks: readonly HubHealthCheck[];
}

function contractStatus(
  contracts: readonly PlatformContractRecord[],
  contractKey: string,
  version: string,
) {
  return contracts.find((contract) => (
    contract.contractKey === contractKey && contract.version === version
  ))?.status ?? null;
}

function compatibilityCheck(
  id: string,
  label: string,
  contracts: readonly PlatformContractRecord[],
  contractKey: string,
  version: string,
): HubHealthCheck {
  const status = contractStatus(contracts, contractKey, version);
  if (status === "active") {
    return { id, label, status: "pass", detail: `${contractKey} ${version} is active.` };
  }
  if (status === "draft" || status === "deprecated") {
    return { id, label, status: "warn", detail: `${contractKey} ${version} is ${status}.` };
  }
  if (status) {
    return { id, label, status: "fail", detail: `${contractKey} ${version} is ${status}.` };
  }
  return { id, label, status: "fail", detail: `${contractKey} ${version} is not in the platform catalogue.` };
}

function undeclaredCheck(id: string, label: string, packageName: string): HubHealthCheck {
  return {
    id,
    label,
    status: "info",
    detail: `${packageName} is not declared in hub-manifest 1.0.0.`,
  };
}

function rollup(checks: readonly HubHealthCheck[]): HubHealthStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  if (checks.every((check) => check.status === "info")) return "info";
  return "pass";
}

function summaryFor(status: HubHealthStatus) {
  if (status === "fail") return "Attention required";
  if (status === "warn") return "Review recommended";
  if (status === "info") return "Informational";
  return "Healthy";
}

export function hubHealthReport(
  hub: HubRecord,
  data: AdminDataSnapshot,
  localDrafts: readonly AuthoringDraft[] = [],
): HubHealthReport {
  const activeLinks = data.hubCourseLinks.filter((link) => link.hubCode === hub.hubCode && link.active);
  const publication = hubPublicationStatus(hub, data, localDrafts);
  const schemaVersion = publication.schemaVersion;
  const schemaContract = schemaVersion
    ? contractStatus(data.contracts, "lp.content", schemaVersion)
      ?? contractStatus(data.contracts, "learning-platform-content", schemaVersion)
    : null;

  const checks: HubHealthCheck[] = [
    {
      id: "registered",
      label: "Hub registered",
      status: "pass",
      detail: `${hub.hubCode} is in the platform registry.`,
    },
    activeLinks.length
      ? {
        id: "course-linked",
        label: "Course linked",
        status: "pass",
        detail: activeLinks.map((link) => link.courseTitle).join(", "),
      }
      : {
        id: "course-linked",
        label: "Course linked",
        status: "fail",
        detail: "No active course link is registered.",
      },
    publication.catalogueStatus === "published"
      ? {
        id: "publication",
        label: "Publication available",
        status: "pass",
        detail: `Platform catalogue ${publication.packageVersion} is published.`,
      }
      : publication.catalogueStatus === "superseded"
        ? {
          id: "publication",
          label: "Publication available",
          status: "warn",
          detail: `The latest catalogue row ${publication.packageVersion} is superseded.`,
        }
        : publication.localStatus !== "none"
          ? {
            id: "publication",
            label: "Publication available",
            status: "warn",
            detail: `Local authoring is ${publication.localLabel}; nothing is in the platform catalogue.`,
          }
          : {
            id: "publication",
            label: "Publication available",
            status: "fail",
            detail: "No local draft or platform catalogue row is linked.",
          },
    publication.packageVersion
      ? {
        id: "package-version",
        label: "Current package version",
        status: "pass",
        detail: publication.packageVersion,
      }
      : {
        id: "package-version",
        label: "Current package version",
        status: "info",
        detail: "No curriculum package version is linked yet.",
      },
    schemaVersion
      ? schemaContract === "active"
        ? {
          id: "schema",
          label: "Schema compatibility",
          status: "pass" as const,
          detail: `Schema ${schemaVersion} is active.`,
        }
        : {
          id: "schema",
          label: "Schema compatibility",
          status: "info" as const,
          detail: `Linked schema ${schemaVersion} is not a separate platform contract; publication records the version.`,
        }
      : {
        id: "schema",
        label: "Schema compatibility",
        status: "info",
        detail: "No linked curriculum schema version is available.",
      },
    compatibilityCheck("core", "Core compatibility", data.contracts, "learning-platform-core", hub.coreVersion),
    compatibilityCheck("learner-api", "Learner API compatibility", data.contracts, "learner-api", hub.learnerApiVersion),
    compatibilityCheck("submission", "Submission compatibility", data.contracts, "submission", hub.submissionContractVersion),
    undeclaredCheck("ui", "UI compatibility", "@learning-platform/ui"),
    undeclaredCheck("content", "Content compatibility", "@learning-platform/content"),
    data.contracts.some((contract) => contract.contractKey === "admin-api" && contract.version === "0.2.0")
      ? {
        id: "backend",
        label: "Backend compatibility",
        status: "pass",
        detail: "admin-api 0.2.0 is the current staff contract.",
      }
      : {
        id: "backend",
        label: "Backend compatibility",
        status: "warn",
        detail: "admin-api 0.2.0 is not listed in the platform contract catalogue.",
      },
  ];

  const missingPackages = (data.publicationsMissingLearnerPackages ?? []).filter(
    (row) => row.hubCode === hub.hubCode,
  );
  checks.push(
    missingPackages.length === 0
      ? {
        id: "learner-package",
        label: "Precomputed learner packages",
        status: "pass",
        detail: "No missing or outdated learner packages for this hub.",
      }
      : {
        id: "learner-package",
        label: "Precomputed learner packages",
        status: "fail",
        detail: `${missingPackages.length} publication(s) missing current learner_package / sanitisation version.`,
      },
  );

  const markingGaps = (data.publishedMarkingCoverageGaps ?? []).filter(
    (row) => row.hubCode === hub.hubCode,
  );
  checks.push(
    markingGaps.length === 0
      ? {
        id: "marking-coverage",
        label: "Published marking coverage",
        status: "pass",
        detail: "No unresolved published marking gaps for this hub.",
      }
      : {
        id: "marking-coverage",
        label: "Published marking coverage",
        status: "fail",
        detail: `${markingGaps.length} published question(s) unresolved (missing specs / fingerprint mismatches).`,
      },
  );

  const publishedRows = data.curriculumPublications.filter(
    (row) => row.hubCode === hub.hubCode && row.status === "published",
  );
  const staleSanitisation = publishedRows.filter((row) => (
    row.hasLearnerPackage === false
    || (row.learnerPackageSanitisationVersion != null
      && row.learnerPackageSanitisationVersion !== ""
      && missingPackages.some((gap) => gap.packageVersion === row.packageVersion))
  ));
  if (publishedRows.some((row) => row.hasLearnerPackage != null)) {
    checks.push(
      staleSanitisation.length === 0 && publishedRows.every((row) => row.hasLearnerPackage !== false)
        ? {
          id: "publication-config",
          label: "Publication learner-package config",
          status: "pass",
          detail: "Published rows report learner packages present.",
        }
        : {
          id: "publication-config",
          label: "Publication learner-package config",
          status: "warn",
          detail: "One or more published rows are missing a current learner package.",
        },
    );
  }

  const status = rollup(checks);
  return { status, summary: summaryFor(status), checks };
}
