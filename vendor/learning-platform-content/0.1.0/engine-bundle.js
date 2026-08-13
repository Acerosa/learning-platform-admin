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
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function issue(code, path, message) {
    return { code: code, path: path, message: message };
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isSemver(value) {
    return typeof value === "string" && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value);
  }

  function flatten(value) {
    if (Array.isArray(value)) {
      return value.reduce(function (list, item) {
        return list.concat(flatten(item));
      }, []);
    }
    if (isObject(value) && value.schema && value.id) {
      return [value];
    }
    return [];
  }

  function requiredFields(doc, path, issues) {
    ns.REQUIRED_ENVELOPE.forEach(function (field) {
      if (doc[field] === undefined || doc[field] === null) {
        issues.push(issue("MISSING_FIELD", path + "." + field, "required field '" + field + "' is missing"));
      }
    });
  }

  function validateEnvelope(doc, path, expectedSchema, issues) {
    if (!isObject(doc)) {
      issues.push(issue("INVALID_TYPE", path, "expected an object"));
      return false;
    }
    requiredFields(doc, path, issues);
    if (expectedSchema && doc.schema !== expectedSchema) {
      issues.push(issue(
        "UNSUPPORTED_SCHEMA",
        path + ".schema",
        "expected '" + expectedSchema + "' but found '" + doc.schema + "'"
      ));
    }
    if (doc.schemaVersion && ns.SUPPORTED_SCHEMA_VERSIONS.indexOf(doc.schemaVersion) === -1) {
      issues.push(issue(
        "UNSUPPORTED_VERSION",
        path + ".schemaVersion",
        "schemaVersion '" + doc.schemaVersion + "' is not supported (supported: " +
          ns.SUPPORTED_SCHEMA_VERSIONS.join(", ") + ")"
      ));
    }
    if (doc.schemaVersion && !isSemver(doc.schemaVersion)) {
      issues.push(issue("INVALID_TYPE", path + ".schemaVersion", "schemaVersion must be semantic version x.y.z"));
    }
    if (doc.version && !isSemver(doc.version)) {
      issues.push(issue("INVALID_TYPE", path + ".version", "version must be semantic version x.y.z"));
    }
    if (doc.id !== undefined && String(doc.id).trim() === "") {
      issues.push(issue("EMPTY_ID", path + ".id", "id must be a non-empty string"));
    }
    if (doc.metadata !== undefined && !isObject(doc.metadata)) {
      issues.push(issue("INVALID_TYPE", path + ".metadata", "metadata must be an object"));
    }
    if (doc.relationships !== undefined && !isObject(doc.relationships)) {
      issues.push(issue("INVALID_TYPE", path + ".relationships", "relationships must be an object"));
    }
    return true;
  }

  function requireMetadata(doc, path, fields, issues) {
    var metadata = doc.metadata || {};
    fields.forEach(function (field) {
      if (metadata[field] === undefined || metadata[field] === null || metadata[field] === "") {
        issues.push(issue("MISSING_FIELD", path + ".metadata." + field, "metadata." + field + " is required"));
      }
    });
  }

  function asIdList(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  function validateBlock(block, path, issues) {
    var typeId;
    var registered;
    if (!isObject(block)) {
      issues.push(issue("INVALID_TYPE", path, "block must be an object"));
      return;
    }
    if (!block.id) {
      issues.push(issue("MISSING_FIELD", path + ".id", "block id is required"));
    }
    if (!block.type) {
      issues.push(issue("MISSING_FIELD", path + ".type", "block type is required"));
      return;
    }
    typeId = ns.normaliseBlockType(block.type);
    if (typeId !== block.type) {
      issues.push(issue(
        "UNSUPPORTED_BLOCK_TYPE",
        path + ".type",
        "block type must be canonical kebab-case '" + typeId + "'"
      ));
    }
    registered = ns.getBlockType(typeId);
    if (!registered) {
      issues.push(issue(
        "UNSUPPORTED_BLOCK_TYPE",
        path + ".type",
        "block type '" + block.type + "' is not in the registry"
      ));
    }
    if (block.schema && block.schema !== ns.SCHEMAS.BLOCK) {
      issues.push(issue("UNSUPPORTED_SCHEMA", path + ".schema", "inline block schema must be lp.content.block"));
    }
  }

  function validateTypedDocument(doc, path, issues) {
    var schema = doc.schema;
    var metadata = doc.metadata || {};
    var rel = doc.relationships || {};

    if (schema === ns.SCHEMAS.HUB) {
      requireMetadata(doc, path, ["name"], issues);
      if (!rel.curriculum) {
        issues.push(issue("MISSING_FIELD", path + ".relationships.curriculum", "hub must point at a curriculum"));
      }
    } else if (schema === ns.SCHEMAS.CURRICULUM) {
      requireMetadata(doc, path, ["title", "course"], issues);
      ["learningOutcomes", "assignments", "weeks"].forEach(function (field) {
        if (!Array.isArray(rel[field])) {
          issues.push(issue("MISSING_FIELD", path + ".relationships." + field, "curriculum." + field + " must be an array of ids"));
        }
      });
    } else if (schema === ns.SCHEMAS.LEARNING_OUTCOME) {
      requireMetadata(doc, path, ["title"], issues);
    } else if (schema === ns.SCHEMAS.ASSIGNMENT) {
      requireMetadata(doc, path, ["title", "status"], issues);
      if (metadata.status && ns.STATUSES.indexOf(metadata.status) === -1) {
        issues.push(issue("INVALID_TYPE", path + ".metadata.status", "unsupported status '" + metadata.status + "'"));
      }
    } else if (schema === ns.SCHEMAS.WEEK) {
      requireMetadata(doc, path, ["teachingWeek", "title", "status"], issues);
      if (typeof metadata.teachingWeek !== "number") {
        issues.push(issue("INVALID_TYPE", path + ".metadata.teachingWeek", "teachingWeek must be a number"));
      }
      if (!Array.isArray(rel.learningOutcomes)) {
        issues.push(issue("MISSING_FIELD", path + ".relationships.learningOutcomes", "week learningOutcomes are required"));
      }
    } else if (schema === ns.SCHEMAS.SESSION) {
      requireMetadata(doc, path, ["title", "kind"], issues);
      if (metadata.kind && ns.SESSION_KINDS.indexOf(metadata.kind) === -1) {
        issues.push(issue("INVALID_TYPE", path + ".metadata.kind", "unsupported session kind '" + metadata.kind + "'"));
      }
      if (!Array.isArray(rel.activities)) {
        issues.push(issue("MISSING_FIELD", path + ".relationships.activities", "session activities must be an array"));
      }
    } else if (schema === ns.SCHEMAS.ACTIVITY) {
      requireMetadata(doc, path, ["title", "status"], issues);
      if (!Array.isArray(doc.blocks)) {
        issues.push(issue("MISSING_FIELD", path + ".blocks", "activity must contain a blocks array"));
      } else {
        doc.blocks.forEach(function (block, index) {
          validateBlock(block, path + ".blocks[" + index + "]", issues);
        });
      }
    } else if (schema === ns.SCHEMAS.QUESTION) {
      requireMetadata(doc, path, ["kind", "prompt"], issues);
    } else if (schema === ns.SCHEMAS.ASSET) {
      requireMetadata(doc, path, ["kind"], issues);
    } else if (schema === ns.SCHEMAS.PACKAGE) {
      if (!rel.hub || !rel.curriculum) {
        issues.push(issue("MISSING_FIELD", path + ".relationships", "package must list hub and curriculum files"));
      }
    } else if (schema && schema !== ns.SCHEMAS.BLOCK) {
      issues.push(issue("UNSUPPORTED_SCHEMA", path + ".schema", "unsupported schema '" + schema + "'"));
    }
  }

  function indexBySchema(documents, issues) {
    var index = {};
    var seen = {};
    documents.forEach(function (doc) {
      var key;
      if (!doc || !doc.schema || !doc.id) return;
      if (!index[doc.schema]) index[doc.schema] = {};
      if (index[doc.schema][doc.id]) {
        issues.push(issue("DUPLICATE_ID", doc.schema + ":" + doc.id, "duplicate id '" + doc.id + "' for " + doc.schema));
      }
      key = doc.id;
      if (seen[key] && seen[key] !== doc.schema) {
        issues.push(issue(
          "DUPLICATE_ID",
          doc.schema + ":" + doc.id,
          "id '" + doc.id + "' is already used by " + seen[key]
        ));
      }
      seen[key] = doc.schema;
      index[doc.schema][doc.id] = doc;
    });
    return index;
  }

  function lookup(index, schema, id) {
    return index[schema] && index[schema][id] ? index[schema][id] : null;
  }

  function ref(issues, path, index, schema, id) {
    if (!id) return;
    if (!lookup(index, schema, id)) {
      issues.push(issue("MISSING_REFERENCE", path, "referenced " + schema + " '" + id + "' does not exist"));
    }
  }

  function validateRelationships(documents, index, issues) {
    var questionIds = {};
    documents.forEach(function (doc) {
      var rel = doc.relationships || {};
      var path = doc.schema + ":" + doc.id;
      if (doc.schema === ns.SCHEMAS.HUB) {
        ref(issues, path + ".relationships.curriculum", index, ns.SCHEMAS.CURRICULUM, rel.curriculum);
      }
      if (doc.schema === ns.SCHEMAS.CURRICULUM) {
        asIdList(rel.learningOutcomes).forEach(function (id) {
          ref(issues, path + ".relationships.learningOutcomes", index, ns.SCHEMAS.LEARNING_OUTCOME, id);
        });
        asIdList(rel.assignments).forEach(function (id) {
          ref(issues, path + ".relationships.assignments", index, ns.SCHEMAS.ASSIGNMENT, id);
        });
        asIdList(rel.weeks).forEach(function (id) {
          ref(issues, path + ".relationships.weeks", index, ns.SCHEMAS.WEEK, id);
        });
      }
      if (doc.schema === ns.SCHEMAS.WEEK) {
        ref(issues, path + ".relationships.curriculum", index, ns.SCHEMAS.CURRICULUM, rel.curriculum);
        asIdList(rel.learningOutcomes).forEach(function (id) {
          ref(issues, path + ".relationships.learningOutcomes", index, ns.SCHEMAS.LEARNING_OUTCOME, id);
        });
        ref(issues, path + ".relationships.assignment", index, ns.SCHEMAS.ASSIGNMENT, rel.assignment);
        asIdList(rel.sessions).forEach(function (id) {
          ref(issues, path + ".relationships.sessions", index, ns.SCHEMAS.SESSION, id);
        });
      }
      if (doc.schema === ns.SCHEMAS.SESSION) {
        ref(issues, path + ".relationships.week", index, ns.SCHEMAS.WEEK, rel.week);
        asIdList(rel.activities).forEach(function (id) {
          ref(issues, path + ".relationships.activities", index, ns.SCHEMAS.ACTIVITY, id);
        });
      }
      if (doc.schema === ns.SCHEMAS.ACTIVITY) {
        asIdList(rel.learningOutcomes).forEach(function (id) {
          ref(issues, path + ".relationships.learningOutcomes", index, ns.SCHEMAS.LEARNING_OUTCOME, id);
        });
        ref(issues, path + ".relationships.assignment", index, ns.SCHEMAS.ASSIGNMENT, rel.assignment);
        asIdList(rel.questions).forEach(function (id) {
          ref(issues, path + ".relationships.questions", index, ns.SCHEMAS.QUESTION, id);
        });
        asIdList(rel.assets).forEach(function (id) {
          ref(issues, path + ".relationships.assets", index, ns.SCHEMAS.ASSET, id);
        });
        asIdList(rel.prerequisites).forEach(function (id) {
          ref(issues, path + ".relationships.prerequisites", index, ns.SCHEMAS.ACTIVITY, id);
        });
        (doc.blocks || []).forEach(function (block, indexNo) {
          var qid = block.content && block.content.questionId;
          var blockRel = block.relationships || {};
          ref(issues, path + ".blocks[" + indexNo + "].relationships.question", index, ns.SCHEMAS.QUESTION, blockRel.question);
          ref(issues, path + ".blocks[" + indexNo + "].relationships.asset", index, ns.SCHEMAS.ASSET, blockRel.asset);
          if (qid) {
            if (questionIds[qid]) {
              issues.push(issue("DUPLICATE_ID", path + ".blocks[" + indexNo + "].content.questionId", "duplicate question id '" + qid + "'"));
            }
            questionIds[qid] = path;
          }
        });
      }
      if (doc.schema === ns.SCHEMAS.ASSIGNMENT) {
        asIdList(rel.learningOutcomes).forEach(function (id) {
          ref(issues, path + ".relationships.learningOutcomes", index, ns.SCHEMAS.LEARNING_OUTCOME, id);
        });
        asIdList(rel.weeks).forEach(function (id) {
          ref(issues, path + ".relationships.weeks", index, ns.SCHEMAS.WEEK, id);
        });
      }
    });
  }

  function validateInverse(index, issues) {
    var weeks = index[ns.SCHEMAS.WEEK] || {};
    Object.keys(weeks).forEach(function (weekId) {
      asIdList(weeks[weekId].relationships && weeks[weekId].relationships.sessions).forEach(function (sessionId) {
        var session = lookup(index, ns.SCHEMAS.SESSION, sessionId);
        if (session && session.relationships && session.relationships.week && session.relationships.week !== weekId) {
          issues.push(issue(
            "INVALID_RELATIONSHIP",
            "lp.content.session:" + sessionId + ".relationships.week",
            "session '" + sessionId + "' points at week '" + session.relationships.week + "' but is listed on '" + weekId + "'"
          ));
        }
      });
    });
  }

  function detectCycles(documents, issues) {
    var edges = {};

    function addEdge(from, to) {
      if (!from || !to) return;
      if (!edges[from]) edges[from] = [];
      edges[from].push(to);
    }

    documents.forEach(function (doc) {
      var rel = doc.relationships || {};
      var from = doc.schema + ":" + doc.id;
      if (doc.schema === ns.SCHEMAS.CURRICULUM) {
        asIdList(rel.weeks).forEach(function (id) { addEdge(from, ns.SCHEMAS.WEEK + ":" + id); });
      }
      if (doc.schema === ns.SCHEMAS.WEEK) {
        asIdList(rel.sessions).forEach(function (id) { addEdge(from, ns.SCHEMAS.SESSION + ":" + id); });
      }
      if (doc.schema === ns.SCHEMAS.SESSION) {
        asIdList(rel.activities).forEach(function (id) { addEdge(from, ns.SCHEMAS.ACTIVITY + ":" + id); });
      }
      if (doc.schema === ns.SCHEMAS.ACTIVITY) {
        asIdList(rel.prerequisites).forEach(function (id) { addEdge(from, ns.SCHEMAS.ACTIVITY + ":" + id); });
      }
    });

    var visiting = {};
    var visited = {};

    function walk(node, stack) {
      if (visiting[node]) {
        issues.push(issue(
          "CYCLIC_REFERENCE",
          node,
          "cycle detected: " + stack.concat([node]).join(" -> ")
        ));
        return;
      }
      if (visited[node]) return;
      visiting[node] = true;
      (edges[node] || []).forEach(function (child) {
        walk(child, stack.concat([node]));
      });
      visiting[node] = false;
      visited[node] = true;
    }

    Object.keys(edges).forEach(function (node) {
      walk(node, []);
    });
  }

  ns.validateDocument = function (doc, expectedSchema) {
    var issues = [];
    validateEnvelope(doc, expectedSchema || (doc && doc.schema) || "$", expectedSchema, issues);
    if (isObject(doc)) validateTypedDocument(doc, (doc.schema || "$") + ":" + (doc.id || "?"), issues);
    return issues;
  };

  ns.validatePackage = function (pkg) {
    var issues = [];
    var documents;
    var index;
    if (!pkg || !isObject(pkg)) {
      return { valid: false, issues: [issue("INVALID_TYPE", "$", "package must be an object")] };
    }
    documents = []
      .concat(flatten(pkg.hub))
      .concat(flatten(pkg.curriculum))
      .concat(flatten(pkg.learningOutcomes))
      .concat(flatten(pkg.assignments))
      .concat(flatten(pkg.weeks))
      .concat(flatten(pkg.sessions))
      .concat(flatten(pkg.activities))
      .concat(flatten(pkg.questions))
      .concat(flatten(pkg.assets));

    documents.forEach(function (doc) {
      validateEnvelope(doc, doc.schema + ":" + doc.id, doc.schema, issues);
      validateTypedDocument(doc, doc.schema + ":" + doc.id, issues);
    });

    index = indexBySchema(documents, issues);
    validateRelationships(documents, index, issues);
    validateInverse(index, issues);
    detectCycles(documents, issues);

    if (pkg.hub && pkg.curriculum && pkg.hub.relationships && pkg.hub.relationships.curriculum !== pkg.curriculum.id) {
      issues.push(issue(
        "INVALID_RELATIONSHIP",
        "lp.content.hub:" + pkg.hub.id + ".relationships.curriculum",
        "hub curriculum pointer does not match loaded curriculum id"
      ));
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      documents: documents,
      index: index
    };
  };

  ns.formatIssues = function (issues) {
    return (issues || []).map(function (item) {
      return item.code + " at " + item.path + ": " + item.message;
    }).join("\n");
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function parseJson(text, path) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("Invalid JSON in " + path + ": " + error.message);
    }
  }

  function asList(value) {
    if (value == null || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }

  function normaliseBlock(block) {
    if (!block || typeof block !== "object") return block;
    return {
      schema: ns.SCHEMAS.BLOCK,
      schemaVersion: block.schemaVersion || ns.SCHEMA_VERSION,
      id: block.id,
      version: block.version || ns.SCHEMA_VERSION,
      type: ns.normaliseBlockType(block.type),
      metadata: block.metadata || {},
      relationships: block.relationships || {},
      content: block.content || {}
    };
  }

  function normaliseActivity(activity) {
    if (!activity) return activity;
    activity.blocks = (activity.blocks || []).map(normaliseBlock);
    activity.relationships = activity.relationships || {};
    activity.metadata = activity.metadata || {};
    return activity;
  }

  ns.normaliseBlock = normaliseBlock;

  ns.readJsonValue = function (text, path) {
    return parseJson(text, path);
  };

  function collectDocuments(value) {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value.reduce(function (list, item) {
        return list.concat(collectDocuments(item));
      }, []);
    }
    return [value];
  }

  ns.loadPackageFromFiles = function (files) {
    var pkg = {
      hub: files.hub,
      curriculum: files.curriculum,
      learningOutcomes: collectDocuments(files.learningOutcomes),
      assignments: collectDocuments(files.assignments),
      weeks: collectDocuments(files.weeks),
      sessions: collectDocuments(files.sessions),
      activities: collectDocuments(files.activities).map(normaliseActivity),
      questions: collectDocuments(files.questions),
      assets: collectDocuments(files.assets),
      indexFile: files.indexFile || null
    };
    pkg.activities.forEach(normaliseActivity);
    return pkg;
  };

  ns.loadPackageSync = function (directory, io) {
    var read = io && io.readText;
    var join = (io && io.joinPath) || function (base, rel) {
      if (!rel) return base;
      if (!base) return rel;
      return String(base).replace(/\/?$/, "/") + String(rel).replace(/^\//, "");
    };
    var indexPath = join(directory, "index.json");
    var indexFile = parseJson(read(indexPath), indexPath);
    var rel = indexFile.relationships || {};

    function loadRel(entry) {
      return asList(entry).map(function (relativePath) {
        var full = join(directory, relativePath);
        return parseJson(read(full), full);
      });
    }

    return ns.loadPackageFromFiles({
      indexFile: indexFile,
      hub: loadRel(rel.hub)[0],
      curriculum: loadRel(rel.curriculum)[0],
      learningOutcomes: loadRel(rel.learningOutcomes),
      assignments: loadRel(rel.assignments),
      weeks: loadRel(rel.weeks),
      sessions: loadRel(rel.sessions),
      activities: loadRel(rel.activities),
      questions: loadRel(rel.questions),
      assets: loadRel(rel.assets)
    });
  };

  ns.loadPackage = function (directory, io) {
    var read = io.readText;
    var join = io.joinPath || function (base, rel) {
      return String(base).replace(/\/?$/, "/") + String(rel || "").replace(/^\//, "");
    };

    function loadRel(entry) {
      return Promise.all(asList(entry).map(function (relativePath) {
        var full = join(directory, relativePath);
        return Promise.resolve(read(full)).then(function (text) {
          return parseJson(text, full);
        });
      }));
    }

    var indexPath = join(directory, "index.json");
    return Promise.resolve(read(indexPath)).then(function (text) {
      var indexFile = parseJson(text, indexPath);
      var rel = indexFile.relationships || {};
      return Promise.all([
        loadRel(rel.hub),
        loadRel(rel.curriculum),
        loadRel(rel.learningOutcomes),
        loadRel(rel.assignments),
        loadRel(rel.weeks),
        loadRel(rel.sessions),
        loadRel(rel.activities),
        loadRel(rel.questions),
        loadRel(rel.assets)
      ]).then(function (parts) {
        return ns.loadPackageFromFiles({
          indexFile: indexFile,
          hub: parts[0][0],
          curriculum: parts[1][0],
          learningOutcomes: parts[2],
          assignments: parts[3],
          weeks: parts[4],
          sessions: parts[5],
          activities: parts[6],
          questions: parts[7],
          assets: parts[8]
        });
      });
    });
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function byId(list) {
    var map = {};
    (list || []).forEach(function (item) {
      if (item && item.id) map[item.id] = item;
    });
    return map;
  }

  ns.indexPackage = function (pkg) {
    return {
      learningOutcomes: byId(pkg.learningOutcomes),
      assignments: byId(pkg.assignments),
      weeks: byId(pkg.weeks),
      sessions: byId(pkg.sessions),
      activities: byId(pkg.activities),
      questions: byId(pkg.questions),
      assets: byId(pkg.assets)
    };
  };

  ns.resolveActivity = function (pkg, activityId) {
    var maps = ns.indexPackage(pkg);
    var activity = maps.activities[activityId];
    if (!activity) return null;
    return {
      document: activity,
      questions: (activity.relationships.questions || []).map(function (id) {
        return maps.questions[id];
      }).filter(Boolean),
      assets: (activity.relationships.assets || []).map(function (id) {
        return maps.assets[id];
      }).filter(Boolean)
    };
  };

  ns.resolveSession = function (pkg, sessionId) {
    var maps = ns.indexPackage(pkg);
    var session = maps.sessions[sessionId];
    if (!session) return null;
    return {
      document: session,
      activities: (session.relationships.activities || []).map(function (id) {
        return ns.resolveActivity(pkg, id);
      }).filter(Boolean)
    };
  };

  ns.resolveWeek = function (pkg, weekId) {
    var maps = ns.indexPackage(pkg);
    var week = maps.weeks[weekId] || pkg.weeks.filter(function (item) {
      return String(item.metadata && item.metadata.teachingWeek) === String(weekId) || item.id === weekId;
    })[0];
    if (!week) return null;
    return {
      document: week,
      assignment: week.relationships.assignment ? maps.assignments[week.relationships.assignment] : null,
      learningOutcomes: (week.relationships.learningOutcomes || []).map(function (id) {
        return maps.learningOutcomes[id];
      }).filter(Boolean),
      sessions: (week.relationships.sessions || []).map(function (id) {
        return ns.resolveSession(pkg, id);
      }).filter(Boolean)
    };
  };

  ns.resolveCurriculum = function (pkg) {
    var maps = ns.indexPackage(pkg);
    var curriculum = pkg.curriculum;
    return {
      hub: pkg.hub,
      document: curriculum,
      learningOutcomes: (curriculum.relationships.learningOutcomes || []).map(function (id) {
        return maps.learningOutcomes[id];
      }).filter(Boolean),
      assignments: (curriculum.relationships.assignments || []).map(function (id) {
        return maps.assignments[id];
      }).filter(Boolean),
      weeks: (curriculum.relationships.weeks || []).map(function (id) {
        return ns.resolveWeek(pkg, id);
      }).filter(Boolean)
    };
  };

  ns.adaptCurriculum = function (pkg) {
    var weeks = (pkg.weeks || []).map(function (week) {
      var rel = week.relationships || {};
      var meta = week.metadata || {};
      var sessions = (rel.sessions || []).map(function (sessionId) {
        var session = (pkg.sessions || []).filter(function (item) { return item.id === sessionId; })[0];
        if (!session) return null;
        return {
          id: session.id,
          title: session.metadata.title,
          summary: session.metadata.summary || "",
          defaultOpen: session.metadata.defaultOpen === true,
          items: (session.relationships.activities || []).map(function (activityId) {
            var activity = (pkg.activities || []).filter(function (item) { return item.id === activityId; })[0];
            if (!activity) return null;
            return {
              title: activity.metadata.title,
              status: activity.metadata.status,
              href: activity.metadata.href || null
            };
          }).filter(Boolean)
        };
      }).filter(Boolean);
      return {
        teachingWeek: meta.teachingWeek,
        weekKey: week.id,
        title: meta.title,
        learningOutcomes: rel.learningOutcomes || [],
        assignment: rel.assignment,
        phase: meta.phase,
        weekCommencing: meta.weekCommencing == null ? null : meta.weekCommencing,
        releaseDate: meta.releaseDate == null ? null : meta.releaseDate,
        dueDate: meta.dueDate == null ? null : meta.dueDate,
        status: meta.status,
        route: meta.route || ("weeks/" + week.id + "/"),
        professionalPractice: meta.professionalPractice || "",
        sessions: sessions
      };
    }).sort(function (left, right) {
      return left.teachingWeek - right.teachingWeek;
    });

    function getWeek(teachingWeek) {
      return weeks.filter(function (item) {
        return item.teachingWeek === Number(teachingWeek);
      })[0] || null;
    }

    function getWeeksByAssignment(assignmentId) {
      return weeks.filter(function (item) {
        return item.assignment === assignmentId;
      });
    }

    return {
      learningOutcomes: (pkg.learningOutcomes || []).map(function (item) {
        return { id: item.id, title: item.metadata.title };
      }),
      weeks: weeks,
      getWeek: getWeek,
      getWeeksByAssignment: getWeeksByAssignment
    };
  };

  ns.adaptAssignments = function (pkg) {
    var assignments = (pkg.assignments || []).map(function (item) {
      var meta = item.metadata || {};
      var rel = item.relationships || {};
      return {
        id: item.id,
        key: meta.key,
        title: meta.title,
        learningOutcomes: rel.learningOutcomes || [],
        criteria: meta.criteria || [],
        teachingWeeks: (rel.weeks || []).map(function (weekId) {
          var week = (pkg.weeks || []).filter(function (entry) { return entry.id === weekId; })[0];
          return week ? week.metadata.teachingWeek : weekId;
        }),
        releaseDate: meta.releaseDate == null ? null : meta.releaseDate,
        dueDate: meta.dueDate == null ? null : meta.dueDate,
        status: meta.status,
        route: meta.route,
        evidenceNote: meta.evidenceNote,
        stages: meta.stages || []
      };
    });

    function getAssignment(id) {
      return assignments.filter(function (item) {
        return item.id === id || item.key === id;
      })[0] || null;
    }

    return {
      assignments: assignments,
      evidenceMap: assignments.map(function (item) {
        return {
          learningOutcome: (item.learningOutcomes || [])[0],
          assignment: item.id,
          criteria: (item.criteria || []).map(function (criterion) { return criterion.id; }),
          artefact: item.title,
          weeks: item.teachingWeeks
        };
      }),
      getAssignment: getAssignment
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusClass(status) {
    if (status === "available") return "status-label status-label-available";
    if (status === "in-progress") return "status-label status-label-progress";
    return "status-label status-label-planned";
  }

  function statusLabel(status) {
    if (status === "available") return "Available";
    if (status === "in-progress") return "In progress";
    return "Planned";
  }

  function createPath(options, href) {
    if (!href) return "";
    if (/^(https?:|mailto:|#)/i.test(href)) return href;
    var root = (options && options.root) || ".";
    return String(root).replace(/\/?$/, "/") + String(href).replace(/^\.\//, "");
  }

  function simpleMarkdown(text) {
    var escaped = escapeHtml(text || "");
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:[^)\s]+|[^)\s]+)\)/g, function (_match, label, href) {
      if (!/^(https:|\/|\.\/|[a-z0-9-]+\/)/i.test(href)) return label;
      return '<a class="text-link" href="' + escapeHtml(href) + '">' + label + "</a>";
    });
    return escaped.split(/\n{2,}/).map(function (paragraph) {
      return "<p>" + paragraph.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function renderPlaceholder(block, label) {
    return (
      '<div class="lp-block lp-block--placeholder" data-lp-block="' + escapeHtml(block.type) + '">' +
      '<p class="panel-note">' + escapeHtml(label) + "</p>" +
      "</div>"
    );
  }

  var blockRenderers = {
    heading: function (block) {
      var level = Number((block.content || {}).level) || 3;
      if (level < 2) level = 2;
      if (level > 4) level = 4;
      var tag = "h" + level;
      return "<" + tag + " class=\"lp-block lp-block--heading\">" +
        escapeHtml((block.content || {}).text || "") + "</" + tag + ">";
    },
    paragraph: function (block) {
      return '<p class="lp-block lp-block--paragraph">' + escapeHtml((block.content || {}).text || "") + "</p>";
    },
    markdown: function (block) {
      return '<div class="lp-block lp-block--markdown">' + simpleMarkdown((block.content || {}).text || "") + "</div>";
    },
    image: function (block, options) {
      var content = block.content || {};
      var src = createPath(options, content.src || content.href);
      return '<figure class="lp-block lp-block--image"><img src="' + escapeHtml(src) +
        '" alt="' + escapeHtml(content.alt || "") + '">' +
        (content.caption ? "<figcaption>" + escapeHtml(content.caption) + "</figcaption>" : "") +
        "</figure>";
    },
    video: function (block, options) {
      var content = block.content || {};
      var src = createPath(options, content.src || content.href);
      return '<p class="lp-block lp-block--video"><a class="text-link" href="' + escapeHtml(src) + '">' +
        escapeHtml(content.title || "Open video") + "</a></p>";
    },
    callout: function (block) {
      var content = block.content || {};
      return '<aside class="lp-block lp-callout panel-note" data-tone="' +
        escapeHtml(content.tone || "info") + '">' +
        (content.title ? "<strong>" + escapeHtml(content.title) + "</strong> " : "") +
        escapeHtml(content.text || "") + "</aside>";
    },
    accordion: function (block) {
      var content = block.content || {};
      return '<details class="lp-block lp-block--accordion"><summary>' +
        escapeHtml(content.title || "More") + "</summary><p>" +
        escapeHtml(content.body || "") + "</p></details>";
    },
    reference: function (block, options) {
      var content = block.content || {};
      var href = createPath(options, content.href);
      return '<p class="lp-block lp-block--reference"><a class="text-link" href="' +
        escapeHtml(href) + '">' + escapeHtml(content.label || href) + "</a></p>";
    },
    hint: function (block) {
      return '<p class="lp-block lp-block--hint panel-note">' + escapeHtml((block.content || {}).text || "") + "</p>";
    },
    quote: function (block) {
      var content = block.content || {};
      return "<blockquote class=\"lp-block lp-block--quote\"><p>" + escapeHtml(content.text || "") +
        "</p>" + (content.attribution ? "<cite>" + escapeHtml(content.attribution) + "</cite>" : "") +
        "</blockquote>";
    },
    divider: function () {
      return '<hr class="lp-block lp-block--divider">';
    },
    "teacher-note": function (block, options) {
      if (!(options && options.showTeacherNotes)) return "";
      return '<aside class="lp-block lp-block--teacher-note"><p>' +
        escapeHtml((block.content || {}).text || "") + "</p></aside>";
    },
    "single-choice": function (block) {
      var content = block.content || {};
      var questionId = content.questionId || block.id;
      var name = "lp-choice-" + (block.id || questionId);
      var optionsHtml = (content.options || []).map(function (option) {
        var inputId = name + "-" + option.id;
        return '<label class="lp-choice" for="' + escapeHtml(inputId) + '">' +
          '<input type="radio" id="' + escapeHtml(inputId) + '" name="' + escapeHtml(name) +
          '" value="' + escapeHtml(option.id) + '" data-lp-response>' +
          '<span>' + escapeHtml(option.label) + "</span></label>";
      }).join("");
      return interactiveShell(block, questionId,
        '<fieldset class="lp-fieldset"><legend>' + escapeHtml(content.prompt || "Choose one option") +
        "</legend>" + optionsHtml + "</fieldset>" +
        checkButton(block, "Check answer"));
    },
    classification: function (block) {
      var content = block.content || {};
      var questionId = content.questionId || block.id;
      var categories = content.categories || [];
      var itemsHtml = (content.items || []).map(function (item) {
        var selectId = "lp-class-" + (block.id || questionId) + "-" + item.id;
        var options = ['<option value="">Select a type</option>'].concat(categories.map(function (category) {
          return '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.label) + "</option>";
        }));
        return '<div class="lp-classify-item"><label for="' + escapeHtml(selectId) + '">' +
          escapeHtml(item.label) + '</label><select id="' + escapeHtml(selectId) +
          '" data-lp-response data-lp-item="' + escapeHtml(item.id) + '">' + options.join("") +
          '</select><span class="lp-item-status" data-lp-item-status="' + escapeHtml(item.id) +
          '" role="status"></span></div>';
      }).join("");
      return interactiveShell(block, questionId,
        '<fieldset class="lp-fieldset"><legend>' + escapeHtml(content.prompt || "Classify each item") +
        "</legend>" + itemsHtml + "</fieldset>" +
        checkButton(block, "Check types"));
    },
    "short-response": function (block) {
      return textResponseBlock(block, "short-response", 4, "Write a short justification");
    },
    reflection: function (block) {
      return textResponseBlock(block, "reflection", 6, "Write your reflection");
    },
    "code-editor": function (block) {
      return codeBlock(block, false);
    },
    "python-exercise": function (block) {
      return codeBlock(block, true);
    }
  };

  function interactiveShell(block, questionId, inner) {
    var formative = (block.content || {}).formative === true;
    return '<div class="lp-block lp-block--interactive" data-lp-block="' + escapeHtml(block.type) +
      '" data-lp-block-id="' + escapeHtml(block.id) + '" data-lp-question="' + escapeHtml(questionId) +
      '"' + (formative ? ' data-lp-formative="true"' : "") + ">" + inner +
      '<p class="lp-feedback" data-lp-feedback role="status" aria-live="polite"></p></div>';
  }

  function checkButton(block, label) {
    return '<div class="lp-block-actions"><button type="button" class="lp-button" data-lp-check="' +
      escapeHtml(block.id) + '">' + escapeHtml(label) + "</button></div>";
  }

  function textResponseBlock(block, type, rows, label) {
    var content = block.content || {};
    var questionId = content.questionId || block.id;
    var areaId = "lp-text-" + (block.id || questionId);
    return interactiveShell(block, questionId,
      '<label class="lp-label" for="' + escapeHtml(areaId) + '">' +
      escapeHtml(content.prompt || label) + "</label>" +
      '<textarea class="lp-textarea" id="' + escapeHtml(areaId) + '" rows="' + rows +
      '" data-lp-response spellcheck="true"></textarea>' +
      '<div class="lp-block-actions"><button type="button" class="lp-button" data-lp-check="' +
      escapeHtml(block.id) + '">Save response</button></div>');
  }

  function expectedConceptList(content) {
    var concepts = content.expectedConcepts;
    if (!concepts || !concepts.length) {
      concepts = ((content.checks && content.checks.required) || []).map(function (rule) {
        return typeof rule === "string" ? rule : (rule.label || "");
      }).filter(Boolean);
    }
    if (!concepts.length) return "";
    return "Expected constructs: " + concepts.join(", ") + ".";
  }

  function codeBlock(block, isExercise) {
    var content = block.content || {};
    var questionId = content.questionId || block.id;
    var editorId = "lp-code-" + (block.id || questionId);
    var language = isExercise ? "python" : (content.language || "python");
    var hints = (content.hints || []).map(function (hint, index) {
      return '<details class="lp-hint"><summary>Hint ' + (index + 1) + "</summary><p>" +
        escapeHtml(hint) + "</p></details>";
    }).join("");
    var instructions = content.instructions
      ? '<p class="lp-instructions">' + escapeHtml(content.instructions) + "</p>"
      : "";
    var concepts = expectedConceptList(content);
    return interactiveShell(block, questionId,
      instructions +
      '<p class="lp-code-help">Tab moves to the next control. This editor does not run the program in the browser.</p>' +
      '<div class="lp-code-toolbar"><span class="lp-language-badge">' + escapeHtml(language) + "</span>" +
      '<div><button type="button" class="lp-button lp-button--secondary" data-lp-copy="' +
      escapeHtml(block.id) + '">Copy</button>' +
      '<button type="button" class="lp-button lp-button--secondary" data-lp-reset-block="' +
      escapeHtml(block.id) + '">Reset code</button></div></div>' +
      '<label class="lp-label" for="' + escapeHtml(editorId) + '">' +
      escapeHtml(content.label || "Python editor") + "</label>" +
      '<textarea class="lp-code" id="' + escapeHtml(editorId) + '" data-lp-response spellcheck="false" ' +
      'autocapitalize="off" autocomplete="off">' + escapeHtml(content.starter || "") + "</textarea>" +
      (concepts ? '<p class="lp-concepts">' + escapeHtml(concepts) + "</p>" : "") +
      hints +
      (isExercise
        ? '<div class="lp-block-actions"><button type="button" class="lp-button" data-lp-check="' +
          escapeHtml(block.id) + '">Check Python</button></div>'
        : ""));
  }

  ns.renderBlock = function (block, options) {
    var type = ns.getBlockType(block && block.type);
    var renderer;
    options = options || {};
    if (!block) return "";
    if (!type) {
      return renderPlaceholder(block, "Unsupported block type.");
    }
    renderer = blockRenderers[type.id];
    if (renderer) return renderer(block, options);
    return renderPlaceholder(
      block,
      "This " + type.id + " block is registered. Interactive rendering is not enabled yet."
    );
  };

  ns.renderActivity = function (resolved, options) {
    var activity = resolved && resolved.document ? resolved.document : resolved;
    var meta;
    var status;
    var blocks;
    var link = "";
    if (!activity) return "";
    meta = activity.metadata || {};
    status = meta.status || "planned";
    blocks = (activity.blocks || []).map(function (block) {
      return ns.renderBlock(block, options);
    }).join("");
    if (meta.href) {
      link = '<a class="card-link" href="' + escapeHtml(createPath(options, meta.href)) + '">' +
        escapeHtml(meta.title) + "</a>";
    }
    return (
      '<article class="lp-activity panel" data-lp-activity="' + escapeHtml(activity.id) +
      '" data-lp-activity-version="' + escapeHtml(activity.version || "0.1.0") + '">' +
      '<span class="' + statusClass(status) + '" role="status"><span aria-hidden="true">●</span> ' +
      statusLabel(status) + "</span>" +
      "<h3>" + escapeHtml(meta.title || "") + "</h3>" +
      (meta.summary ? "<p>" + escapeHtml(meta.summary) + "</p>" : "") +
      blocks +
      link +
      '<div class="lp-activity-actions">' +
      '<button type="button" class="lp-button lp-button--secondary" data-lp-reset-activity="' +
      escapeHtml(activity.id) + '">Reset activity</button>' +
      '<p class="lp-activity-status" data-lp-activity-status role="status" aria-live="polite"></p>' +
      "</div></article>"
    );
  };

  ns.renderSession = function (resolved, options) {
    var session = resolved.document;
    var meta = session.metadata || {};
    var activities = resolved.activities || [];
    var openAttr = meta.defaultOpen ? " open" : "";
    return (
      '<details class="lp-session session-disclosure panel" id="' + escapeHtml(session.id) + '"' + openAttr + ">" +
      '<summary class="session-disclosure__summary"><span class="session-disclosure__text">' +
      '<h2 class="session-disclosure__heading">' + escapeHtml(meta.title) + "</h2>" +
      '<span class="session-disclosure__meta">' + activities.length +
      (activities.length === 1 ? " activity" : " activities") + "</span></span></summary>" +
      '<div class="session-disclosure__content">' +
      (meta.summary ? '<p class="panel-note">' + escapeHtml(meta.summary) + "</p>" : "") +
      '<div class="lp-activity-list">' +
      activities.map(function (activity) {
        return ns.renderActivity(activity, options);
      }).join("") +
      "</div></div></details>"
    );
  };

  ns.renderWeek = function (resolved, options) {
    var week = resolved.document;
    var meta = week.metadata || {};
    var assignment = resolved.assignment;
    var outcomes = resolved.learningOutcomes || [];
    var sessions = resolved.sessions || [];
    var why;
    var planned;
    options = options || {};
    why =
      '<section class="lp-week-meta panel" aria-labelledby="why-heading">' +
      '<h2 id="why-heading">What you are learning and why</h2>' +
      '<dl class="meta-list">' +
      "<div><dt>Learning outcome</dt><dd>" +
      escapeHtml(outcomes.map(function (item) { return item.id + " " + item.metadata.title; }).join("; ") || "Not set") +
      "</dd></div>" +
      "<div><dt>Assignment</dt><dd>" +
      escapeHtml(assignment ? assignment.id + ": " + assignment.metadata.title : (week.relationships.assignment || "None")) +
      "</dd></div>" +
      "<div><dt>Phase</dt><dd>" + escapeHtml(meta.phase || "") + "</dd></div>" +
      "<div><dt>Teaching week commencing</dt><dd>" +
      escapeHtml(meta.weekCommencing || "Not yet populated from the curriculum planner") +
      "</dd></div></dl>" +
      (meta.professionalPractice
        ? "<p><strong>Professional practice this week:</strong> " + escapeHtml(meta.professionalPractice) + "</p>"
        : "") +
      (assignment && assignment.metadata.route
        ? '<p><a class="text-link" href="' + escapeHtml(createPath(options, assignment.metadata.route)) +
          '">Open the ' + escapeHtml(assignment.id) + " workspace</a></p>"
        : "") +
      "</section>";

    if (!sessions.length) {
      planned =
        '<section class="panel" aria-labelledby="planned-heading">' +
        '<h2 id="planned-heading">Planned teaching week</h2>' +
        "<p>Detailed session activities for this week have not been added yet. The outline below is taken from the curriculum registry and must not be treated as finished teaching content.</p>" +
        '<p><a class="text-link" href="' + escapeHtml(createPath(options, "weeks/")) + '">Back to all weeks</a></p>' +
        "</section>";
      return '<div class="lp-week" data-lp-week="' + escapeHtml(week.id) + '">' + why + planned + "</div>";
    }

    return (
      '<div class="lp-week" data-lp-week="' + escapeHtml(week.id) + '">' +
      why +
      sessions.map(function (session) {
        return ns.renderSession(session, options);
      }).join("") +
      "</div>"
    );
  };

  ns.renderCurriculum = function (resolved, options) {
    var curriculum = resolved.document;
    var weeks = resolved.weeks || [];
    return (
      '<section class="lp-curriculum panel"><h2>' + escapeHtml(curriculum.metadata.title) + "</h2>" +
      "<p>" + weeks.length + " teaching weeks.</p></section>" +
      '<div class="card-grid">' +
      weeks.map(function (week) {
        var meta = week.document.metadata;
        var href = createPath(options, meta.route || ("weeks/" + week.document.id + "/"));
        return (
          '<article class="hub-card' + (meta.status === "available" ? "" : " is-coming-soon") + '">' +
          '<span class="' + statusClass(meta.status) + '" role="status"><span aria-hidden="true">●</span> ' +
          statusLabel(meta.status) + "</span>" +
          "<h2>Week " + escapeHtml(meta.teachingWeek) + "</h2>" +
          "<p>" + escapeHtml(meta.title) + "</p>" +
          '<a class="card-link" href="' + escapeHtml(href) + '">Open Week ' +
          escapeHtml(meta.teachingWeek) + "</a></article>"
        );
      }).join("") +
      "</div>"
    );
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function envelope(schema, id, metadata, relationships, extra) {
    var doc = {
      schema: schema,
      schemaVersion: ns.SCHEMA_VERSION,
      id: String(id).trim(),
      version: ns.SCHEMA_VERSION,
      metadata: metadata || {},
      relationships: relationships || {}
    };
    var key;
    extra = extra || {};
    for (key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        doc[key] = extra[key];
      }
    }
    return doc;
  }

  function splitList(value) {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) return value.map(function (item) { return String(item).trim(); }).filter(Boolean);
    return String(value).split(/[;,|]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function rowsOf(sheets, name) {
    return sheets[name] || sheets[name.toLowerCase()] || [];
  }

  function parseCriteria(value) {
    return splitList(value).map(function (item) {
      var parts = item.split(":");
      return {
        id: parts[0].trim(),
        title: (parts[1] || parts[0]).trim(),
        summary: (parts.slice(2).join(":") || "").trim()
      };
    });
  }

  ns.importFromSheets = function (sheets) {
    var learningOutcomes = rowsOf(sheets, "LearningOutcomes").map(function (row) {
      return envelope(ns.SCHEMAS.LEARNING_OUTCOME, row.id, { title: row.title }, {});
    });
    var assignments = rowsOf(sheets, "Assignments").map(function (row) {
      return envelope(
        ns.SCHEMAS.ASSIGNMENT,
        row.id,
        {
          title: row.title,
          key: row.key || String(row.id).toLowerCase(),
          status: row.status || "planned",
          route: row.route || "",
          evidenceNote: row.evidenceNote || "",
          criteria: parseCriteria(row.criteria),
          releaseDate: row.releaseDate || null,
          dueDate: row.dueDate || null
        },
        {
          learningOutcomes: splitList(row.learningOutcomes),
          weeks: splitList(row.weeks)
        }
      );
    });
    var weeks = rowsOf(sheets, "Weeks").map(function (row) {
      return envelope(
        ns.SCHEMAS.WEEK,
        row.id,
        {
          teachingWeek: Number(row.teachingWeek),
          title: row.title,
          status: row.status || "planned",
          phase: row.phase || "teaching",
          professionalPractice: row.professionalPractice || "",
          route: row.route || ("weeks/" + row.id + "/"),
          weekCommencing: row.weekCommencing || null,
          releaseDate: row.releaseDate || null,
          dueDate: row.dueDate || null
        },
        {
          curriculum: row.curriculum,
          learningOutcomes: splitList(row.learningOutcomes),
          assignment: row.assignment || null,
          sessions: splitList(row.sessions)
        }
      );
    });
    var sessions = rowsOf(sheets, "Sessions").map(function (row) {
      return envelope(
        ns.SCHEMAS.SESSION,
        row.id,
        {
          title: row.title,
          kind: row.kind || "session",
          summary: row.summary || "",
          sortOrder: row.sortOrder == null || row.sortOrder === "" ? 0 : Number(row.sortOrder),
          defaultOpen: String(row.defaultOpen).toLowerCase() === "true"
        },
        {
          week: row.weekId || row.week,
          activities: splitList(row.activities)
        }
      );
    });
    var activityRows = rowsOf(sheets, "Activities");
    var blockRows = rowsOf(sheets, "Blocks");
    var blocksByActivity = {};
    blockRows.forEach(function (row) {
      var activityId = row.activityId;
      if (!blocksByActivity[activityId]) blocksByActivity[activityId] = [];
      blocksByActivity[activityId].push(ns.normaliseBlock({
        id: row.id,
        type: row.type,
        content: {
          text: row.text || "",
          title: row.title || "",
          body: row.body || "",
          tone: row.tone || "",
          level: row.level ? Number(row.level) : undefined,
          href: row.href || "",
          src: row.src || "",
          alt: row.alt || ""
        },
        relationships: {
          question: row.question || undefined,
          asset: row.asset || undefined
        }
      }));
    });
    var activities = activityRows.map(function (row) {
      return envelope(
        ns.SCHEMAS.ACTIVITY,
        row.id,
        {
          title: row.title,
          status: row.status || "planned",
          summary: row.summary || "",
          href: row.href || null
        },
        {
          learningOutcomes: splitList(row.learningOutcomes),
          questions: splitList(row.questions),
          assets: splitList(row.assets)
        },
        { blocks: blocksByActivity[row.id] || [] }
      );
    });

    return ns.loadPackageFromFiles({
      hub: sheets.hub,
      curriculum: sheets.curriculum,
      learningOutcomes: learningOutcomes,
      assignments: assignments,
      weeks: weeks,
      sessions: sessions,
      activities: activities,
      questions: rowsOf(sheets, "Questions").map(function (row) {
        return envelope(ns.SCHEMAS.QUESTION, row.id, {
          kind: row.kind,
          prompt: row.prompt,
          marking: { mode: row.markingMode || "protected" }
        }, {});
      }),
      assets: rowsOf(sheets, "Assets").map(function (row) {
        return envelope(ns.SCHEMAS.ASSET, row.id, {
          kind: row.kind,
          href: row.href,
          alt: row.alt || "",
          caption: row.caption || ""
        }, {});
      })
    });
  };

  ns.importJSON = function (value) {
    if (typeof value === "string") value = ns.readJsonValue(value, "import");
    if (value.hub && value.curriculum) {
      return ns.loadPackageFromFiles(value);
    }
    if (value.LearningOutcomes || value.Weeks) {
      return ns.importFromSheets(value);
    }
    throw new Error("Unsupported JSON import shape");
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
(function (root) {
  "use strict";

  var ns = root.LearningPlatformContent = root.LearningPlatformContent || {};

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var index;
    var character;
    var next;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (index = 0; index < text.length; index += 1) {
      character = text.charAt(index);
      if (inQuotes) {
        if (character === '"') {
          next = text.charAt(index + 1);
          if (next === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }
      } else if (character === '"') {
        inQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        if (row.some(function (cell) { return String(cell).trim() !== ""; })) rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }
    if (field !== "" || row.length) {
      row.push(field);
      if (row.some(function (cell) { return String(cell).trim() !== ""; })) rows.push(row);
    }
    return rows;
  }

  function rowsToObjects(rows) {
    var headers;
    if (!rows.length) return [];
    headers = rows[0].map(function (cell) { return String(cell).trim(); });
    return rows.slice(1).map(function (cells) {
      var record = {};
      headers.forEach(function (header, index) {
        record[header] = cells[index] == null ? "" : String(cells[index]).trim();
      });
      return record;
    });
  }

  ns.parseCsvSheet = function (text) {
    return rowsToObjects(parseCsv(text));
  };

  ns.importFromCsvSheets = function (csvByName, hub, curriculum) {
    var sheets = { hub: hub, curriculum: curriculum };
    Object.keys(csvByName || {}).forEach(function (name) {
      sheets[name] = ns.parseCsvSheet(csvByName[name]);
    });
    return ns.importFromSheets(sheets);
  };

  ns.EXCEL_SHEET_NAMES = Object.freeze([
    "LearningOutcomes",
    "Assignments",
    "Weeks",
    "Sessions",
    "Activities",
    "Blocks",
    "Questions",
    "Assets"
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);

export function getLearningPlatformContent() {
  return globalThis.LearningPlatformContent;
}
