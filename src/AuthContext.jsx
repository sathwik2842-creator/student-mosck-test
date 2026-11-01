import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, db, googleProvider, missingFirebaseConfig } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(!!auth),
    [error, setError] = useState("");
  const [role, setRole] = useState({
    uid: null,
    isAdmin: false,
    loading: false,
    error: "",
  });
  useEffect(() => {
    if (!user) {
      setRole({ uid: null, isAdmin: false, loading: false, error: "" });
      return;
    }
    const uid = user.uid;
    setRole({ uid, isAdmin: false, loading: true, error: "" });
    const timer = setTimeout(
      () =>
        setRole({
          uid,
          isAdmin: false,
          loading: false,
          error:
            "Administrator access could not be verified. Check your database connection.",
        }),
      10000,
    );
    const stop = onSnapshot(
      doc(db, "roles", uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) return;
        clearTimeout(timer);
        setRole({
          uid,
          isAdmin: snapshot.exists() && snapshot.data().isAdmin === true,
          loading: false,
          error: "",
        });
      },
      () => {
        clearTimeout(timer);
        setRole({
          uid,
          isAdmin: false,
          loading: false,
          error: "Administrator access could not be verified.",
        });
      },
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setLoading(false);
      },
      () => {
        setError(
          "We could not restore your session. Please reload and try again.",
        );
        setLoading(false);
      },
    );
  }, []);
  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email.trim(), password);
  const signup = async (name, email, password) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    await updateProfile(credential.user, { displayName: name.trim() });
    setUser({ ...credential.user, displayName: name.trim() });
    return credential;
  };
  const googleLogin = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        signup,
        googleLogin,
        logout,
        configured: missingFirebaseConfig.length === 0,
        isAdmin: !!user && role.uid === user.uid && role.isAdmin,
        roleLoading: !!user && (role.uid !== user.uid || role.loading),
        roleError: role.error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
export function authErrorMessage(error) {
  const messages = {
    "auth/internal-error":
      "Sign-in could not initialize. Check your network and Firebase configuration, then try again.",
    "auth/argument-error":
      "Sign-in could not initialize. Check your network and Firebase configuration, then try again.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/email-already-in-use":
      "An account already exists with that email. Please log in.",
    "auth/weak-password":
      "Choose a stronger password with at least 8 characters.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a moment before trying again.",
    "auth/popup-closed-by-user":
      "Google sign-in was cancelled. Please try again.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in window. Allow popups and try again.",
    "auth/unauthorized-domain":
      "This domain is not enabled for sign-in. Ask the project owner to add it in Firebase Authentication.",
    "auth/operation-not-allowed":
      "This sign-in provider is not enabled in Firebase Authentication.",
    "auth/network-request-failed":
      "Unable to connect. Check your connection and try again.",
    "auth/invalid-api-key":
      "Firebase web configuration is invalid. Check your environment settings.",
  };
  return messages[error?.code] || "We couldn’t sign you in. Please try again.";
}
