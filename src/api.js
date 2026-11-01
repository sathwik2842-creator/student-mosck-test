import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
const call = async (name, data) => {
  const response = await httpsCallable(functions, name)(data);
  return response.data;
};
export const startTest = (testId) => call("startTest", { testId });
export const saveAttempt = (attemptId, answers, revision) =>
  call("saveAttempt", { attemptId, answers, revision });
export const submitTest = (attemptId, answers) =>
  call("submitTest", { attemptId, answers });
function subscribeQuery(reference, onData, onError) {
  const timeout = setTimeout(
    () =>
      onError({
        code: "unavailable",
        message:
          "The database could not be reached. Check the Firebase configuration or emulator connection.",
      }),
    10000,
  );
  const unsubscribe = onSnapshot(
    reference,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) clearTimeout(timeout);
      if (!snapshot.metadata.fromCache || !snapshot.empty) onData(snapshot);
    },
    (error) => {
      clearTimeout(timeout);
      onError(error);
    },
  );
  return () => {
    clearTimeout(timeout);
    unsubscribe();
  };
}
export const subscribeTests = (success, error) =>
  subscribeQuery(
    query(collection(db, "testCatalog"), where("active", "==", true)),
    (snapshot) =>
      success(
        snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
      ),
    error,
  );
export const subscribeResults = (userId, success, error) =>
  subscribeQuery(
    query(
      collection(db, "results"),
      where("userId", "==", userId),
      orderBy("submittedAt", "desc"),
      limit(100),
    ),
    (snapshot) =>
      success(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error,
  );
export function apiErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("unauthenticated"))
    return "Your session expired. Please sign in again.";
  if (code.includes("permission-denied"))
    return "You do not have access to this data.";
  if (code.includes("unavailable"))
    return "The server is unavailable. Check your connection and retry; keep any active test open.";
  if (code.includes("deadline-exceeded"))
    return "The request timed out. Please retry; duplicate submissions are safe.";
  if (code.includes("not-found"))
    return "This test or attempt is no longer available.";
  return error?.message?.startsWith("INTERNAL")
    ? "Something went wrong on the server. Please try again."
    : error?.message || "Unable to connect. Please try again.";
}
