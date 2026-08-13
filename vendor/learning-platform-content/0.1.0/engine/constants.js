(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  ns.SCHEMA_VERSION = "0.1.0";

  ns.SCHEMAS = Object.freeze({
    PACKAGE: "lp.content.package",
    HUB: "lp.content.hub",
    CURRICULUM: "lp.content.curriculum",
    LEARNING_OUTCOME: "lp.content.learning-outcome",
    ASSIGNMENT: "lp.content.assignment",
    WEEK: "lp.content.week",
    SESSION: "lp.content.session",
    ACTIVITY: "lp.content.activity",
    BLOCK: "lp.content.block",
    QUESTION: "lp.content.question",
    ASSET: "lp.content.asset"
  });

  ns.SUPPORTED_SCHEMA_VERSIONS = Object.freeze(["0.1.0"]);

  ns.SESSION_KINDS = Object.freeze([
    "session",
    "independent-study",
    "homework",
    "revision",
    "retrieval"
  ]);

  ns.STATUSES = Object.freeze(["planned", "available", "archived"]);

  ns.REQUIRED_ENVELOPE = Object.freeze([
    "schema",
    "schemaVersion",
    "id",
    "version",
    "metadata",
    "relationships"
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
