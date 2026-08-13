(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function type(id, category, implemented, extras) {
    var record = {
      id: id,
      category: category,
      implemented: implemented === true
    };
    var key;
    extras = extras || {};
    for (key in extras) {
      if (Object.prototype.hasOwnProperty.call(extras, key)) {
        record[key] = extras[key];
      }
    }
    return Object.freeze(record);
  }

  var types = [];
  var byId = {};

  function register(record) {
    if (byId[record.id]) {
      var error = new Error("Duplicate block type '" + record.id + "'");
      error.code = "DUPLICATE_BLOCK_TYPE";
      throw error;
    }
    types.push(record);
    byId[record.id] = record;
  }

  [
    type("markdown", "prose", true),
    type("heading", "prose", true),
    type("paragraph", "prose", true),
    type("image", "media", true),
    type("video", "media", true),
    type("callout", "prose", true),
    type("accordion", "prose", true),
    type("reference", "prose", true),
    type("hint", "prose", true),
    type("quote", "prose", true),
    type("divider", "prose", true),
    type("teacher-note", "prose", true, { audience: "teacher" }),
    type("single-choice", "question", true, { questionKind: "single-choice" }),
    type("multiple-choice", "question", false, { questionKind: "multiple-choice" }),
    type("multi-select", "question", false, { questionKind: "multi-select" }),
    type("matching", "question", false, { questionKind: "matching" }),
    type("classification", "question", true, { questionKind: "classification" }),
    type("ordering", "question", false, { questionKind: "ordering" }),
    type("fill-gap", "question", false, { questionKind: "fill-gap" }),
    type("short-response", "question", true, { questionKind: "short-response" }),
    type("long-response", "question", false, { questionKind: "long-response" }),
    type("reflection", "question", true, { questionKind: "reflection" }),
    type("code-editor", "code", true),
    type("python-exercise", "code", true, { languages: ["python"] }),
    type("debugging-exercise", "code", false),
    type("code-tracing", "code", false)
  ].forEach(register);

  ns.BLOCK_TYPES = Object.freeze(types.slice());
  ns.BLOCK_TYPE_MAP = Object.freeze(Object.assign({}, byId));

  ns.registerBlockType = function (id, category, implemented, extras) {
    register(type(id, category, implemented, extras));
    ns.BLOCK_TYPES = Object.freeze(types.slice());
    ns.BLOCK_TYPE_MAP = Object.freeze(Object.assign({}, byId));
    return byId[id];
  };

  ns.normaliseBlockType = function (value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-");
  };

  ns.isRegisteredBlockType = function (value) {
    return Object.prototype.hasOwnProperty.call(byId, ns.normaliseBlockType(value));
  };

  ns.getBlockType = function (value) {
    return byId[ns.normaliseBlockType(value)] || null;
  };

  ns.INTERACTIVE_BLOCK_TYPES = Object.freeze([
    "single-choice",
    "classification",
    "short-response",
    "reflection",
    "code-editor",
    "python-exercise"
  ]);

  ns.isInteractiveBlockType = function (value) {
    return ns.INTERACTIVE_BLOCK_TYPES.indexOf(ns.normaliseBlockType(value)) !== -1;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
