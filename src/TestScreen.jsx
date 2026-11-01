import React, { useState, useEffect, useRef } from "react";
import {
  Clock3,
  Maximize,
  Minimize,
  ArrowUpRight,
  ShieldCheck,
  LayoutDashboard,
  X,
  CheckCircle2,
  RotateCcw,
  Flag,
  ArrowLeft,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { Brand, ThemeButton } from "./components/UI";
import { saveAttempt } from "./api";
const cn = (...s) => s.filter(Boolean).join(" ");
const formatTime = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export default function TestScreen({
  session: s,
  setSession,
  onSubmit,
  onTimeout,
  theme,
  toggleTheme,
  onExit,
  operation,
  notify,
}) {
  const [remaining, setRemaining] = useState(() =>
      Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000)),
    ),
    [paletteOpen, setPaletteOpen] = useState(false),
    [full, setFull] = useState(false);
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  const revision = useRef(s.revision || 0);
  const initialSave = useRef(true);
  const [saveState, setSaveState] = useState("saved");
  useEffect(() => {
    if (initialSave.current) {
      initialSave.current = false;
      return;
    }
    setSaveState("saving");
    const current = ++revision.current;
    const timer = setTimeout(() => {
      saveAttempt(s.attemptId, s.answers, current)
        .then((response) => {
          if (current === revision.current)
            setSaveState(response.expired ? "expired" : "saved");
        })
        .catch(() => {
          if (current === revision.current) setSaveState("error");
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [s.answers, s.attemptId]);
  const done = useRef(false);
  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !done.current) {
        done.current = true;
        timeout.current();
      }
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [s.deadline]);
  useEffect(() => {
    const handler = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const q = s.questions[s.index],
    answer = s.answers[q.id] ?? "",
    answered = (id) =>
      s.answers[id] != null && String(s.answers[id]).trim() !== "",
    visit = (index) => {
      setSession((prev) => ({
        ...prev,
        index,
        visited: [...new Set([...prev.visited, index])],
      }));
      setPaletteOpen(false);
    },
    setAnswer = (value) => {
      // Do not show a stale "saved" acknowledgement during the debounce window.
      setSaveState("saving");
      setSession((prev) => ({
        ...prev,
        answers: { ...prev.answers, [q.id]: value },
      }));
    },
    markNext = () => {
      setSession((prev) => {
        const next = Math.min(prev.questions.length - 1, prev.index + 1);
        return {
          ...prev,
          marked: [...new Set([...prev.marked, prev.index])],
          index: next,
          visited: [...new Set([...prev.visited, next])],
        };
      });
    },
    status = (id) =>
      s.marked.includes(id)
        ? "marked"
        : answered(id)
          ? "answered"
          : s.visited.includes(id)
            ? "not-answered"
            : "not-visited";
  const counts = {
    answered: s.questions.filter((q) => answered(q.id)).length,
    marked: s.marked.length,
    visited: s.visited.length,
  };
  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div className="exam-brand">
          <Brand />
          <span className="exam-divider" />
          <div>
            <strong>{s.exam.name}</strong>
            <small>Full mock 01</small>
          </div>
        </div>
        <div className="exam-header-actions">
          <div
            className={cn("exam-timer", remaining < 300 && "warning")}
            role="timer"
            aria-label="Time remaining"
          >
            <Clock3 size={18} />
            <div>
              <span>TIME REMAINING</span>
              <strong>{formatTime(remaining)}</strong>
            </div>
          </div>
          <ThemeButton theme={theme} onClick={toggleTheme} />
          <button
            className="icon-button fullscreen-button"
            aria-label={full ? "Exit full screen" : "Enter full screen"}
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {}
            }}
          >
            {full ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            className="btn btn-primary"
            disabled={!!operation}
            onClick={onSubmit}
          >
            Submit test <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      <div className="exam-subheader">
        <div className="subject-tabs" role="group" aria-label="Choose subject">
          {s.exam.subjects.map((sub) => (
            <button
              key={sub}
              className={cn(q.subject === sub && "active")}
              disabled={
                !s.questions.some((question) => question.subject === sub)
              }
              onClick={() =>
                visit(s.questions.findIndex((q) => q.subject === sub))
              }
            >
              {sub}
              <span>{s.questions.filter((q) => q.subject === sub).length}</span>
            </button>
          ))}
        </div>
        <button
          className="palette-toggle btn btn-secondary"
          onClick={() => setPaletteOpen(!paletteOpen)}
        >
          <LayoutDashboard size={15} /> Questions
        </button>
        <span className="exam-focus">
          <ShieldCheck size={14} /> Your focus zone
        </span>
      </div>
      <main id="main" className="exam-main">
        <section className="question-panel">
          <div className="question-topline">
            <div>
              <span className="eyebrow">{q.subject.toUpperCase()}</span>
              <h1>
                Question {s.index + 1}
                <span> / {s.questions.length}</span>
              </h1>
            </div>
            <div className="question-marks">
              <span className="question-type">
                {q.type === "mcq" ? "Single correct" : "Numerical answer"}
              </span>
              <span className="plus">+{q.correctMarks}</span>
              <span className="minus">{q.incorrectMarks}</span>
            </div>
          </div>
          <div className="question-body">
            <p className="question-text">{q.text}</p>
            {q.type === "mcq" ? (
              <fieldset className="answer-options">
                <legend className="sr-only">Choose one answer</legend>
                {q.options.map((option, i) => (
                  <label
                    className={cn(
                      "answer-option",
                      answer === option && "selected",
                    )}
                    key={option}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      checked={answer === option}
                      onChange={() => setAnswer(option)}
                    />
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{option}</span>
                    {answer === option && <CheckCircle2 size={19} />}
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="numerical-answer">
                <label htmlFor="numerical">Enter your numerical answer</label>
                <input
                  id="numerical"
                  type="number"
                  step="any"
                  placeholder="e.g. 24"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                />
                <p>
                  Enter a number. Decimals and negative values are accepted.
                </p>
              </div>
            )}
            <div className="question-inline-actions">
              <button
                className="text-link muted"
                onClick={() => setAnswer("")}
                disabled={!answered(q.id)}
              >
                <RotateCcw size={14} /> Clear response
              </button>
              {s.marked.includes(q.id) && (
                <button
                  className="text-link review-text"
                  onClick={() =>
                    setSession((prev) => ({
                      ...prev,
                      marked: prev.marked.filter((id) => id !== q.id),
                    }))
                  }
                >
                  <Flag size={14} /> Remove review flag
                </button>
              )}
            </div>
          </div>
          <div className="question-navigation">
            <button
              className="btn btn-secondary"
              disabled={s.index === 0}
              onClick={() => visit(s.index - 1)}
            >
              <ArrowLeft size={15} /> Previous
            </button>
            <button className="btn btn-review" onClick={markNext}>
              <Flag size={15} />
              <span>Mark for Review & Next</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() =>
                s.index === s.questions.length - 1
                  ? onSubmit()
                  : visit(s.index + 1)
              }
            >
              {s.index === s.questions.length - 1 ? "Review & submit" : "Next"}
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="exam-bottom-note">
            <ShieldCheck size={13} />{" "}
            {saveState === "saving"
              ? "Saving answers to your account…"
              : saveState === "error"
                ? "Answers could not be saved. Keep this tab open and submit, or retry below."
                : saveState === "expired"
                  ? "Time expired. Grading uses your last answers saved before the deadline."
                  : "Answers saved securely to your account."}
            {saveState === "error" && (
              <button
                className="text-link"
                onClick={() =>
                  setSession((prev) => ({
                    ...prev,
                    answers: { ...prev.answers },
                  }))
                }
              >
                Retry save
              </button>
            )}
          </div>
        </section>
        <aside
          className={cn("question-sidebar", paletteOpen && "palette-open")}
        >
          <div className="palette-heading">
            <h2>Question palette</h2>
            <button
              className="icon-button palette-close"
              aria-label="Close question palette"
              onClick={() => setPaletteOpen(false)}
            >
              <X size={17} />
            </button>
            <span>
              {counts.answered}/{s.questions.length}
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${(counts.answered / s.questions.length) * 100}%`,
              }}
            />
          </div>
          <div className="palette-legend">
            {[
              ["answered", "Answered"],
              ["not-answered", "Not answered"],
              ["not-visited", "Not visited"],
              ["marked", "Marked for review"],
            ].map(([status, label]) => (
              <span key={status}>
                <i className={status} />
                {label}
              </span>
            ))}
          </div>
          <div className="palette-scroll">
            {s.exam.subjects.map((sub) => (
              <div className="palette-subject" key={sub}>
                <h3>{sub}</h3>
                <div className="question-palette">
                  {s.questions
                    .filter((q) => q.subject === sub)
                    .map((q) => (
                      <button
                        key={q.id}
                        aria-label={`Question ${q.id + 1}, ${status(q.id).replaceAll("-", " ")}`}
                        aria-current={s.index === q.id ? "step" : undefined}
                        className={cn(
                          status(q.id),
                          s.index === q.id && "current",
                        )}
                        onClick={() => visit(q.id)}
                      >
                        {q.id + 1}
                        {s.marked.includes(q.id) && answered(q.id) && <i />}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="palette-footer">
            <p>
              <span className="marked-dot" /> A dot on a review flag means an
              answer is saved.
            </p>
            <button className="text-link muted" onClick={onExit}>
              <LogOut size={14} /> Leave test
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
