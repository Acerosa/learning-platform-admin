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
