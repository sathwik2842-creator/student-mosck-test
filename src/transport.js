import { httpsCallable } from "firebase/functions";
import { auth, functions, useEmulators } from "./firebase";

export async function invoke(name, data = {}) {
  if (useEmulators || import.meta.env.VITE_API_BACKEND !== "vercel")
    return (await httpsCallable(functions, name, { timeout: 120000 })(data)).data;
  const user = auth?.currentUser;
  if (!user) throw Object.assign(new Error("Sign in to continue."), { code: "functions/unauthenticated" });
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch("/api/veda", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operation: name, data }),
      signal: controller.signal,
      credentials: "omit",
    });
    const body = await response.json();
    if (!response.ok || body.error)
      throw Object.assign(new Error(body.error?.message || "The server is unavailable."), {
        code: `functions/${body.error?.code || "unavailable"}`,
      });
    return body.data;
  } catch (error) {
    if (error.name === "AbortError")
      throw Object.assign(new Error("The request timed out. Please retry."), { code: "functions/deadline-exceeded" });
    throw error;
  } finally { clearTimeout(timeout); }
}
