import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_READ_PAGE_SIZE,
  AdminReadError,
  createSupabaseAdminReadService,
  type AdminSupabaseClient,
} from "../src/services/supabase-admin-service.ts";

type RangeCall = { view: string; from: number; to: number };

function pagedClient(options: {
  views: Record<string, readonly Record<string, unknown>[]>;
  failViewOnPage?: { view: string; pageFrom: number };
}) {
  const ranges: RangeCall[] = [];
  const client = {
    schema() {
      return {
        from(view: string) {
          let queryRange: { from: number; to: number } | null = null;
          const query = {
            select() { return query; },
            order() { return query; },
            range(from: number, to: number) {
              queryRange = { from, to };
              return query;
            },
            then(resolve: (value: unknown) => unknown) {
              const all = options.views[view] ?? [];
              if (!queryRange) {
                return Promise.resolve(resolve({ data: all, error: null }));
              }
              ranges.push({ view, from: queryRange.from, to: queryRange.to });
              if (options.failViewOnPage && options.failViewOnPage.view === view && options.failViewOnPage.pageFrom === queryRange.from) {
                return Promise.resolve(resolve({ data: null, error: { code: "503" } }));
              }
              return Promise.resolve(resolve({
                data: all.slice(queryRange.from, queryRange.to + 1),
                error: null,
              }));
            },
          };
          return query;
        },
      };
    },
  } as unknown as AdminSupabaseClient;
  return { client, ranges };
}

function learnerRow(index: number, extra: Record<string, unknown> = {}) {
  return {
    learner_id: extra.learner_id ?? `learner-${String(index).padStart(4, "0")}`,
    student_number: extra.student_number ?? `PAD-${String(index).padStart(4, "0")}`,
    display_name: extra.display_name ?? `Filler ${index}`,
    course_id: "course-tlevel",
    course_key: "tlevel-digital-software-development",
    course_title: "T Level Digital Software Development",
    group_id: "group-a",
    group_code: extra.group_code ?? "TEST-GROUP-A",
    group_name: "RR NHC Synthetic Test Group A",
    assignment_id: extra.assignment_id ?? `assignment-${index}`,
    activity_id: extra.activity_id ?? `activity-${index}`,
    activity_key: extra.activity_key ?? `filler-${index}`,
    activity_title: extra.activity_title ?? `Filler activity ${index}`,
    activity_version: "1.0.0",
    hub_codes: ["tlevel-software-development"],
    hub_names: ["T Level Digital Software Development"],
    week_number: null,
    week_title: null,
    attempt_count: extra.attempt_count ?? 0,
    completed_attempt_count: extra.completed_attempt_count ?? 0,
    first_score_percentage: extra.first_score_percentage ?? null,
    latest_score_percentage: extra.latest_score_percentage ?? null,
    best_score_percentage: extra.best_score_percentage ?? null,
    average_score_percentage: extra.average_score_percentage ?? null,
    first_completed_at: extra.first_completed_at ?? null,
    latest_completed_at: extra.latest_completed_at ?? null,
    requires_review_count: 0,
    reviewed_response_count: 0,
  };
}

function questionGroupRow(index: number) {
  return {
    group_code: "TEST-GROUP-A",
    group_name: "RR NHC Synthetic Test Group A",
    course_key: "tlevel-digital-software-development",
    course_title: "T Level Digital Software Development",
    assignment_id: `assignment-${Math.floor(index / 20)}`,
    activity_key: `activity-${Math.floor(index / 20)}`,
    activity_title: `Activity ${Math.floor(index / 20)}`,
    activity_version: "1.0.0",
    question_key: `Q-${String(index).padStart(4, "0")}`,
    question_title: `Question ${index}`,
    question_type: "single",
    section_key: "section-a",
    ordinal: index,
    topic_keys: [],
    skill_keys: [],
    response_count: 0,
    correct_count: 0,
    incorrect_count: 0,
    unanswered_count: 0,
    requires_review_count: 0,
    reviewed_response_count: 0,
    correctness_percentage: null,
    average_awarded_score: null,
    average_max_score: null,
  };
}

