import type { AdminMutationService } from "../api/admin-api";

function pending(): Promise<never> {
  return Promise.reject(
    new Error("Administrative mutation contract is pending in backend 0.1.0."),
  );
}

export const pendingAdminMutations: AdminMutationService = Object.freeze({
  status: "pending-backend-contract",
  registerHub: pending,
  updateHub: pending,
  deactivateHub: pending,
  updateCurriculum: pending,
  updateLearner: pending,
  updateTeacher: pending,
  updateGroup: pending,
  updateEnrolment: pending,
  updateAssignment: pending,
});
