import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
const invoke = async (name, data = {}) =>
  (await httpsCallable(functions, name, { timeout: 120000 })(data)).data;
export const getOverview = () => invoke("adminOverview");
export const getTest = (id) => invoke("adminGetTest", { id });
export const saveTest = (id, paper, expectedVersion) =>
  invoke("adminSaveTest", { id, paper, expectedVersion });
export const deleteTest = (id, expectedVersion) =>
  invoke("adminDeleteTest", { id, expectedVersion });
export const saveQuestion = (id, question, expectedVersion) =>
  invoke("adminSaveQuestion", { id, question, expectedVersion });
export const deleteQuestion = (id, expectedVersion) =>
  invoke("adminDeleteQuestion", { id, expectedVersion });
export const importQuestions = (questions, importId) =>
  invoke("adminImportQuestions", { questions, importId });
export const watchTests = (success, error) =>
  onSnapshot(
    collection(db, "testCatalog"),
    (s) =>
      success(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.title.localeCompare(b.title)),
      ),
    error,
  );
export const watchQuestions = (count, success, error) =>
  onSnapshot(
    query(
      collection(db, "questionBank"),
      orderBy("updatedAt", "desc"),
      limit(count),
    ),
    (s) => success(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error,
  );
export const watchSubmissions = (success, error) =>
  onSnapshot(
    query(collection(db, "results"), orderBy("submittedAt", "desc"), limit(50)),
    (s) => success(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error,
  );
