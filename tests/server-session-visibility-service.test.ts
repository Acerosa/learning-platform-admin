import assert from "node:assert/strict";
import test from "node:test";
import { setSessionVisibility, AdminPublicationError } from "../src/services/supabase-admin-service.ts";

function fakeClient(result: unknown, error: { message: string } | null = null) {
  return {
    schema() {
      return {
        rpc(name: string, args: Record<string, unknown>) {
          assert.equal(name, "set_session_visibility");
          assert.deepEqual(Object.keys(args).sort(), [
            "p_course_key",
            "p_hub_code",
            "p_session_id",
            "p_status",
          ]);
          assert.equal("p_package" in args, false);
          return Promise.resolve({ data: result, error });
        },
      };
    },
  } as never;
}

const HUBS = [
  { hubCode: "tlevel-software-development", courseKey: "t-level-digital-software-development", sessionId: "week-1-lesson-3" },
  { hubCode: "unit-3-cyber-security", courseKey: "ocr-level-3-it", sessionId: "week-1-session-1" },
  { hubCode: "unit-14-software-engineering-for-business", courseKey: "ocr-level-3-it", sessionId: "week-1-session-1" },
  { hubCode: "l2e-exploring-emerging-digital-technologies", courseKey: "gateway-level-2-digital-it-skills", sessionId: "week-1-session-1" },
] as const;

for (const hub of HUBS) {
  test(`setSessionVisibility for ${hub.hubCode} calls RPC without package JSON`, async () => {
    const result = await setSessionVisibility(fakeClient([{
      publication_id: "pub-1",
      previous_package_version: "0.2.10",
      package_version: "0.2.11",
      session_id: hub.sessionId,
      previous_status: "planned",
      status: "available",
      idempotent: false,
    }]), {
      hubCode: hub.hubCode,
      courseKey: hub.courseKey,
      sessionId: hub.sessionId,
      status: "available",
    });
    assert.equal(result.packageVersion, "0.2.11");
    assert.equal(result.idempotent, false);
    assert.equal(result.sessionId, hub.sessionId);
  });
}

test("setSessionVisibility maps backend error codes", async () => {
  await assert.rejects(
    () => setSessionVisibility(fakeClient(null, { message: "WEEK_NOT_AVAILABLE" }), {
      hubCode: "tlevel-software-development",
      courseKey: "t-level-digital-software-development",
      sessionId: "week-1-lesson-3",
      status: "available",
    }),
    (error: unknown) => error instanceof AdminPublicationError && error.code === "WEEK_NOT_AVAILABLE",
  );
});

test("idempotent RPC response is returned as-is", async () => {
  const result = await setSessionVisibility(fakeClient([{
    publication_id: "pub-1",
    previous_package_version: "0.3.31",
    package_version: "0.3.31",
    session_id: "week-1-lesson-3",
    previous_status: "available",
    status: "available",
    idempotent: true,
  }]), {
    hubCode: "tlevel-software-development",
    courseKey: "t-level-digital-software-development",
    sessionId: "week-1-lesson-3",
    status: "available",
  });
  assert.equal(result.idempotent, true);
  assert.equal(result.packageVersion, "0.3.31");
});
