import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readServiceAccount, ServerConfigurationError } from "../lib/server-credentials.js";
// Ephemeral fixture only; never a Firebase service-account credential.
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
const account = { type: "service_account", project_id: "demo-veda-test", client_email: "fixture@demo-veda-test.iam.gserviceaccount.com", private_key: privateKey };
test("whole JSON supports downloaded Firebase format and takes precedence over old split values", () => {
  const actual=readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account), FIREBASE_PRIVATE_KEY:"old-invalid-value" });
  assert.equal(actual.privateKey,privateKey); assert.equal(actual.projectId,account.project_id);
});
test("split credentials accept actual newlines or literal escaped newlines", () => {
  for(const key of [privateKey,privateKey.replace(/\n/g,"\\n")]) {
    assert.equal(readServiceAccount({FIREBASE_PROJECT_ID:account.project_id,FIREBASE_CLIENT_EMAIL:account.client_email,FIREBASE_PRIVATE_KEY:key}).privateKey,privateKey);
  }
});
test("malformed JSON, project mismatch and incomplete PEM fail closed without exposing secrets", () => {
  for(const [env,reason] of [
    [{FIREBASE_SERVICE_ACCOUNT_JSON:"private-secret-invalid-json"},"service-account-json-invalid"],
    [{FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(account),FIREBASE_PROJECT_ID:"other-project"},"service-account-project-mismatch"],
    [{FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({...account,private_key:"private-secret-invalid-pem"})},"private-key-pem-invalid"],
    [{FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({...account,type:"authorized_user"})},"service-account-json-wrong-type"],
  ]) {
    assert.throws(()=>readServiceAccount(env), e=>e instanceof ServerConfigurationError && e.reason===reason && !e.message.includes("private-secret"));
  }
});
