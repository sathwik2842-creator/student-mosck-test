import React from "react";
import { GraduationCap, Sun, Moon } from "lucide-react";
export function Brand() {
  return (
    <a href="./" className="brand" aria-label="Veda Test home">
      <span className="brand-mark">
        <GraduationCap size={23} strokeWidth={1.8} />
      </span>
      veda<span className="brand-light">test</span>
      <span className="brand-period">.</span>
    </a>
  );
}
export function ThemeButton({ theme, onClick }) {
  return (
    <button
      className="icon-button theme-button"
      onClick={onClick}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
