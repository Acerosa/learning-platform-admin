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
