export const operations = new Set([
  "startTest", "saveAttempt", "submitTest", "adminOverview", "adminGetTest",
  "adminSaveTest", "adminDeleteTest", "adminSaveQuestion", "adminDeleteQuestion", "adminImportQuestions",
]);
const statuses = { "unauthenticated": 401, "permission-denied": 403, "invalid-argument": 400,
  "not-found": 404, "aborted": 409, "failed-precondition": 412, "resource-exhausted": 429,
  "deadline-exceeded": 504, "unavailable": 503 };

export function createHandler({ verifyToken, getHandlers }) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: { code: "invalid-argument", message: "Use POST." } });
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
        if (error.code === "internal") throw error;
        throw Object.assign(new Error("Your session expired. Sign in again."), { code: "unauthenticated" });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || Buffer.byteLength(JSON.stringify(body)) > 1000000 || !operations.has(body.operation))
        throw Object.assign(new Error("Invalid operation or request size."), { code: "invalid-argument" });
      const handlers = await getHandlers();
      const handler = handlers[body.operation];
      const data = await handler.run({ data: body.data, auth: { uid: token.uid, token } });
      return res.status(200).json({ data });
    } catch (error) {
      const code = error instanceof SyntaxError ? "invalid-argument" : error.code;
      const status = statuses[code] || 500;
      if (status === 500) console.error("API operation failed", { code: "internal" });
      return res.status(status).json({ error: {
        code: status === 500 ? "internal" : code,
        message: status === 500 ? "Unable to complete the operation. Please retry." : error.message,
      } });
    }
  };
}
