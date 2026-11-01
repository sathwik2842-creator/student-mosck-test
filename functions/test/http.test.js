import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../../server/http.js";
async function request({ method = "POST", body = { operation: "startTest", data: { testId: "main" } }, token = "valid", verify, handler } = {}) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(v) { this.code=v; return this; }, json(v) { this.body=v; return this; } };
  await createHandler({ verifyToken: verify || (async t => { assert.equal(t,"valid"); return { uid: "verified-user", email: "student@example.invalid" }; }),
    getHandlers: async () => ({ startTest: { run: handler || (async r => ({ uid: r.auth.uid, testId: r.data.testId })) } }),
  })({ method, headers: { "content-type":"application/json", ...(token ? { authorization:`Bearer ${token}` } : {}) }, body },res);
  return res;
}
test("HTTP adapter requires verified identity and ignores forged client auth", async () => {
  const r = await request({ body: { operation:"startTest", data:{ testId:"main", auth:{ uid:"attacker" } }, auth:{uid:"attacker"} } });
  assert.equal(r.code,200); assert.equal(r.body.data.uid,"verified-user"); assert.equal(r.headers["Cache-Control"],"no-store");
});
test("HTTP adapter rejects missing, expired and revoked tokens", async () => {
  assert.equal((await request({token:null})).code,401);
  assert.equal((await request({verify:async()=>{throw Object.assign(new Error("revoked"),{code:"auth/id-token-revoked"});}})).code,401);
});
test("HTTP adapter restricts method, operation, malformed JSON and payload size", async () => {
  assert.equal((await request({method:"GET"})).code,405);
  assert.equal((await request({body:{operation:"__proto__"}})).code,400);
  assert.equal((await request({body:"{"})).code,400);
  assert.equal((await request({body:{operation:"startTest",data:"x".repeat(1000001)}})).code,400);
});
test("HTTP adapter preserves authorization errors without exposing internal errors", async () => {
  const denied=await request({handler:async()=>{throw Object.assign(new Error("Admin required"),{code:"permission-denied"});}});
  assert.equal(denied.code,403);
  const broken=await request({handler:async()=>{throw new Error("private-secret");}});
  assert.equal(broken.code,500); assert.ok(!JSON.stringify(broken.body).includes("private-secret"));
});

test("HTTP adapter distinguishes server credential failure from rejected login tokens", async () => {
  for (const code of ["auth/invalid-credential", "app/invalid-credential", "auth/insufficient-permission"]) {
    const result = await request({verify: async()=>{throw Object.assign(new Error("secret-private-key"),{code});}});
    assert.equal(result.code,503);
    assert.equal(result.body.error.code,"unavailable");
    assert.ok(!JSON.stringify(result.body).includes("secret-private-key"));
  }
  for (const code of ["auth/invalid-id-token", "auth/id-token-expired", "auth/user-disabled"]) {
    assert.equal((await request({verify:async()=>{throw Object.assign(new Error("token"),{code});}})).code,401);
  }
});
