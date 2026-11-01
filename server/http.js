export const operations = new Set([
  "startTest", "saveAttempt", "submitTest", "adminOverview", "adminGetTest",
  "adminSaveTest", "adminDeleteTest", "adminSaveQuestion", "adminDeleteQuestion", "adminImportQuestions",
]);
const statuses = { "unauthenticated": 401, "permission-denied": 403, "invalid-argument": 400,
  "not-found": 404, "aborted": 409, "failed-precondition": 412, "resource-exhausted": 429,
  "deadline-exceeded": 504, "unavailable": 503 };

export function createHandler({ verifyToken, getHandlers }) {
  return async (req, res) => {
    const started = performance.now();
    let operation = "unknown";
    const respond = (status, payload) => {
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      res.setHeader("Server-Timing", `api;dur=${durationMs}`);
      if (durationMs >= 2000)
        console.info("Slow API request", { operation, status, durationMs });
      return res.status(status).json(payload);
    };
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return respond(405, { error: { code: "invalid-argument", message: "Use POST." } });
    }
    try {
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
        throw Object.assign(new Error("Use a JSON request."), { code: "invalid-argument" });
      const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
      if (!bearer) throw Object.assign(new Error("Sign in to continue."), { code: "unauthenticated" });
      // Verify signature, expiry, issuer, audience, revocation and disabled-user state.
      let token;
      try { token = await verifyToken(bearer[1]); }
      catch (error) {
        const tokenErrors = new Set([
          "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
          "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found",
        ]);
        const diagnosticCode = typeof error.code === "string" && /^[a-z0-9/._-]{1,80}$/i.test(error.code)
          ? error.code : "unknown";
        // Log codes only: never log tokens, key material, or SDK error messages.
        console.error("Firebase identity verification failed", { code: diagnosticCode });
        if (error.code === "internal") throw error;
        if (tokenErrors.has(error.code))
          throw Object.assign(new Error("Your login could not be verified. Please sign in again."), { code: "unauthenticated" });
        throw Object.assign(new Error("Server authentication is unavailable. Ask the administrator to check Firebase server credentials."), { code: "unavailable" });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || Buffer.byteLength(JSON.stringify(body)) > 1000000 || !operations.has(body.operation))
        throw Object.assign(new Error("Invalid operation or request size."), { code: "invalid-argument" });
      operation = body.operation;
      const handlers = await getHandlers();
      const handler = handlers[body.operation];
      const data = await handler.run({ data: body.data, auth: { uid: token.uid, token } });
      return respond(200, { data });
    } catch (error) {
      const code = error instanceof SyntaxError ? "invalid-argument" : error.code;
      const status = statuses[code] || 500;
      if (status === 500) console.error("API operation failed", { code: "internal" });
      return respond(status, { error: {
        code: status === 500 ? "internal" : code,
        message: status === 500 ? "Unable to complete the operation. Please retry." : error.message,
      } });
    }
  };
}
