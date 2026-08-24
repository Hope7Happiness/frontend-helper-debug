import "./style.css";

type ActivityTone = "violet" | "blue" | "amber";

interface Activity {
  title: string;
  detail: string;
  time: string;
  tone: ActivityTone;
}

const activities: Activity[] = [
  { title: "Design review", detail: "12 comments resolved", time: "2m", tone: "violet" },
  { title: "Landing page", detail: "Draft updated", time: "18m", tone: "blue" },
  { title: "API handoff", detail: "Waiting for review", time: "1h", tone: "amber" },
];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="Orbit Notes 首页">
        <span class="brand-mark">O</span>
        <span>Orbit</span>
      </a>

      <nav class="nav" aria-label="主导航">
        <a class="nav-item active" href="#overview"><span>⌂</span>Overview</a>
        <a class="nav-item" href="#notes"><span>◇</span>Notes</a>
        <a class="nav-item" href="#projects"><span>▦</span>Projects</a>
        <a class="nav-item" href="#archive"><span>◷</span>Archive</a>
      </nav>

      <div class="sidebar-bottom">
        <div class="workspace-card">
          <span class="workspace-avatar">F</span>
          <div><strong>Frontend Lab</strong><small>Development</small></div>
          <span class="workspace-more">•••</span>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div>
          <span class="eyebrow">SUNDAY, AUGUST 16</span>
          <h1>Good afternoon, Siri.</h1>
        </div>
        <div class="top-actions">
          <button class="icon-action" type="button" aria-label="搜索">⌕</button>
          <button class="avatar-button" type="button" aria-label="个人资料">SZ</button>
        </div>
      </header>

      <section class="hero-grid">
        <article class="focus-card">
          <div class="focus-glow"></div>
          <div class="focus-copy">
            <span class="card-kicker">CURRENT FOCUS</span>
            <h2>Ship a calmer<br />creative workflow.</h2>
            <p>Keep the ideas moving without losing the details that matter.</p>
            <button class="primary-action" type="button" data-testid="sync-draft">同步远端草稿 <span>→</span></button>
          </div>
          <div class="orbital-art" aria-hidden="true">
            <div class="planet"></div>
            <div class="orbit orbit-one"></div>
            <div class="orbit orbit-two"></div>
            <span class="star star-one">✦</span>
            <span class="star star-two">·</span>
          </div>
        </article>

        <article class="demo-guide">
          <span class="card-kicker dark">DEMO SCENARIO</span>
          <h3>捕获一个异步竞态</h3>
          <ol>
            <li><span>1</span>在右下角开始录制</li>
            <li><span>2</span>点击“同步远端草稿”</li>
            <li><span>3</span>马上关闭加载弹窗</li>
            <li><span>4</span>弹窗错误地重新出现后，引用它并批注</li>
          </ol>
          <div class="shortcut-hint"><kbd>Alt</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>H</kbd><span>调试外框</span></div>
        </article>
      </section>

      <section class="content-grid">
        <article class="activity-card">
          <div class="section-heading">
            <div><span class="card-kicker dark">WORKSPACE</span><h3>Recent activity</h3></div>
            <button class="text-button" type="button">View all</button>
          </div>
          <div class="activity-list">
            ${activities
              .map(
                (activity) => `
                  <div class="activity-row">
                    <span class="activity-dot ${activity.tone}"></span>
                    <div><strong>${activity.title}</strong><small>${activity.detail}</small></div>
                    <time>${activity.time}</time>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="trace-card">
          <div class="section-heading">
            <div><span class="card-kicker dark">LIVE STATE</span><h3>Async request log</h3></div>
            <span class="live-pill"><i></i> live</span>
          </div>
          <div class="request-log" data-request-log>
            <div class="log-empty">触发同步后，这里会显示请求时序。</div>
          </div>
        </article>
      </section>
    </main>
  </div>

  <div class="modal-layer" data-modal-layer hidden>
    <section class="sync-modal" role="dialog" aria-modal="true" aria-labelledby="sync-title" data-testid="sync-dialog">
      <button class="modal-close" type="button" aria-label="关闭同步弹窗" data-testid="close-dialog">×</button>
      <div class="sync-icon" data-sync-icon><span></span></div>
      <span class="card-kicker dark" data-sync-kicker>SYNCING</span>
      <h2 id="sync-title" data-sync-title>正在读取远端草稿…</h2>
      <p data-sync-copy>请求已经发出。现在马上关闭这个弹窗，等待旧请求返回。</p>
      <div class="progress-track" data-progress><i></i></div>
      <button class="modal-primary" type="button" data-modal-action disabled>继续编辑</button>
    </section>
  </div>

  <div class="bug-toast" data-bug-toast hidden>
    <span>!</span><div><strong>Race condition triggered</strong><small>已关闭的弹窗被旧请求重新打开</small></div>
  </div>
`;

const syncButton = requireElement<HTMLButtonElement>("[data-testid='sync-draft']");
const modalLayer = requireElement<HTMLElement>("[data-modal-layer]");
const closeButton = requireElement<HTMLButtonElement>("[data-testid='close-dialog']");
const syncTitle = requireElement<HTMLElement>("[data-sync-title]");
const syncCopy = requireElement<HTMLElement>("[data-sync-copy]");
const syncKicker = requireElement<HTMLElement>("[data-sync-kicker]");
const syncIcon = requireElement<HTMLElement>("[data-sync-icon]");
const progress = requireElement<HTMLElement>("[data-progress]");
const modalAction = requireElement<HTMLButtonElement>("[data-modal-action]");
const requestLog = requireElement<HTMLElement>("[data-request-log]");
const bugToast = requireElement<HTMLElement>("[data-bug-toast]");

let requestCounter = 0;
let dismissedRequest = 0;
let toastTimer: number | undefined;

syncButton.addEventListener("click", () => {
  const requestId = ++requestCounter;
  const delay = 1500 + Math.round(Math.random() * 850);
  openLoadingModal();
  appendLog("request", `GET /api/drafts/latest · #${requestId}`, "started", `0ms`);

  window.setTimeout(() => {
    appendLog("response", `200 OK · #${requestId}`, "completed", `${delay}ms`);

    // Intentional demo bug: this stale async response ignores that the user
    // already dismissed the dialog and opens it again.
    modalLayer.hidden = false;
    syncKicker.textContent = "REMOTE DRAFT READY";
    syncTitle.textContent = "找到了 3 条远端修改";
    syncCopy.textContent = "旧请求返回后直接更新了 UI，没有检查弹窗是否已经被用户关闭。";
    syncIcon.classList.add("success");
    progress.hidden = true;
    modalAction.disabled = false;

    if (dismissedRequest === requestId) {
      appendLog("mutation", "Dialog visibility", "reopened", "+14ms");
      showBugToast();
    }
  }, delay);
});

closeButton.addEventListener("click", () => {
  dismissedRequest = requestCounter;
  modalLayer.hidden = true;
  appendLog("user", `Dismiss dialog · #${requestCounter}`, "closed", "now");
});

modalAction.addEventListener("click", () => {
  modalLayer.hidden = true;
});

modalLayer.addEventListener("click", (event) => {
  if (event.target === modalLayer) closeButton.click();
});

function openLoadingModal(): void {
  modalLayer.hidden = false;
  syncKicker.textContent = "SYNCING";
  syncTitle.textContent = "正在读取远端草稿…";
  syncCopy.textContent = "请求已经发出。现在马上关闭这个弹窗，等待旧请求返回。";
  syncIcon.classList.remove("success");
  progress.hidden = false;
  modalAction.disabled = true;
}

function appendLog(kind: string, label: string, status: string, timing: string): void {
  requestLog.querySelector(".log-empty")?.remove();
  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML = `
    <span class="log-kind ${kind}">${kind.slice(0, 1).toUpperCase()}</span>
    <div><strong>${label}</strong><small>${status}</small></div>
    <time>${timing}</time>
  `;
  requestLog.prepend(row);
}

function showBugToast(): void {
  bugToast.hidden = false;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    bugToast.hidden = true;
  }, 4200);
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Demo is missing ${selector}`);
  return element;
}
