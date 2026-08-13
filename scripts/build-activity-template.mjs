import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workbook = XLSX.utils.book_new();

function add(name, rows) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

add("LearningOutcomes", []);
add("Assignments", []);
add("Weeks", []);
add("Sessions", []);
add("Activities", [{
  id: "admin-mvp-sample",
  title: "Admin MVP sample activity",
  status: "available",
  summary: "Synthetic activity for authoring import tests. Not Unit 14 Week 1.",
}]);
add("Blocks", [
  { activityId: "admin-mvp-sample", id: "admin-mvp-h", type: "heading", text: "Sample heading", title: "", body: "", prompt: "", question: "" },
  { activityId: "admin-mvp-sample", id: "admin-mvp-q1", type: "single-choice", text: "", title: "", body: "", prompt: "Which value is a whole number?", question: "" },
]);
add("Questions", []);
add("Assets", []);
add("Options", [
  { blockId: "admin-mvp-q1", optionId: "a", label: "3", correct: "true" },
  { blockId: "admin-mvp-q1", optionId: "b", label: "three", correct: "false" },
  { blockId: "admin-mvp-q1", optionId: "c", label: "3.5", correct: "false" },
]);
add("Feedback", [
  { blockId: "admin-mvp-q1", correct: "3 is an integer.", incorrect: "A whole number uses an integer type." },
]);

const destinations = [
  join(root, "public/templates"),
  join(root, "github-pages/public/templates"),
];
destinations.forEach((dir) => mkdirSync(dir, { recursive: true }));
destinations.forEach((dir) => XLSX.writeFile(workbook, join(dir, "lp-content-activity-import.xlsx")));
console.log("Wrote lp-content-activity-import.xlsx");
