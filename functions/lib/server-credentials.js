import { createPrivateKey } from "node:crypto";

export class ServerConfigurationError extends Error {
  constructor(reason) {
    super("Firebase server configuration is invalid.");
    this.code = "internal";
    this.reason = reason;
  }
}
const invalid = reason => { throw new ServerConfigurationError(reason); };

// Server only. Never import this module into the React application.
export function readServiceAccount(env) {
  let account;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON.replace(/^\uFEFF/, "").trim()); }
    catch { invalid("service-account-json-invalid"); }
    if (!account || account.type !== "service_account") invalid("service-account-json-wrong-type");
  } else {
    account = {
      project_id: env.FIREBASE_PROJECT_ID,
      client_email: env.FIREBASE_CLIENT_EMAIL,
      private_key: env.FIREBASE_PRIVATE_KEY,
    };
  }
  const { project_id: projectId, client_email: clientEmail } = account;
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))
    invalid("project-id-invalid");
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== projectId)
    invalid("service-account-project-mismatch");
  if (typeof clientEmail !== "string" || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(clientEmail))
    invalid("service-account-email-invalid");
  if (typeof account.private_key !== "string") invalid("private-key-missing");
  const privateKey = account.private_key.replace(/\\n/g, "\n").trim() + "\n";
  try {
    const key = createPrivateKey(privateKey);
    if (key.asymmetricKeyType !== "rsa") invalid("private-key-not-rsa");
  } catch (error) {
    if (error instanceof ServerConfigurationError) throw error;
    invalid("private-key-pem-invalid");
  }
  return { projectId, clientEmail, privateKey };
}
