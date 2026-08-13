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
