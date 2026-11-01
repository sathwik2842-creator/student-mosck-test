import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  Files,
  ChartNoAxesCombined,
  BookOpen,
  Clock3,
  Target,
  Check,
  CheckCheck,
  X,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Atom,
  FlaskConical,
  Dna,
  Sparkles,
  Flag,
  CheckCircle2,
  XCircle,
  Minus,
  CalendarDays,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  Menu,
  Maximize,
  Minimize,
  AlertTriangle,
  RotateCcw,
  Trophy,
  TrendingUp,
  CheckSquare,
  Search,
} from "lucide-react";
import { readStorage, writeStorage } from "./data";
import { AuthProvider, useAuth, authErrorMessage } from "./AuthContext";
import { useEmulators, missingFirebaseConfig } from "./firebase";
import {
  startTest,
  saveAttempt,
  submitTest,
  subscribeTests,
  subscribeResults,
  apiErrorMessage,
} from "./api";
import "./styles.css";
import { Brand, ThemeButton } from "./components/UI";
import TestScreen from "./TestScreen";
const AdminPanel = React.lazy(() => import("./admin/AdminPanel"));
import Modal from "./components/Modal";
import { usePathname, navigatePath } from "./routing";
const cn = (...s) => s.filter(Boolean).join(" "),
  formatTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const Icon = ({ id, ...props }) => {
  const C = id === "neet" ? Dna : id === "advanced" ? FlaskConical : Atom;
  return <C {...props} />;
};
function App() {
  const pathname = usePathname();
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const [theme, setTheme] = useState(() => readStorage("veda-theme", "light"));
  const {
    user: firebaseUser,
    loading: authLoading,
    error: authStateError,
    configured,
    login,
    signup,
    googleLogin,
    logout,
    isAdmin,
    roleLoading,
    roleError,
  } = useAuth();
  const user = firebaseUser
    ? {
        uid: firebaseUser.uid,
        name:
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          "Student",
      }
    : null;
  const [exams, setExams] = useState([]),
    [dataError, setDataError] = useState(""),
    [testsLoading, setTestsLoading] = useState(true),
    [historyLoading, setHistoryLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [operation, setOperation] = useState("");
  const submitLock = useRef(false);
  const [auth, setAuth] = useState("login"),
    [view, setView] = useState("dashboard"),
    [mobileNav, setMobileNav] = useState(false),
    [filter, setFilter] = useState("all"),
    [history, setHistory] = useState([]),
    [session, setSession] = useState(null),
    [result, setResult] = useState(null),
    [modal, setModal] = useState(null),
    [notification, setNotification] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeStorage("veda-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(""), 4500);
    return () => clearTimeout(id);
  }, [notification]);
  useEffect(() => {
    if (!session) return;
    const fn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [!!session]);
  const notify = setNotification,
    toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  useEffect(() => {
    setHistory([]);
    setExams([]);
    setResult(null);
    setSession(null);
    setModal(null);
    setView("dashboard");
    setAuth("login");
    setDataError("");
    if (!firebaseUser) return;
    setTestsLoading(true);
    setHistoryLoading(true);
    const a = subscribeTests(
      (data) => {
        setExams(data);
        setTestsLoading(false);
      },
      (error) => {
        setDataError(apiErrorMessage(error));
        setTestsLoading(false);
      },
    );
    const b = subscribeResults(
      firebaseUser.uid,
      (data) => {
        setHistory(data);
        setHistoryLoading(false);
      },
      (error) => {
        setDataError(apiErrorMessage(error));
        setHistoryLoading(false);
      },
    );
    return () => {
      a();
      b();
    };
  }, [firebaseUser?.uid, retry]);
  useEffect(() => {
    if (
      adminRoute &&
      !authLoading &&
      firebaseUser &&
      !roleLoading &&
      !isAdmin
    ) {
      setNotification(
        roleError || "Unauthorized: administrator access is required.",
      );
      navigatePath("/", { replace: true });
      setView("dashboard");
    }
  }, [
    adminRoute,
    authLoading,
    firebaseUser?.uid,
    roleLoading,
    isAdmin,
    roleError,
  ]);
  const navigate = (v) => {
    setView(v);
    setMobileNav(false);
    setFilter("all");
    window.scrollTo(0, 0);
  };
  const start = (exam) => {
    setModal({ type: "start", exam });
  };
  const begin = async (exam) => {
    if (operation) return;
    setOperation("starting");
    try {
      const data = await startTest(exam.id);
      const localNow = Date.now();
      setSession({
        ...data,
        index: 0,
        visited: [0],
        marked: [],
        started: localNow - (data.serverNow - data.started),
        deadline: localNow + Math.max(0, data.deadline - data.serverNow),
        saveState: "saved",
      });
      setModal(null);
      if (data.resumed) notify("Your saved attempt has been restored.");
      window.scrollTo(0, 0);
    } catch (error) {
      notify(apiErrorMessage(error));
    } finally {
      setOperation("");
    }
  };
  const finish = async () => {
    if (!session || submitLock.current) return;
    submitLock.current = true;
    setOperation("submitting");
    try {
      const r = await submitTest(session.attemptId, session.answers);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setResult(r);
      setSession(null);
      setModal(null);
      setView("results");
      window.scrollTo(0, 0);
    } catch (error) {
      notify(apiErrorMessage(error));
      setModal({ type: "submit" });
    } finally {
      submitLock.current = false;
      setOperation("");
    }
  };
  const count = history.length,
    accuracy = count
      ? Math.round(
          history.reduce((sum, result) => sum + result.accuracy, 0) / count,
        )
      : 0,
    average = count
      ? Math.round(
          history.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) /
            count,
        )
      : 0;
  if (!configured)
    return (
      <div className="setup-state">
        <Brand />
        <h1>Connect your Firebase project</h1>
        <p>
          Add the Firebase web app configuration in .env.local and restart Vite.
        </p>
        <p className="muted">
          Missing settings: {missingFirebaseConfig.join(", ")}
        </p>
        <p className="muted">
          See .env.example and README.md for setup instructions. No demo account
          is used as a fallback.
        </p>
      </div>
    );
  if (authLoading)
    return (
      <div className="setup-state" role="status">
        <Brand />
        <h1>Restoring your session…</h1>
      </div>
    );
  if (authStateError)
    return (
      <div className="setup-state" role="alert">
        <Brand />
        <p>{authStateError}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  if (firebaseUser && adminRoute && roleLoading)
    return (
      <div className="setup-state" role="status">
        <Brand />
        <h1>Verifying administrator access…</h1>
      </div>
    );
  if (firebaseUser && adminRoute && isAdmin)
    return (
      <React.Suspense
        fallback={
          <div className="setup-state" role="status">
            Loading admin workspace…
          </div>
        }
      >
        <AdminPanel
          user={firebaseUser}
          theme={theme}
          toggleTheme={toggleTheme}
          onExit={() => {
            navigatePath("/");
            setView("dashboard");
          }}
          onLogout={logout}
        />
      </React.Suspense>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!user ? (
        <Auth
          mode={auth}
          setMode={setAuth}
          login={login}
          signupUser={signup}
          googleLogin={googleLogin}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : session ? (
        <TestScreen
          session={session}
          setSession={setSession}
          operation={operation}
          notify={notify}
          onSubmit={() => setModal({ type: "submit" })}
          onTimeout={finish}
          theme={theme}
          toggleTheme={toggleTheme}
          onExit={() => setModal({ type: "exit" })}
        />
      ) : (
        <div className="app-shell">
          <aside className={cn("sidebar", mobileNav && "open")}>
            <Brand />
            <div className="sidebar-label">YOUR WORKSPACE</div>
            <nav>
              {[
                [LayoutDashboard, "dashboard", "Overview"],
                [Files, "tests", "Mock tests"],
                [ChartNoAxesCombined, "performance", "My performance"],
              ].map(([C, id, label]) => (
                <button
                  key={id}
                  className={cn("nav-item", view === id && "active")}
                  onClick={() => navigate(id)}
                >
                  <C size={18} />
                  <span>{label}</span>
                  {id === "tests" && <small>{exams.length}</small>}
                </button>
              ))}
            </nav>
            {isAdmin && (
              <button
                className="nav-item admin-entry"
                onClick={() => navigatePath("/admin")}
              >
                <ShieldCheck size={18} />
                <span>Admin workspace</span>
                <ArrowUpRight size={13} />
              </button>
            )}
            <div className="sidebar-note">
              <Sparkles size={24} />
              <h3>
                A little practice.
                <br />A lot of progress.
              </h3>
              <p>Your future self will thank you for showing up today.</p>
              <span>ONE QUESTION AT A TIME</span>
            </div>
            <div className="profile">
              <div className="avatar">
                {(user?.name || "Student")[0].toUpperCase()}
              </div>
              <div>
                <strong>{user?.name || "Student"}</strong>
                <small>
                  {useEmulators
                    ? "Local Firebase emulator"
                    : "Your personal workspace"}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label={user ? "Sign out" : "Sign in"}
                onClick={async () => {
                  try {
                    await logout();
                    notify("You have signed out.");
                  } catch (error) {
                    notify(authErrorMessage(error));
                  }
                }}
              >
                {user ? <LogOut size={16} /> : <ArrowUpRight size={16} />}
              </button>
            </div>
          </aside>
          {mobileNav && (
            <button
              className="nav-backdrop"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
            />
          )}
          <div className="content-shell">
            <header className="workspace-header">
              <div className="flex items-center gap-3">
                <button
                  className="icon-button mobile-menu"
                  aria-label="Open navigation"
                  onClick={() => setMobileNav(true)}
                >
                  <Menu size={20} />
                </button>
                <div className="breadcrumb">
                  Workspace <ChevronRight size={12} />
                  <span>
                    {view === "dashboard"
                      ? "Overview"
                      : view === "tests"
                        ? "Mock tests"
                        : view === "performance"
                          ? "My performance"
                          : "Test results"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="header-status">
                  <i /> A fresh start, every day
                </span>
                <ThemeButton theme={theme} onClick={toggleTheme} />
                {!user && (
                  <button
                    className="header-login"
                    onClick={() => setAuth("login")}
                  >
                    Log in <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </header>
            <main id="main" className="workspace-main">
              {useEmulators && (
                <div className="emulator-banner">
                  <ShieldCheck size={14} /> Connected to local Firebase
                  emulators. Data is isolated from production.
                </div>
              )}
              {dataError && (
                <div className="backend-error" role="alert">
                  <AlertTriangle size={17} />
                  <p>{dataError}</p>
                  <button
                    className="text-link"
                    onClick={() => setRetry((n) => n + 1)}
                  >
                    Retry
                  </button>
                </div>
              )}
              {view === "dashboard" && (
                <>
                  <PageHeading
                    eyebrow="LET’S MAKE TODAY COUNT"
                    title={
                      user
                        ? `A fresh start, ${user.name.split(" ")[0]}.`
                        : "Small steps. Big possibilities."
                    }
                    subtitle="Your next chapter starts with a little practice today."
                  />
                  <section className="hero">
                    <div className="hero-content">
                      <span className="eyebrow">YOUR AMBITION. YOUR PACE.</span>
                      <h2>
                        Dream big.
                        <br />
                        <span>Practice a little, every day.</span>
                      </h2>
                      <p>
                        JEE or NEET, your journey is uniquely yours.
                        <br />
                        Build confidence with every question you solve.
                      </p>
                      <button
                        className="btn btn-lime"
                        onClick={() => navigate("tests")}
                      >
                        Find your next test <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit outer" />
                      <div className="orbit inner" />
                      <div className="target-circle">
                        <Target size={68} strokeWidth={1.3} />
                      </div>
                      <div className="floating-tag tag-one">
                        <Sparkles size={13} /> Focus. Practice. Grow.
                      </div>
                      <div className="floating-tag tag-two">
                        <TrendingUp size={14} /> A little better, every day
                      </div>
                      <span className="orbit-dot" />
                    </div>
                  </section>
                  <Stats count={count} accuracy={accuracy} average={average} />
                  <SectionHeading
                    title="Choose your next challenge"
                    subtitle="One goal in mind. A practice path that fits you."
                    action="Explore all tests"
                    onClick={() => navigate("tests")}
                  />
                  <Filters filter={filter} setFilter={setFilter} />
                  <TestCards
                    exams={exams}
                    filter={filter}
                    start={start}
                    loading={testsLoading}
                  />
                  <div className="bottom-grid">
                    <section className="panel activity-panel">
                      <SectionHeading
                        title="Your recent activity"
                        subtitle="Little milestones on the way to something big."
                        action={<ArrowUpRight size={16} />}
                        onClick={() => navigate("performance")}
                      />
                      <History
                        loading={historyLoading}
                        history={history.slice(0, 2)}
                        onOpen={(r) => {
                          setResult(r);
                          navigate("results");
                        }}
                        onStart={() => navigate("tests")}
                      />
                    </section>
                    <section className="panel daily-note">
                      <span className="eyebrow">
                        <Sparkles size={13} /> A LITTLE REMINDER
                      </span>
                      <blockquote>
                        “You don’t have to be perfect.
                        <br />
                        You just have to keep going.”
                      </blockquote>
                      <p>
                        Focus on understanding, not just the score.
                        <br />
                        Consistency is your quiet superpower.
                      </p>
                      <div className="note-line" />
                    </section>
                  </div>
                </>
              )}
              {view === "tests" && (
                <>
                  <PageHeading
                    eyebrow="PRACTICE WITH PURPOSE"
                    title="Your next challenge awaits."
                    subtitle="Choose your exam. Settle in. See what you’re capable of."
                  />
                  <div className="info-banner">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>
                        A real exam experience. A safe place to learn.
                      </strong>
                      <p>
                        Full-length, timed practice with instant analysis.
                        Generated sample content; these are not official exam
                        papers.
                      </p>
                    </div>
                  </div>
                  <SectionHeading
                    title="Find your focus"
                    subtitle="Three paths. One step closer to where you want to be."
                  />
                  <Filters filter={filter} setFilter={setFilter} />
                  <TestCards
                    exams={exams}
                    filter={filter}
                    start={start}
                    loading={testsLoading}
                  />
                  <section className="preparation-strip">
                    <Clock3 />
                    <div>
                      <h3>Give yourself room to focus.</h3>
                      <p>
                        Find a quiet spot, keep a notebook handy, and give it
                        your best. You can leave any question and return later.
                      </p>
                    </div>
                  </section>
                </>
              )}
              {view === "performance" && (
                <>
                  <PageHeading
                    eyebrow="YOUR PROGRESS, AT A GLANCE"
                    title="Every attempt adds up."
                    subtitle="Understand your strengths. Find your next opportunity to grow."
                  />
                  <Stats count={count} accuracy={accuracy} average={average} />
                  <section className="panel">
                    <SectionHeading
                      title="Your test history"
                      subtitle="A record of the effort behind your ambition."
                    />
                    <History
                      loading={historyLoading}
                      history={history}
                      onOpen={(r) => {
                        setResult(r);
                        navigate("results");
                      }}
                      onStart={() => navigate("tests")}
                    />
                  </section>
                </>
              )}
              {view === "results" && result && (
                <Results result={result} onPractice={() => navigate("tests")} />
              )}
            </main>
            <footer>
              <span>
                Made for big ambitions. Built around small, consistent steps.
              </span>
              <span>Veda Test © {new Date().getFullYear()}</span>
            </footer>
          </div>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "start"
              ? "Ready for your next challenge?"
              : modal.type === "exit"
                ? "Leave this test?"
                : "Ready to submit?"
          }
          onClose={() => {
            if (!operation) setModal(null);
          }}
        >
          {operation && (
            <p className="operation-status" role="status">
              {operation === "starting"
                ? "Loading your paper…"
                : "Submitting securely… Please keep this tab open."}
            </p>
          )}
          {modal.type === "start" ? (
            <>
              <div className={`modal-exam-icon ${modal.exam.accent}`}>
                <Icon id={modal.exam.examType || modal.exam.id} size={26} />
              </div>
              <h3>{modal.exam.name} · Full mock 01</h3>
              <div className="modal-facts">
                <span>
                  <Clock3 size={16} />
                  {modal.exam.duration} minutes
                </span>
                <span>
                  <Files size={16} />
                  {modal.exam.count} questions
                </span>
                <span>
                  <Target size={16} />
                  {modal.exam.marks} marks
                </span>
              </div>
              <div className="info-banner compact">
                <BookOpen size={18} />
                <p>
                  Correct answers: +{modal.exam.marking?.correct ?? 4}.
                  Incorrect MCQs: {modal.exam.marking?.mcqIncorrect ?? -1};
                  incorrect numerical answers:{" "}
                  {modal.exam.marking?.numericalIncorrect ?? -1}. Unanswered
                  questions: 0. Individual question marks are shown during the
                  test.
                  {(modal.exam.examType || modal.exam.id) === "advanced" &&
                    " JEE Advanced practice formats may differ from official papers."}
                </p>
              </div>
              <p className="muted small">
                {modal.exam.description && (
                  <>
                    {modal.exam.description}
                    <br />
                  </>
                )}
                The server starts the timer and saves your answers as you work.
                Unfinished attempts resume with the original deadline; late
                submissions are graded using the last answers saved before it.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setModal(null)}
                >
                  Not yet
                </button>
                <button
                  disabled={!!operation}
                  className="btn btn-primary"
                  onClick={() => begin(modal.exam)}
                >
                  Let’s begin <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : modal.type === "exit" ? (
            <>
              <p className="muted">
                Your saved answers can be resumed from this test. The timer will
                continue running while you are away.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setModal(null)}
                >
                  Keep practicing
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setSession(null);
                    setModal(null);
                    navigate("tests");
                  }}
                >
                  Leave test
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                Take one last look. Once submitted, your answers can’t be
                changed.
              </p>
              <div className="submit-summary">
                <strong>
                  {
                    Object.values(session?.answers || {}).filter(
                      (a) => String(a).trim() !== "",
                    ).length
                  }
                  <small>Answered</small>
                </strong>
                <strong>
                  {session?.questions.length -
                    Object.values(session?.answers || {}).filter(
                      (a) => String(a).trim() !== "",
                    ).length}
                  <small>Unanswered</small>
                </strong>
                <strong>
                  {session?.marked.length}
                  <small>Marked for review</small>
                </strong>
              </div>
              <div className="info-banner compact">
                <ShieldCheck size={18} />
                <p>
                  Marked questions with a saved answer will be evaluated.
                  Unanswered questions receive zero marks.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setModal(null)}
                >
                  Return to test
                </button>
                <button
                  disabled={!!operation}
                  className="btn btn-primary"
                  onClick={finish}
                >
                  Submit & see results <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {notification && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notification}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotification("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function PageHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className="date-pill">
        <CalendarDays size={14} />
        {new Date().toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    </div>
  );
}
function SectionHeading({ title, subtitle, action, onClick }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-link" onClick={onClick}>
          {action}
          {typeof action === "string" && <ArrowUpRight size={14} />}
        </button>
      )}
    </div>
  );
}
function Stats({ count, accuracy, average }) {
  return (
    <div className="stats-grid">
      {[
        [
          Files,
          "Tests completed",
          String(count).padStart(2, "0"),
          "tests",
          "green",
        ],
        [
          Target,
          "Average accuracy",
          count ? accuracy : "—",
          count ? "%" : "No attempts yet",
          "orange",
        ],
        [
          TrendingUp,
          "Overall score",
          count ? average : "—",
          count ? "% average" : "Your potential awaits",
          "purple",
        ],
      ].map(([C, title, value, note, color]) => (
        <div className="stat-card" key={title}>
          <div className={`stat-icon ${color}`}>
            <C size={21} strokeWidth={1.6} />
          </div>
          <div>
            <span>{title}</span>
            <strong>
              {value}
              <small>{note}</small>
            </strong>
          </div>
          <span className="stat-corner">
            <ArrowUpRight size={11} />
          </span>
        </div>
      ))}
    </div>
  );
}
function Filters({ filter, setFilter }) {
  return (
    <div className="filter-tabs" role="group" aria-label="Filter exam category">
      {[
        ["all", "All exams"],
        ["Engineering", "Engineering"],
        ["Medical", "Medical"],
      ].map(([id, label]) => (
        <button
          key={id}
          onClick={() => setFilter(id)}
          aria-pressed={filter === id}
          className={cn(filter === id && "selected")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function TestCards({ exams, filter, start, loading }) {
  if (loading)
    return (
      <div className="panel" role="status">
        Loading available tests…
      </div>
    );
  if (!exams.length)
    return (
      <div className="panel">
        No active tests are available yet. Ask your instructor to publish a
        test.
      </div>
    );
  return (
    <div className="test-grid">
      {exams
        .filter((e) => filter === "all" || e.category === filter)
        .map((e) => (
          <article className={`test-card ${e.accent}`} key={e.id}>
            <div className="card-top">
              <div className="exam-icon">
                <Icon id={e.examType || e.id} size={25} strokeWidth={1.5} />
              </div>
              <span className="exam-badge">{e.category}</span>
            </div>
            <h3>{e.name}</h3>
            <p>{e.subtitle}</p>
            <div className="subject-chips">
              {e.subjects.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="test-metadata">
              <span>
                <Clock3 size={12} />
                {e.duration} mins
              </span>
              <span>
                <Files size={12} />
                {e.count} questions
              </span>
              <span>
                <Target size={12} />
                {e.marks} marks
              </span>
            </div>
            <button className="start-test" onClick={() => start(e)}>
              Start mock test <ArrowUpRight size={16} />
            </button>
            <div className="card-bottom">
              <span>
                <i />
                {e.level}
              </span>
              <span>Full mock 01</span>
            </div>
          </article>
        ))}
    </div>
  );
}
function History({ history, onOpen, onStart, loading }) {
  if (loading)
    return (
      <p className="muted" role="status">
        Loading your attempts…
      </p>
    );
  return history.length ? (
    <div className="history-list">
      {history.map((r) => {
        const e = r.exam;
        return (
          <button className="history-item" key={r.id} onClick={() => onOpen(r)}>
            <span className={`history-icon ${e.accent}`}>
              <Icon id={e.examType || e.id} size={19} />
            </span>
            <span className="history-title">
              <strong>{e.name}</strong>
              <small>
                {new Date(r.date).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {r.correct}/{r.total} correct
              </small>
            </span>
            <span className="history-score">
              {r.score}
              <small> / {e.marks}</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        );
      })}
    </div>
  ) : (
    <div className="empty-state">
      <span className="empty-icon">
        <TrendingUp size={23} />
      </span>
      <div>
        <h3>Your progress story starts here</h3>
        <p>
          Take your first mock test to see your results.
          <br />
          Every attempt is a step forward.
        </p>
        <button className="text-link" onClick={onStart}>
          Find a test <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
function Auth({
  mode,
  setMode,
  login,
  signupUser,
  googleLogin,
  theme,
  toggleTheme,
}) {
  const signup = mode === "signup";
  const [form, setForm] = useState({ name: "", email: "", password: "" }),
    [errors, setErrors] = useState({}),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    setErrors({});
    setAuthError("");
  }, [mode]);
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (signup && form.name.trim().length < 2)
      errs.name = "Please enter at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address.";
    if (form.password.length < (signup ? 8 : 1))
      errs.password = signup
        ? "Use at least 8 characters."
        : "Enter your password.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setAuthError("");
    try {
      if (signup) await signupUser(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (error) {
      setAuthError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setAuthError("");
    try {
      await googleLogin();
    } catch (error) {
      setAuthError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <span className="eyebrow">A LITTLE PRACTICE. A BIGGER TOMORROW.</span>
          <h1>
            Your ambition
            <br />
            belongs here<span>.</span>
          </h1>
          <p>
            Big goals are built on small moments.
            <br />
            Make this one count.
          </p>
          <div className="auth-illustration">
            <div className="auth-orbit" />
            <Target size={100} strokeWidth={1} />
            <span className="auth-float">
              <CheckCheck size={18} /> Progress, at your pace
            </span>
          </div>
          <div className="auth-story-bottom">
            <span>
              <ShieldCheck size={16} /> A focused space to grow
            </span>
            <span>JEE · NEET · YOUR NEXT CHAPTER</span>
          </div>
        </div>
      </aside>
      <div className="auth-form-side">
        <div className="auth-top">
          <Brand />
          <ThemeButton theme={theme} onClick={toggleTheme} />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {signup ? "YOUR JOURNEY STARTS HERE" : "GOOD TO HAVE YOU BACK"}
          </span>
          <h1>
            {signup ? "Make room for possibility." : "Welcome to Veda Test."}
          </h1>
          <p className="muted">
            {signup
              ? "A little commitment today. A lot of potential tomorrow."
              : "Pick up where you left off. Your next goal is waiting."}
          </p>
          <button disabled={busy} className="google-button" onClick={google}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.5Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-1 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10A6 6 0 0 1 12 5.9Z"
              />
            </svg>
            Continue with Google
          </button>
          <div className="auth-divider">
            <span />
            or continue with email
            <span />
          </div>
          <form onSubmit={submit} noValidate>
            {authError && (
              <div className="auth-error" role="alert">
                {authError}
              </div>
            )}
            {signup && (
              <FormField
                label="Full name"
                name="name"
                placeholder="Your name"
                value={form.name}
                error={errors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            )}
            <FormField
              label="Email address"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              icon={<Mail size={16} />}
            />
            <div className="password-wrap">
              <FormField
                label="Password"
                name="password"
                type={show ? "text" : "password"}
                placeholder="At least 8 characters"
                value={form.password}
                error={errors.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={signup ? "new-password" : "current-password"}
                icon={<LockKeyhole size={16} />}
              />
              <button
                className="password-toggle icon-button"
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              disabled={busy}
              className="btn btn-primary auth-submit"
              type="submit"
            >
              {busy
                ? "Opening your workspace…"
                : signup
                  ? "Create your account"
                  : "Log in to your workspace"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already part of the journey?" : "New around here?"}{" "}
            <button
              disabled={busy}
              onClick={() => setMode(signup ? "login" : "signup")}
            >
              {signup ? "Log in" : "Create an account"}{" "}
              <ArrowUpRight size={12} />
            </button>
          </p>
          <div className="demo-notice">
            <ShieldCheck size={15} />
            <p>
              {useEmulators
                ? "Local Firebase Authentication emulator. These accounts exist only in your local development environment."
                : "Your account is secured by Firebase Authentication. Your password is never stored by Veda Test."}
            </p>
          </div>
        </div>
        <span className="auth-footer">
          A calmer way to prepare for something big.
        </span>
      </div>
    </div>
  );
}
function FormField({ label, error, icon, ...props }) {
  return (
    <div className="form-field">
      <label htmlFor={props.name}>{label}</label>
      <div className={cn("input-shell", error && "invalid")}>
        {icon}
        <input
          id={props.name}
          {...props}
          aria-invalid={!!error}
          aria-describedby={error ? `${props.name}-error` : undefined}
        />
      </div>
      {error && (
        <span id={`${props.name}-error`} className="field-error" role="alert">
          <AlertTriangle size={12} />
          {error}
        </span>
      )}
    </div>
  );
}
function Results({ result: r, onPractice }) {
  const [filter, setFilter] = useState("All"),
    [subject, setSubject] = useState("All subjects"),
    [expanded, setExpanded] = useState(null),
    [query, setQuery] = useState("");
  useEffect(() => {
    setFilter("All");
    setSubject("All subjects");
    setExpanded(null);
    setQuery("");
  }, [r.id]);
  const exam = r.exam,
    questions = r.breakdown,
    status = (q) =>
      q.status === "correct"
        ? "Correct"
        : q.status === "incorrect"
          ? "Incorrect"
          : "Unattempted",
    filtered = questions.filter(
      (q) =>
        (filter === "All" || status(q) === filter) &&
        (subject === "All subjects" || q.subject === subject) &&
        (!query ||
          String(q.id + 1) === query ||
          q.text.toLowerCase().includes(query.toLowerCase())),
    );
  return (
    <>
      <div className="results-title">
        <PageHeading
          eyebrow="ANOTHER STEP FORWARD"
          title="Test complete. Growth unlocked."
          subtitle={`${exam.name} · Full mock 01 · ${new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
        />
        <button className="btn btn-secondary" onClick={onPractice}>
          Keep practicing <ArrowUpRight size={15} />
        </button>
      </div>
      <section className="score-banner">
        <div className="score-main">
          <span className="score-medal">
            <Trophy size={29} strokeWidth={1.5} />
          </span>
          <div>
            <span className="eyebrow">YOUR TOTAL SCORE</span>
            <div className="big-score">
              {r.score}
              <span> / {exam.marks}</span>
            </div>
            <p>Every question is a chance to learn.</p>
          </div>
        </div>
        <div className="score-banner-stat">
          <span>Percentile</span>
          <strong style={{ fontSize: 20 }}>Not available</strong>
          <p>Requires a representative student cohort</p>
        </div>
        <div className="score-banner-stat">
          <span>Time spent</span>
          <strong>
            {Math.floor(r.seconds / 60)}
            <small>m</small> {r.seconds % 60}
            <small>s</small>
          </strong>
          <p>of {exam.duration} minutes available</p>
        </div>
      </section>
      <div className="result-counts">
        {[
          [CheckCircle2, "Correct", r.correct, "correct"],
          [XCircle, "Incorrect", r.incorrect, "incorrect"],
          [Minus, "Unattempted", r.unattempted, "unattempted"],
          [
            Target,
            "Accuracy",
            `${r.correct + r.incorrect ? Math.round((r.correct / (r.correct + r.incorrect)) * 100) : 0}%`,
            "accuracy",
          ],
        ].map(([C, name, val, color]) => (
          <div className={color} key={name}>
            <C size={21} />
            <div>
              <span>{name}</span>
              <strong>{val}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="subject-analysis">
        <SectionHeading
          title="A closer look at your subjects"
          subtitle="Find your strengths. Give the rest a little more attention."
        />
        <div className="subject-analysis-grid">
          {exam.subjects.map((sub) => {
            const qs = questions.filter((q) => q.subject === sub),
              correct = qs.filter((q) => status(q) === "Correct").length,
              score = qs.reduce((s, q) => s + q.awardedMarks, 0);
            return (
              <div key={sub}>
                <div>
                  <strong>{sub}</strong>
                  <span>
                    {score} / {qs.reduce((sum, q) => sum + q.correctMarks, 0)}
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${qs.length ? (correct / qs.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p>
                  {correct} correct of {qs.length} questions
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <section className="review-section">
        <SectionHeading
          title="Turn mistakes into understanding"
          subtitle="Review your answers and follow the solution, one step at a time."
        />
        <div className="review-toolbar">
          <div
            className="filter-tabs"
            role="group"
            aria-label="Filter question reviews"
          >
            {["All", "Correct", "Incorrect", "Unattempted"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                className={cn(filter === f && "selected")}
                onClick={() => setFilter(f)}
              >
                {f}
                <span>
                  {f === "All"
                    ? r.total
                    : f === "Correct"
                      ? r.correct
                      : f === "Incorrect"
                        ? r.incorrect
                        : r.unattempted}
                </span>
              </button>
            ))}
          </div>
          <div className="review-search">
            <label className="sr-only" htmlFor="review-search">
              Search questions
            </label>
            <Search size={15} />
            <input
              id="review-search"
              placeholder="Search questions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option>All subjects</option>
            {exam.subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="review-showing">
          Showing {filtered.length} of {questions.length} questions
        </p>
        <div className="reviews">
          {filtered.length ? (
            filtered.map((q) => {
              const st = status(q);
              return (
                <article className="review-card" key={q.id}>
                  <div className="review-question-header">
                    <span className="eyebrow">
                      QUESTION {q.id + 1} <span>·</span>{" "}
                      {q.subject.toUpperCase()}
                    </span>
                    <span className={`result-status ${st.toLowerCase()}`}>
                      {st === "Correct" ? (
                        <Check size={13} />
                      ) : st === "Incorrect" ? (
                        <X size={13} />
                      ) : (
                        <Minus size={13} />
                      )}{" "}
                      {st}
                    </span>
                  </div>
                  <h3>{q.text}</h3>
                  <div className="review-answers">
                    <div className={cn(st === "Incorrect" && "wrong-answer")}>
                      <span>YOUR ANSWER</span>
                      <strong>
                        {st === "Unattempted"
                          ? "Not attempted"
                          : r.answers[q.id]}
                      </strong>
                    </div>
                    <div className="right-answer">
                      <span>CORRECT ANSWER</span>
                      <strong>
                        <CheckCircle2 size={14} />
                        {q.answer}
                      </strong>
                    </div>
                    <div className="marks-earned">
                      <span>MARKS</span>
                      <strong>
                        {q.awardedMarks > 0 ? "+" : ""}
                        {q.awardedMarks}
                      </strong>
                    </div>
                  </div>
                  <button
                    className="solution-toggle"
                    aria-expanded={expanded === q.id}
                    onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  >
                    <BookOpen size={14} />
                    {expanded === q.id
                      ? "Hide solution"
                      : "View step-by-step solution"}
                    <ChevronDown
                      size={16}
                      className={cn(expanded === q.id && "rotate-180")}
                    />
                  </button>
                  {expanded === q.id && (
                    <div className="solution">
                      <h4>Let’s break it down</h4>
                      <ol>
                        {q.steps.map((step, i) => (
                          <li key={step}>
                            <span>{i + 1}</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="panel empty-review">
              <Search size={28} />
              <h3>No questions match these filters.</h3>
              <button
                className="text-link"
                onClick={() => {
                  setFilter("All");
                  setSubject("All subjects");
                  setQuery("");
                }}
              >
                Reset filters <RotateCcw size={14} />
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
