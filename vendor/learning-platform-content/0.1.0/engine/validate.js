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
