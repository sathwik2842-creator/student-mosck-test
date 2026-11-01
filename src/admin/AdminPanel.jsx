import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Files,
  BookOpen,
  ChartNoAxesCombined,
  Users,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  ShieldCheck,
  Clock3,
  Target,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  Pencil,
  Copy,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Menu,
  LogOut,
  Save,
  Send,
  FlaskConical,
  FileJson,
  Eye,
  Archive,
} from "lucide-react";
import { Brand, ThemeButton } from "../components/UI";
import Modal from "../components/Modal";
import { usePathname, navigatePath } from "../routing";
import { apiErrorMessage } from "../api";
import {
  getOverview,
  getTest,
  saveTest,
  deleteTest,
  saveQuestion,
  deleteQuestion,
  importQuestions,
  watchTests,
  watchQuestions,
  watchSubmissions,
} from "./api";
import {
  EXAM_TYPES,
  normalizePaper,
  normalizeQuestion,
} from "../../functions/lib/admin-validation";
import { parseQuestionFile, downloadTemplate } from "./importQuestions";
import "./admin.css";
const cn = (...parts) => parts.filter(Boolean).join(" ");
const prettyDate = (value) => {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const blankPaper = () => ({
  id: crypto.randomUUID(),
  version: 0,
  title: "",
  examType: "main",
  duration: 180,
  totalMarks: 300,
  subtitle: "",
  description: "",
  active: false,
  marking: { correct: 4, mcqIncorrect: -1, numericalIncorrect: -1 },
  questions: [],
});
const loadPaper = (t) => ({
  ...t,
  examType: t.examType || (EXAM_TYPES[t.id] ? t.id : "main"),
  marking: t.marking || {
    correct: t.questions[0]?.correctMarks || 4,
    mcqIncorrect: -1,
    numericalIncorrect: t.id === "advanced" ? 0 : -1,
  },
});
export default function AdminPanel({
  user,
  theme,
  toggleTheme,
  onExit,
  onLogout,
}) {
  const path = usePathname(),
    tab = path.startsWith("/admin/questions")
      ? "questions"
      : path.startsWith("/admin/submissions")
        ? "submissions"
        : path.startsWith("/admin/tests")
          ? "tests"
          : "overview";
  const [mobile, setMobile] = useState(false),
    [stats, setStats] = useState(null),
    [metricsLoading, setMetricsLoading] = useState(true),
    [tests, setTests] = useState([]),
    [questions, setQuestions] = useState([]),
    [submissions, setSubmissions] = useState([]),
    [testsLoading, setTestsLoading] = useState(true),
    [bankLoading, setBankLoading] = useState(true),
    [submissionsLoading, setSubmissionsLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0),
    [bankLimit, setBankLimit] = useState(100),
    [editor, setEditor] = useState(null),
    [questionModal, setQuestionModal] = useState(null),
    [importing, setImporting] = useState(false),
    [deleteTarget, setDeleteTarget] = useState(null),
    [busy, setBusy] = useState("");
  const dirty = useRef(false);
  const refreshMetrics = async () => {
    setMetricsLoading(true);
    try {
      setStats(await getOverview());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setMetricsLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    setError("");
    setMetricsLoading(true);
    getOverview()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((e) => {
        if (active) setError(apiErrorMessage(e));
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    setTestsLoading(true);
    setSubmissionsLoading(true);
    const fail = (e) => setError(apiErrorMessage(e));
    const a = watchTests(
      (data) => {
        setTests(data);
        setTestsLoading(false);
      },
      (e) => {
        fail(e);
        setTestsLoading(false);
      },
    );
    const b = watchSubmissions(
      (data) => {
        setSubmissions(data);
        setSubmissionsLoading(false);
      },
      (e) => {
        fail(e);
        setSubmissionsLoading(false);
      },
    );
    return () => {
      a();
      b();
    };
  }, [retry]);
  useEffect(() => {
    setBankLoading(true);
    return watchQuestions(
      bankLimit,
      (data) => {
        setQuestions(data);
        setBankLoading(false);
      },
      (e) => {
        setError(apiErrorMessage(e));
        setBankLoading(false);
      },
    );
  }, [bankLimit, retry]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const fn = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  const leaveEditor = () =>
    !dirty.current ||
    window.confirm(
      "Discard unsaved paper changes? Your last saved version will be preserved.",
    );
  const go = (next) => {
    if (!leaveEditor()) return;
    dirty.current = false;
    setEditor(null);
    setMobile(false);
    navigatePath(next);
    setError("");
  };
  const create = () => {
    if (!leaveEditor()) return;
    navigatePath("/admin/tests");
    setEditor(blankPaper());
    dirty.current = false;
  };
  const edit = async (id) => {
    if (!leaveEditor()) return;
    setBusy(id);
    setError("");
    try {
      const data = await getTest(id);
      navigatePath("/admin/tests");
      setEditor(loadPaper(data));
      dirty.current = false;
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const saved = async (paper) => {
    setEditor(paper);
    dirty.current = false;
    setNotice(
      paper.active
        ? "Test published. Students can now see it."
        : "Draft saved. It is hidden from the student catalog.",
    );
    await refreshMetrics();
  };
  const mutate = async (fn) => {
    setError("");
    try {
      await fn();
      setNotice("Changes saved.");
      await refreshMetrics();
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setBusy("deleting");
    try {
      await (deleteTarget.kind === "test"
        ? deleteTest(deleteTarget.item.id, deleteTarget.item.version || 1)
        : deleteQuestion(deleteTarget.item.id, deleteTarget.item.version || 1));
      setDeleteTarget(null);
      setNotice(
        "Item deleted. Existing paper copies and results are preserved.",
      );
      await refreshMetrics();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const tabs = [
    ["overview", LayoutDashboard, "Overview"],
    ["tests", Files, "Test papers"],
    ["questions", BookOpen, "Question bank"],
    ["submissions", ChartNoAxesCombined, "Submissions"],
  ];
  return (
    <div className="app-shell admin-shell">
      <aside className={cn("sidebar", mobile && "open")}>
        <Brand />
        <div className="admin-workspace-tag">
          <ShieldCheck size={12} /> ADMIN WORKSPACE
        </div>
        <nav>
          {tabs.map(([id, C, label]) => (
            <button
              key={id}
              className={cn("nav-item", tab === id && "active")}
              onClick={() => go(id === "overview" ? "/admin" : `/admin/${id}`)}
            >
              <C size={18} />
              <span>{label}</span>
              {id === "tests" && <small>{tests.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note admin-sidebar-note">
          <ShieldCheck size={23} />
          <h3>
            A thoughtful paper.
            <br />A better learning journey.
          </h3>
          <p>
            Your edits shape how students learn. Publish when everything feels
            right.
          </p>
          <span>PRIVATE, VERIFIED ACCESS</span>
        </div>
        <button
          className="nav-item student-return"
          onClick={() => {
            if (leaveEditor()) onExit();
          }}
        >
          <ArrowLeft size={16} />
          <span>Student workspace</span>
        </button>
        <div className="profile">
          <div className="avatar">
            {(user.displayName || user.email || "A")[0].toUpperCase()}
          </div>
          <div>
            <strong>{user.displayName || "Administrator"}</strong>
            <small>Administrator</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              if (!leaveEditor()) return;
              try {
                await onLogout();
              } catch (e) {
                setError(apiErrorMessage(e));
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="content-shell">
        <header className="workspace-header">
          <div className="flex items-center gap-3">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Admin <ArrowRight size={11} />
              <span>{tabs.find(([id]) => id === tab)?.[2]}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="admin-verified">
              <ShieldCheck size={13} /> Verified administrator
            </span>
            <ThemeButton theme={theme} onClick={toggleTheme} />
          </div>
        </header>
        <main id="main" className="workspace-main admin-main">
          {error && (
            <div className="backend-error" role="alert">
              <AlertTriangle size={18} />
              <p>{error}</p>
              <button
                className="text-link"
                onClick={() => setRetry((n) => n + 1)}
              >
                Retry connection
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {tab === "overview" && (
            <>
              <AdminHeading
                eyebrow="A CLEAR VIEW OF YOUR PLATFORM"
                title="Good questions. Better outcomes."
                subtitle="Everything you need to keep your students moving forward."
                action={
                  <button className="btn btn-primary" onClick={create}>
                    <Plus size={15} /> Create new test
                  </button>
                }
              />
              <section className="admin-welcome">
                <div>
                  <span className="eyebrow">YOUR WORK, THEIR NEXT CHAPTER</span>
                  <h2>
                    Make a little room
                    <br />
                    for a lot of potential.
                  </h2>
                  <p>
                    Create thoughtful tests. Understand progress.
                    <br />
                    Help every student find their next step.
                  </p>
                </div>
                <div className="admin-welcome-icon" aria-hidden="true">
                  <BookOpen size={58} strokeWidth={1.1} />
                  <span>
                    <CheckCircle2 size={14} /> Built with purpose
                  </span>
                </div>
              </section>
              <div className="admin-stats">
                {[
                  [
                    Users,
                    "Registered students",
                    stats?.registeredStudents,
                    "Students, excluding admins",
                    "green",
                  ],
                  [
                    CheckCircle2,
                    "Tests completed",
                    stats?.testsTaken,
                    "Submitted across the platform",
                    "orange",
                  ],
                  [
                    Files,
                    "Active mock tests",
                    stats?.activeTests,
                    "Published and ready to take",
                    "purple",
                  ],
                ].map(([C, label, value, caption, color]) => (
                  <div className="admin-stat panel" key={label}>
                    <span className={`stat-icon ${color}`}>
                      <C size={22} />
                    </span>
                    <span>{label}</span>
                    <strong>{metricsLoading ? "—" : (value ?? "—")}</strong>
                    <small>{caption}</small>
                  </div>
                ))}
              </div>
              <div className="admin-section-heading">
                <div>
                  <h2>What would you like to work on?</h2>
                  <p>A few useful shortcuts to get you started.</p>
                </div>
                <button
                  className="text-link"
                  disabled={metricsLoading}
                  onClick={refreshMetrics}
                >
                  <RefreshCw size={13} /> Refresh metrics
                </button>
              </div>
              <div className="admin-quick-grid">
                {[
                  [
                    Files,
                    "Create a new test",
                    "Turn your question collection into a focused exam.",
                    create,
                  ],
                  [
                    BookOpen,
                    "Manage questions",
                    `${stats?.questionCount ?? "Your"} questions. Countless opportunities to learn.`,
                    () => go("/admin/questions"),
                  ],
                  [
                    ChartNoAxesCombined,
                    "View submissions",
                    "See the effort behind every student’s score.",
                    () => go("/admin/submissions"),
                  ],
                ].map(([C, title, desc, action]) => (
                  <button
                    className="quick-action panel"
                    onClick={action}
                    key={title}
                  >
                    <span>
                      <C size={21} />
                      <ArrowUpRight size={16} />
                    </span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </button>
                ))}
              </div>
              <div className="admin-section-heading">
                <div>
                  <h2>The latest learning milestones</h2>
                  <p>
                    New submissions appear here as students finish their tests.
                  </p>
                </div>
                <button
                  className="text-link"
                  onClick={() => go("/admin/submissions")}
                >
                  View all <ArrowUpRight size={13} />
                </button>
              </div>
              <SubmissionsTable
                data={submissions.slice(0, 5)}
                loading={submissionsLoading}
              />
              <p className="admin-freshness">
                Metrics refreshed{" "}
                {stats
                  ? prettyDate(stats.updatedAt)
                  : "when the server responds"}
                . Submissions update live.
              </p>
            </>
          )}
          {tab === "tests" &&
            (editor ? (
              <TestEditor
                initial={editor}
                questions={questions}
                onDirty={(value) => {
                  dirty.current = value;
                }}
                onSaved={saved}
                onBack={() => {
                  if (leaveEditor()) {
                    setEditor(null);
                    dirty.current = false;
                  }
                }}
                onReload={() => edit(editor.id)}
              />
            ) : (
              <>
                <AdminHeading
                  eyebrow="BUILD SOMETHING WORTH PRACTICING"
                  title="Your test papers."
                  subtitle="From the first draft to the final question. All in one place."
                  action={
                    <button className="btn btn-primary" onClick={create}>
                      <Plus size={15} /> Create new test
                    </button>
                  }
                />
                <TestTable
                  tests={tests}
                  loading={testsLoading}
                  busy={busy}
                  onEdit={edit}
                  onDelete={(item) => setDeleteTarget({ kind: "test", item })}
                  onArchive={async (item) => {
                    setBusy(item.id);
                    try {
                      await mutate(async () => {
                        const full = await getTest(item.id);
                        await saveTest(
                          item.id,
                          { ...loadPaper(full), active: false },
                          full.version || 1,
                        );
                      });
                    } catch {
                    } finally {
                      setBusy("");
                    }
                  }}
                />
              </>
            ))}
          {tab === "questions" && (
            <>
              <AdminHeading
                eyebrow="THE FOUNDATION OF EVERY GOOD TEST"
                title="A bank of possibilities."
                subtitle="Create, refine, and reuse questions across your test papers."
                action={
                  <div className="admin-heading-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setImporting(true)}
                    >
                      <Upload size={14} /> Bulk import
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        setQuestionModal({
                          id: crypto.randomUUID(),
                          version: 0,
                        })
                      }
                    >
                      <Plus size={15} /> Add question
                    </button>
                  </div>
                }
              />
              <QuestionBank
                questions={questions}
                loading={bankLoading}
                onEdit={setQuestionModal}
                onDelete={(item) => setDeleteTarget({ kind: "question", item })}
              />
              {questions.length >= bankLimit && bankLimit < 1000 && (
                <button
                  className="btn btn-secondary load-more"
                  onClick={() => setBankLimit((n) => n + 100)}
                >
                  Load 100 more questions <ChevronDown size={14} />
                </button>
              )}
              <p className="admin-freshness">
                Showing the newest {questions.length} loaded questions. Changes
                to bank questions do not alter copies already added to papers.
              </p>
            </>
          )}
          {tab === "submissions" && (
            <>
              <AdminHeading
                eyebrow="A LITTLE INSIGHT GOES A LONG WAY"
                title="Behind every score, a student."
                subtitle="Follow recent activity and understand how your platform is being used."
              />
              <div className="live-note">
                <i /> Live updates · Most recent 50 submissions{" "}
                <span>Read-only, server-graded results</span>
              </div>
              <SubmissionsTable
                data={submissions}
                loading={submissionsLoading}
                searchable
              />
            </>
          )}
        </main>
        <footer>
          <span>A thoughtful space for the people behind the progress.</span>
          <span>Veda Test · Admin workspace</span>
        </footer>
      </div>
      {questionModal && (
        <QuestionDialog
          initial={questionModal}
          onClose={() => setQuestionModal(null)}
          onSave={async (question) => {
            await saveQuestion(
              questionModal.id,
              question,
              questionModal.version || 0,
            );
            setQuestionModal(null);
            setNotice("Question saved to your bank.");
            await refreshMetrics();
          }}
        />
      )}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImport={async (items, importId) => {
            await importQuestions(items, importId);
            setImporting(false);
            setNotice(`${items.length} questions added to your bank.`);
            await refreshMetrics();
          }}
        />
      )}
      {deleteTarget && (
        <Modal
          title={`Delete this ${deleteTarget.kind === "test" ? "paper" : "question"}?`}
          onClose={() => {
            if (!busy) setDeleteTarget(null);
          }}
        >
          <p className="muted small">
            {deleteTarget.kind === "test"
              ? `“${deleteTarget.item.title}” will be removed. Saved student results will remain unchanged. Unpublish the paper first; papers with unfinished attempts must remain archived.`
              : "This removes the question from the reusable bank. Existing paper copies and student results remain unchanged."}
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              disabled={!!busy}
              onClick={() => setDeleteTarget(null)}
            >
              Keep it
            </button>
            <button
              className="btn btn-danger"
              disabled={!!busy}
              onClick={remove}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function AdminHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="admin-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({ title, subtitle, icon: Icon = Files }) {
  return (
    <div className="admin-empty">
      <span>
        <Icon size={28} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}
function TestTable({ tests, loading, busy, onEdit, onDelete, onArchive }) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const filtered = tests.filter(
    (t) =>
      (filter === "all" || (filter === "active" ? t.active : !t.active)) &&
      `${t.title} ${t.examType}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel admin-list-panel">
      <div className="admin-list-toolbar">
        <SearchInput
          value={search}
          setValue={setSearch}
          label="Search test papers"
        />
        <select
          aria-label="Filter publication status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All papers</option>
          <option value="active">Published</option>
          <option value="draft">Drafts / archived</option>
        </select>
        <span>{filtered.length} papers</span>
      </div>
      {loading ? (
        <p role="status" className="admin-loading">
          Loading test papers…
        </p>
      ) : !filtered.length ? (
        <Empty
          title="A little room for your next great paper."
          subtitle={
            search
              ? "Try a different search."
              : "Create a new test to get started."
          }
        />
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Test paper</th>
                <th>Duration</th>
                <th>Questions / marks</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <small>
                      {EXAM_TYPES[t.examType || t.id]?.label || "Mock test"} · v
                      {t.version || 1}
                    </small>
                  </td>
                  <td>
                    <span className="table-icon">
                      <Clock3 size={12} />
                      {t.duration} mins
                    </span>
                  </td>
                  <td>
                    {t.count} questions<small>{t.marks} marks</small>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "publication-status",
                        t.active && "published",
                      )}
                    >
                      <i />
                      {t.active ? "Published" : "Draft / archived"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary"
                        disabled={!!busy}
                        onClick={() => onEdit(t.id)}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      {t.active ? (
                        <button
                          className="icon-button"
                          title="Unpublish test"
                          aria-label={`Unpublish ${t.title}`}
                          disabled={!!busy}
                          onClick={() => onArchive(t)}
                        >
                          <Archive size={15} />
                        </button>
                      ) : (
                        <button
                          className="icon-button delete-action"
                          aria-label={`Delete ${t.title}`}
                          disabled={!!busy}
                          onClick={() => onDelete(t)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function SearchInput({ value, setValue, label }) {
  return (
    <label className="admin-search">
      <Search size={15} />
      <input
        aria-label={label}
        placeholder={label + "…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </label>
  );
}
function SubmissionsTable({ data, loading, searchable }) {
  const [search, setSearch] = useState("");
  const filtered = data.filter((r) =>
    `${r.studentEmail || r.userId} ${r.exam?.name || r.testId}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="panel admin-list-panel">
      {searchable && (
        <div className="admin-list-toolbar">
          <SearchInput
            value={search}
            setValue={setSearch}
            label="Search loaded submissions"
          />
          <span>{filtered.length} submissions</span>
        </div>
      )}
      {loading ? (
        <p role="status" className="admin-loading">
          Loading student submissions…
        </p>
      ) : !filtered.length ? (
        <Empty
          icon={ChartNoAxesCombined}
          title="Their progress will appear here."
          subtitle={
            search
              ? "Try a different student or test name."
              : "Completed tests appear here automatically."
          }
        />
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Test paper</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.studentEmail || "Email not recorded"}</strong>
                    <small className="student-uid" title={r.userId}>
                      {r.userId}
                    </small>
                  </td>
                  <td>
                    {r.exam?.name || r.testId}
                    <small>{r.total} questions</small>
                  </td>
                  <td>
                    <strong className="table-score">
                      {r.score}
                      <span> / {r.totalMarks}</span>
                    </strong>
                  </td>
                  <td>
                    <span className="accuracy-pill">{r.accuracy}%</span>
                  </td>
                  <td className="submission-date">
                    {prettyDate(r.submittedAt || r.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function QuestionBank({ questions, loading, onEdit, onDelete }) {
  const [search, setSearch] = useState(""),
    [subject, setSubject] = useState("All subjects");
  const filtered = questions.filter(
    (q) =>
      (subject === "All subjects" || q.subject === subject) &&
      q.text.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="admin-list-toolbar bank-toolbar">
        <SearchInput
          value={search}
          setValue={setSearch}
          label="Search loaded questions"
        />
        <select
          aria-label="Filter bank by subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option>All subjects</option>
          {["Physics", "Chemistry", "Mathematics", "Biology"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span>{filtered.length} questions</span>
      </div>
      {loading ? (
        <div className="panel admin-loading" role="status">
          Loading your question bank…
        </div>
      ) : !filtered.length ? (
        <section className="panel">
          <Empty
            icon={BookOpen}
            title="Every good paper starts with a question."
            subtitle={
              search
                ? "No loaded questions match your search."
                : "Add a question or import your first collection."
            }
          />
        </section>
      ) : (
        <div className="bank-question-list">
          {filtered.map((q, i) => (
            <article key={q.id} className="panel bank-question">
              <div className="bank-question-top">
                <span className="bank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="eyebrow">
                  {q.subject} <span>·</span>{" "}
                  {q.section ||
                    (q.sectionType === "numerical" ? "Numerical" : "Section A")}
                </span>
                <span className="bank-marks">
                  +{q.correctMarks} / {q.incorrectMarks}
                </span>
              </div>
              <h3>{q.text}</h3>
              <div className="bank-question-bottom">
                <span>
                  <CheckCircle2 size={13} /> Correct:{" "}
                  <strong>{q.correctAnswer}</strong>
                </span>
                <div className="table-actions">
                  <button className="text-link" onClick={() => onEdit(q)}>
                    <Pencil size={13} /> Edit question
                  </button>
                  <button
                    className="icon-button delete-action"
                    aria-label={`Delete question ${i + 1}`}
                    onClick={() => onDelete(q)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
function Field({ label, children, hint }) {
  const id = React.useId();
  const attach = (element) =>
    React.cloneElement(element, {
      id,
      "aria-describedby": hint ? `${id}-hint` : undefined,
    });
  const control = ["input", "textarea", "select"].includes(children.type)
    ? attach(children)
    : React.cloneElement(children, {
        children: React.Children.map(children.props.children, (child) =>
          React.isValidElement(child) &&
          ["input", "textarea", "select"].includes(child.type)
            ? attach(child)
            : child,
        ),
      });
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function TestEditor({
  initial,
  questions,
  onDirty,
  onSaved,
  onBack,
  onReload,
}) {
  const [paper, setPaper] = useState(() => structuredClone(initial)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [question, setQuestion] = useState(null),
    [importOpen, setImportOpen] = useState(false),
    [bankOpen, setBankOpen] = useState(false),
    [removeIndex, setRemoveIndex] = useState(null),
    [search, setSearch] = useState(""),
    [visible, setVisible] = useState(20);
  useEffect(() => {
    setPaper(structuredClone(initial));
    setError("");
  }, [initial.id, initial.version]);
  const update = (patch) => {
    setPaper((p) => ({ ...p, ...patch }));
    onDirty(true);
  };
  const info = EXAM_TYPES[paper.examType],
    sum = paper.questions.reduce(
      (s, q) => s + Number(q.correctMarks || paper.marking.correct),
      0,
    );
  const save = async (active) => {
    if (busy) return;
    setError("");
    try {
      const clean = normalizePaper({ ...paper, active });
      setBusy(true);
      const result = await saveTest(paper.id, clean, paper.version || 0);
      const next = { ...clean, id: paper.id, version: result.version };
      setPaper(next);
      await onSaved(next);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const addQuestions = (items) => {
    if (paper.questions.length + items.length > 300)
      throw new Error("A paper can contain at most 300 questions.");
    update({ questions: [...paper.questions, ...items] });
  };
  const move = (index, delta) => {
    const copy = [...paper.questions];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    update({ questions: copy });
  };
  return (
    <div className="test-editor">
      <button className="text-link editor-back" onClick={onBack}>
        <ArrowLeft size={14} /> All test papers
      </button>
      <AdminHeading
        eyebrow={
          paper.version
            ? `PAPER VERSION ${paper.version}`
            : "A NEW OPPORTUNITY TO LEARN"
        }
        title={
          paper.version
            ? "Refine your test paper."
            : "Let’s build a thoughtful test."
        }
        subtitle="Save your work as a draft. Publish when you’re ready for students."
        action={
          <span
            className={cn("publication-status", paper.active && "published")}
          >
            <i />
            {paper.active ? "Published" : "Draft"}
          </span>
        }
      />
      {error && (
        <div className="backend-error" role="alert">
          <AlertTriangle size={18} />
          <p>{error}</p>
          {paper.version > 0 && (
            <button className="text-link" onClick={onReload}>
              Reload saved version
            </button>
          )}
        </div>
      )}
      <section className="panel metadata-panel">
        <div className="editor-section-title">
          <span>01</span>
          <div>
            <h2>Start with the essentials</h2>
            <p>A little context goes a long way.</p>
          </div>
          <Files size={22} />
        </div>
        <div className="metadata-grid">
          <Field label="Test title">
            <input
              value={paper.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={120}
              placeholder="e.g. JEE Main · Full Mock 02"
              required
            />
          </Field>
          <Field label="Exam type">
            <select
              value={paper.examType}
              onChange={(e) => {
                const next = e.target.value;
                const invalid = paper.questions.some(
                  (q) => !EXAM_TYPES[next].subjects.includes(q.subject),
                );
                if (invalid) {
                  setError(
                    "Remove questions in incompatible subjects before changing the exam type.",
                  );
                  return;
                }
                update({ examType: next });
              }}
            >
              {Object.entries(EXAM_TYPES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min="1"
              max="360"
              step="1"
              value={paper.duration}
              onChange={(e) => update({ duration: e.target.value })}
            />
          </Field>
          <Field
            label="Total marks"
            hint={`Questions currently add up to ${sum} marks.`}
          >
            <div className="marks-input">
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={paper.totalMarks}
                onChange={(e) => update({ totalMarks: e.target.value })}
              />
              <button type="button" onClick={() => update({ totalMarks: sum })}>
                Use {sum}
              </button>
            </div>
          </Field>
          <Field label="Short description">
            <input
              value={paper.subtitle || ""}
              maxLength={180}
              placeholder="A little motivation for your students."
              onChange={(e) => update({ subtitle: e.target.value })}
            />
          </Field>
          <Field label="Instructions / notes">
            <textarea
              rows="2"
              value={paper.description || ""}
              maxLength={2000}
              placeholder="Anything students should know about this paper."
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
        </div>
        <div className="marking-header">
          <div>
            <h3>Make the marking clear</h3>
            <p>
              Defaults for new questions. Individual questions can override
              these values.
            </p>
          </div>
          <button
            className="text-link"
            onClick={() =>
              update({
                questions: paper.questions.map((q) => ({
                  ...q,
                  correctMarks: Number(paper.marking.correct),
                  incorrectMarks: Number(
                    q.sectionType === "numerical"
                      ? paper.marking.numericalIncorrect
                      : paper.marking.mcqIncorrect,
                  ),
                })),
              })
            }
          >
            <RefreshCw size={12} /> Apply to all questions
          </button>
        </div>
        <div className="marking-grid">
          {[
            ["correct", "Correct answer marks", "positive"],
            ["mcqIncorrect", "Incorrect MCQ", "negative"],
            ["numericalIncorrect", "Incorrect numerical", "negative"],
          ].map(([key, label, style]) => (
            <Field label={label} key={key}>
              <input
                className={style}
                type="number"
                step="0.25"
                min={key === "correct" ? "0.25" : "-20"}
                max={key === "correct" ? "20" : "0"}
                value={paper.marking[key]}
                onChange={(e) =>
                  update({
                    marking: { ...paper.marking, [key]: e.target.value },
                  })
                }
              />
            </Field>
          ))}
          <div className="unanswered-note">
            <MinusIcon />
            <span>
              Unanswered questions
              <br />
              <strong>0 marks, always</strong>
            </span>
          </div>
        </div>
      </section>
      <section className="panel editor-questions">
        <div className="editor-section-title">
          <span>02</span>
          <div>
            <h2>Bring your questions together</h2>
            <p>
              {paper.questions.length} questions · {sum} marks · {info.label}
            </p>
          </div>
          <BookOpen size={22} />
        </div>
        <div className="question-add-actions">
          <button
            className="btn btn-primary"
            onClick={() => setQuestion({ index: -1 })}
          >
            <Plus size={14} /> Add question
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setBankOpen(true)}
          >
            <BookOpen size={14} /> From question bank
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={14} /> Import JSON / CSV
          </button>
        </div>
        {paper.questions.length > 0 && (
          <SearchInput
            value={search}
            setValue={setSearch}
            label="Search paper questions"
          />
        )}
        {!paper.questions.length ? (
          <Empty
            icon={BookOpen}
            title="Your first question is a good place to start."
            subtitle="Build one from scratch, choose from your bank, or import a collection."
          />
        ) : (
          <div className="paper-questions">
            {paper.questions
              .map((q, index) => ({ q, index }))
              .filter(({ q }) =>
                q.text.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, visible)
              .map(({ q, index }) => (
                <article className="paper-question" key={index}>
                  <span className="paper-question-number">{index + 1}</span>
                  <div>
                    <div className="paper-question-labels">
                      <span>{q.subject}</span>
                      <span>
                        {q.section ||
                          (q.sectionType === "numerical"
                            ? "Numerical"
                            : "Section A")}
                      </span>
                      <span>
                        +{q.correctMarks} / {q.incorrectMarks}
                      </span>
                    </div>
                    <p>{q.text}</p>
                    <div className="paper-question-answer">
                      <Check size={12} /> {q.correctAnswer}
                    </div>
                  </div>
                  <div className="paper-question-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit paper question ${index + 1}`}
                      onClick={() => setQuestion({ index, ...q })}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Duplicate question ${index + 1}`}
                      onClick={() => {
                        if (paper.questions.length >= 300) {
                          setError(
                            "A paper can contain at most 300 questions.",
                          );
                          return;
                        }
                        const next = [...paper.questions];
                        next.splice(index + 1, 0, structuredClone(q));
                        update({ questions: next });
                      }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={index === 0}
                      aria-label={`Move question ${index + 1} up`}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={index === paper.questions.length - 1}
                      aria-label={`Move question ${index + 1} down`}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      className="icon-button delete-action"
                      aria-label={`Remove paper question ${index + 1}`}
                      onClick={() => setRemoveIndex(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            {paper.questions.filter((q) =>
              q.text.toLowerCase().includes(search.toLowerCase()),
            ).length > visible && (
              <button
                className="text-link load-more"
                onClick={() => setVisible((n) => n + 20)}
              >
                Show 20 more <ChevronDown size={13} />
              </button>
            )}
          </div>
        )}
      </section>
      <div className="editor-save-bar">
        <div>
          <ShieldCheck size={17} />
          <span>
            {paper.questions.length} questions · {sum} / {paper.totalMarks}{" "}
            marks
            <small>
              {paper.active
                ? "Saving as draft will unpublish this paper."
                : "Drafts stay private until you publish."}
            </small>
          </span>
        </div>
        <div>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => save(false)}
          >
            <Save size={14} />
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => save(true)}
          >
            <Send size={14} />
            {busy
              ? "Saving…"
              : paper.active
                ? "Publish changes"
                : "Publish test"}
          </button>
        </div>
      </div>
      {question && (
        <QuestionDialog
          initial={question}
          subjects={info.subjects}
          marking={paper.marking}
          onClose={() => setQuestion(null)}
          onSave={async (item) => {
            if (question.index === -1) addQuestions([item]);
            else
              update({
                questions: paper.questions.map((q, i) =>
                  i === question.index ? item : q,
                ),
              });
            setQuestion(null);
          }}
          paperMode
        />
      )}
      {importOpen && (
        <ImportDialog
          subjects={info.subjects}
          marking={paper.marking}
          onClose={() => setImportOpen(false)}
          onImport={async (items) => {
            addQuestions(items);
            setImportOpen(false);
          }}
          paperMode
        />
      )}
      {bankOpen && (
        <BankPicker
          questions={questions}
          subjects={info.subjects}
          onClose={() => setBankOpen(false)}
          onAdd={(items) => {
            addQuestions(items);
            setBankOpen(false);
          }}
        />
      )}
      {removeIndex !== null && (
        <Modal
          title="Remove this question?"
          onClose={() => setRemoveIndex(null)}
        >
          <p className="muted small">
            This removes question {removeIndex + 1} from your working paper.
            Save or publish to persist the change. The original bank question is
            unaffected.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setRemoveIndex(null)}
            >
              Keep question
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                update({
                  questions: paper.questions.filter(
                    (_, i) => i !== removeIndex,
                  ),
                });
                setRemoveIndex(null);
              }}
            >
              Remove question
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function MinusIcon() {
  return <span className="unanswered-minus">−</span>;
}
function QuestionDialog({
  initial = {},
  subjects = ["Physics", "Chemistry", "Mathematics", "Biology"],
  marking = { correct: 4, mcqIncorrect: -1, numericalIncorrect: 0 },
  onClose,
  onSave,
  paperMode,
}) {
  const [draft, setDraft] = useState(() => ({
      text: initial.text || "",
      subject: initial.subject || subjects[0],
      section:
        initial.section ||
        (initial.sectionType === "numerical" ? "Numerical" : "Section A"),
      options:
        initial.options?.length === 4 ? [...initial.options] : ["", "", "", ""],
      choice: Math.max(0, initial.options?.indexOf(initial.correctAnswer) ?? 0),
      correctAnswer: initial.correctAnswer || "",
      solutions: initial.solutions?.join("\n") || "",
      correctMarks: initial.correctMarks ?? marking.correct,
      incorrectMarks: initial.incorrectMarks ?? marking.mcqIncorrect,
    })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const update = (patch) => setDraft((prev) => ({ ...prev, ...patch }));
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const question = normalizeQuestion(
        {
          ...draft,
          correctAnswer:
            draft.section === "Numerical"
              ? draft.correctAnswer
              : draft.options[draft.choice],
        },
        { subjects, marking },
      );
      setBusy(true);
      await onSave(question);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={
        initial.text ? "Refine your question." : "Start with a good question."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="question-dialog" onSubmit={submit} noValidate>
        <div className="question-dialog-top">
          <span className="eyebrow">
            {paperMode
              ? "PAPER QUESTION · SAVE PAPER TO PERSIST"
              : "REUSABLE QUESTION BANK"}
          </span>
          <button
            className="text-link"
            type="button"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={13} />
            {preview ? "Back to editor" : "Preview"}
          </button>
        </div>
        {error && (
          <div role="alert" className="auth-error">
            {error}
          </div>
        )}
        {preview ? (
          <div className="question-preview">
            <span className="eyebrow">
              {draft.subject} · {draft.section}
            </span>
            <h3>{draft.text || "Your question will appear here."}</h3>
            {draft.section === "Numerical" ? (
              <div className="preview-numerical">
                Correct answer: {draft.correctAnswer || "—"}
              </div>
            ) : (
              draft.options.map((o, i) => (
                <div
                  className={cn(
                    "preview-option",
                    i === Number(draft.choice) && "preview-correct",
                  )}
                  key={i}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {o || `Option ${String.fromCharCode(65 + i)}`}
                  {i === Number(draft.choice) && <Check size={14} />}
                </div>
              ))
            )}
            <div className="preview-solution">
              <strong>Solution</strong>
              <p>{draft.solutions || "Your explanation will appear here."}</p>
            </div>
          </div>
        ) : (
          <>
            <Field label="Question text">
              <textarea
                rows="4"
                maxLength={12000}
                placeholder="Write a clear, focused question…"
                value={draft.text}
                onChange={(e) => update({ text: e.target.value })}
              />
            </Field>
            <div className="question-form-grid">
              <Field label="Subject">
                <select
                  value={draft.subject}
                  onChange={(e) => update({ subject: e.target.value })}
                >
                  {subjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Section / question type">
                <select
                  value={draft.section}
                  onChange={(e) =>
                    update({
                      section: e.target.value,
                      incorrectMarks:
                        e.target.value === "Numerical"
                          ? marking.numericalIncorrect
                          : marking.mcqIncorrect,
                    })
                  }
                >
                  <option>Section A</option>
                  <option>Section B</option>
                  <option>Numerical</option>
                </select>
              </Field>
            </div>
            {draft.section !== "Numerical" ? (
              <>
                <div className="question-options-form">
                  {draft.options.map((option, i) => (
                    <Field
                      label={`Option ${String.fromCharCode(65 + i)}`}
                      key={i}
                    >
                      <input
                        maxLength={2000}
                        value={option}
                        onChange={(e) =>
                          update({
                            options: draft.options.map((o, j) =>
                              i === j ? e.target.value : o,
                            ),
                          })
                        }
                        placeholder={`Answer option ${String.fromCharCode(65 + i)}`}
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Correct answer">
                  <select
                    value={draft.choice}
                    onChange={(e) => update({ choice: Number(e.target.value) })}
                  >
                    {draft.options.map((o, i) => (
                      <option key={i} value={i}>
                        {String.fromCharCode(65 + i)}
                        {o ? ` — ${o.slice(0, 55)}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <Field label="Correct numerical answer">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 24"
                  value={draft.correctAnswer}
                  onChange={(e) => update({ correctAnswer: e.target.value })}
                />
              </Field>
            )}
            <Field
              label="Step-by-step solution"
              hint="One step per line. Explain the reasoning as well as the answer."
            >
              <textarea
                rows="4"
                value={draft.solutions}
                placeholder={
                  "Identify the relevant principle.\nSubstitute the given values.\nCalculate and state the final answer."
                }
                onChange={(e) => update({ solutions: e.target.value })}
              />
            </Field>
            <div className="question-form-grid">
              <Field label="Marks for a correct answer">
                <input
                  type="number"
                  min="0.25"
                  max="20"
                  step="0.25"
                  value={draft.correctMarks}
                  onChange={(e) => update({ correctMarks: e.target.value })}
                />
              </Field>
              <Field label="Marks for an incorrect answer">
                <input
                  type="number"
                  min="-20"
                  max="0"
                  step="0.25"
                  value={draft.incorrectMarks}
                  onChange={(e) => update({ incorrectMarks: e.target.value })}
                />
              </Field>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Check size={14} />
            {busy
              ? "Saving…"
              : paperMode
                ? "Add to working paper"
                : "Save question"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImportDialog({ subjects, marking, onClose, onImport, paperMode }) {
  const [items, setItems] = useState([]),
    [filename, setFilename] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [importId, setImportId] = useState(crypto.randomUUID());
  const input = useRef();
  const parse = async (file) => {
    setError("");
    setItems([]);
    if (!file) return;
    setFilename(file.name);
    try {
      if (file.size > 850000)
        throw new Error("File must be smaller than 850 KB.");
      const parsed = parseQuestionFile(await file.text(), file.name, {
        subjects,
        marking,
      });
      setItems(parsed);
      setImportId(crypto.randomUUID());
    } catch (e) {
      setError(e.message);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onImport(items, importId);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="A collection of good questions."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="import-dialog">
        <p className="muted small">
          Import up to 100 questions from JSON or CSV. Every row is validated
          before anything is saved.
        </p>
        <div className="import-templates">
          <span>Start with a template</span>
          <button
            className="text-link"
            onClick={() => downloadTemplate("json")}
          >
            <Download size={13} /> JSON
          </button>
          <button className="text-link" onClick={() => downloadTemplate("csv")}>
            <Download size={13} /> CSV
          </button>
        </div>
        <button
          disabled={busy}
          className="import-dropzone"
          onClick={() => input.current.click()}
        >
          <Upload size={28} strokeWidth={1.4} />
          <strong>{filename || "Choose your question file"}</strong>
          <span>JSON or CSV · up to 850 KB</span>
        </button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept=".json,.csv,application/json,text/csv"
          aria-label="Upload question file"
          onChange={(e) => parse(e.target.files?.[0])}
        />
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {items.length > 0 && (
          <div className="import-preview">
            <h3>
              <CheckCircle2 size={15} />
              {items.length} questions validated
            </h3>
            {items.slice(0, 4).map((q, i) => (
              <div key={i}>
                <span>{i + 1}</span>
                <p>
                  {q.text}
                  <small>
                    {q.subject} · {q.section}
                  </small>
                </p>
              </div>
            ))}
            {items.length > 4 && (
              <p className="muted small">
                And {items.length - 4} more questions.
              </p>
            )}
          </div>
        )}
        <div className="import-help">
          <ShieldCheck size={14} />
          <p>
            {paperMode
              ? "Imported questions are added to your working paper. Save the paper to persist them."
              : "Questions are saved atomically to the reusable bank. Existing questions are preserved."}
          </p>
        </div>
        <div className="modal-actions">
          <button
            disabled={busy}
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={busy || !items.length}
            className="btn btn-primary"
            onClick={save}
          >
            <Upload size={14} />
            {busy ? "Importing…" : `Import ${items.length || ""} questions`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
function BankPicker({ questions, subjects, onClose, onAdd }) {
  const [selected, setSelected] = useState([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const available = questions.filter(
    (q) =>
      subjects.includes(q.subject) &&
      q.text.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Modal title="Give a good question another home." onClose={onClose}>
      <p className="muted small">
        Choose from the newest loaded bank questions. Paper copies stay
        independent of future bank edits.
      </p>
      <SearchInput
        value={search}
        setValue={setSearch}
        label="Find a bank question"
      />
      <div className="bank-picker-list">
        {available.map((q) => (
          <label key={q.id}>
            <input
              type="checkbox"
              checked={selected.includes(q.id)}
              onChange={() =>
                setSelected((ids) =>
                  ids.includes(q.id)
                    ? ids.filter((id) => id !== q.id)
                    : [...ids, q.id],
                )
              }
            />
            <span>
              {q.text}
              <small>
                {q.subject} · +{q.correctMarks} / {q.incorrectMarks}
              </small>
            </span>
          </label>
        ))}
        {!available.length && (
          <p className="muted small">
            No compatible loaded questions. Add questions in the question bank
            first.
          </p>
        )}
      </div>
      {error && (
        <div role="alert" className="auth-error">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={!selected.length}
          className="btn btn-primary"
          onClick={() => {
            try {
              onAdd(
                questions
                  .filter((q) => selected.includes(q.id))
                  .map(({ id, version, updatedAt, updatedBy, ...q }) => q),
              );
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Add {selected.length} questions <Plus size={14} />
        </button>
      </div>
    </Modal>
  );
}