function questionRow(index: number) {
  return {
    activity_key: `activity-${Math.floor(index / 20)}`,
    activity_version: "1.0.0",
    question_key: `Q-${String(index).padStart(4, "0")}`,
    question_type: "single",
    section_key: "section-a",
    topic_keys: [],
    skill_keys: [],
    response_count: 0,
    correct_count: 0,
    incorrect_count: 0,
    requires_review_count: 0,
    reviewed_response_count: 0,
    correctness_percentage: null,
    average_awarded_score: null,
    average_max_score: null,
  };
}

test("learner activity performance pages past the PostgREST row cap", async () => {
  const synth = learnerRow(1208, {
    learner_id: "a2000000-0000-4000-8000-000000000001",
    student_number: "SYNTH-0001",
    display_name: "Synthetic Student A",
    assignment_id: "a5000000-0000-4000-8000-000000000001",
    activity_id: "activity-requirements",
    activity_key: "foundations-requirements-classification",
    activity_title: "Requirements Classification",
    attempt_count: 9,
    completed_attempt_count: 9,
    first_score_percentage: 50,
    latest_score_percentage: 5,
    best_score_percentage: 100,
    average_score_percentage: 78.33,
  });
  const rows = Array.from({ length: 1208 }, (_, index) => learnerRow(index));
  rows.push(synth);
  assert.equal(rows.length, 1209);
  assert.ok(rows.findIndex((row) => row.student_number === "SYNTH-0001") > ADMIN_READ_PAGE_SIZE);

  const fake = pagedClient({ views: { learner_activity_performance: rows } });
  const service = createSupabaseAdminReadService(fake.client);
  const loaded = await service.listLearnerActivityPerformance();

  assert.equal(loaded.length, 1209);
  assert.equal(fake.ranges.length, 2);
  assert.deepEqual(fake.ranges[0], { view: "learner_activity_performance", from: 0, to: ADMIN_READ_PAGE_SIZE - 1 });
  assert.deepEqual(fake.ranges[1], { view: "learner_activity_performance", from: ADMIN_READ_PAGE_SIZE, to: ADMIN_READ_PAGE_SIZE * 2 - 1 });
  const pageTwoRow = loaded[ADMIN_READ_PAGE_SIZE];
  assert.ok(pageTwoRow);
  const synthRow = loaded.find((row) => row.studentNumber === "SYNTH-0001");
  assert.ok(synthRow);
  assert.equal(synthRow.displayName, "Synthetic Student A");
  assert.equal(synthRow.firstScorePercentage, 50);
  assert.equal(synthRow.latestScorePercentage, 5);
  assert.equal(synthRow.bestScorePercentage, 100);
  assert.equal(synthRow.averageScorePercentage, 78.33);
});

test("question group performance loads every page and stops on a short final page", async () => {
  const rows = Array.from({ length: 1562 }, (_, index) => questionGroupRow(index));
  const fake = pagedClient({ views: { question_group_performance: rows } });
  const service = createSupabaseAdminReadService(fake.client);
  const loaded = await service.listQuestionGroupPerformance();
  assert.equal(loaded.length, 1562);
  assert.notEqual(loaded.length, ADMIN_READ_PAGE_SIZE);
  assert.equal(fake.ranges.length, 2);
  assert.equal(fake.ranges[1]?.from, ADMIN_READ_PAGE_SIZE);
  assert.equal(loaded[1561]?.questionKey, "Q-1561");
});

test("platform question performance is not truncated at 1000 rows", async () => {
  const rows = Array.from({ length: 1562 }, (_, index) => questionRow(index));
  const fake = pagedClient({ views: { question_performance: rows } });
  const service = createSupabaseAdminReadService(fake.client);
  const loaded = await service.listQuestionPerformance();
  assert.equal(loaded.length, 1562);
  assert.equal(fake.ranges.length, 2);
});

test("a later page error fails the analytics read instead of returning a partial page", async () => {
  const rows = Array.from({ length: 1209 }, (_, index) => learnerRow(index));
  const fake = pagedClient({
    views: { learner_activity_performance: rows },
    failViewOnPage: { view: "learner_activity_performance", pageFrom: ADMIN_READ_PAGE_SIZE },
  });
  const service = createSupabaseAdminReadService(fake.client);
  await assert.rejects(
    () => service.listLearnerActivityPerformance(),
    (error: unknown) => error instanceof AdminReadError,
  );
  assert.equal(fake.ranges.length, 2);
});
