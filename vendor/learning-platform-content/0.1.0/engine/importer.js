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
