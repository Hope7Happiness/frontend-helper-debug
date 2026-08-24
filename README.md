# Frontend Helper demo

一个仅在开发环境加载的网页调试外框。它使用 rrweb 记录页面状态，并把用户操作、元素引用和自然语言批注保存到本地开发服务器。每条轨迹返回一个短 ID，用户只需把 ID 告诉 AI。

## Install the Codex skill

给 Codex 或其他 agent 的一行安装指令：

`Install the frontend-helper-debug skill from the public GitHub repository Hope7Happiness/frontend-helper-debug, path skills/frontend-helper-debug.`

在本机 Codex 环境中也可以直接运行：

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo Hope7Happiness/frontend-helper-debug \
  --path skills/frontend-helper-debug
```

安装后，skill 会在下一轮 Codex 对话中可用。

## 运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址。调试面板默认展开，也可以使用 `Alt + Shift + H` 显示或隐藏。拖动面板标题栏可以把它移到不遮挡内容的位置，位置会按当前站点保留。

演示流程：

1. 在调试面板开始录制。
2. 点击页面里的“同步远端草稿”。
3. 在请求结束前关闭弹窗。
4. 等待旧请求错误地重新打开弹窗。
5. 点击“引用元素”，选择弹窗并添加批注。
6. 停止录制，等待服务器返回 `fh_...` 轨迹 ID。
7. 在轨迹列表里查看、命名或删除轨迹，也可以直接复制 ID 给 AI。

## Workspace

- `packages/dev-overlay`：框架无关的 dev runtime、Shadow DOM 工具栏、rrweb 录制和元素批注。
- `packages/vite-plugin`：dev-only 自动注入和轨迹 `POST/GET/DELETE` API。
- `examples/demo`：包含异步竞态问题的 Vite 演示站点。
- `scripts/smoke.mjs`：通过真实 Chrome 验证录制、保存、按 ID 查询和删除流程。
- `artifacts/demo-trace.fhtrace.json`：自动化测试生成的示例 trace。
- `skills/frontend-helper-debug`：让 Codex 接入 Frontend Helper 并按 ID 分析轨迹的 Skill。

## Manual mode

不使用 Vite 的 Flask、Django、FastAPI、服务端渲染 HTML 或静态开发站点也可以接入。Skill 的手动模式会指导 agent：在开发模板中注入浏览器 runtime，并在现有 Python/其他后端上实现同一组 trace API。后端语言不影响浏览器录制器；需要变化的是注入位置和 API adapter。

详见 [`skills/frontend-helper-debug/references/manual.md`](skills/frontend-helper-debug/references/manual.md)。

## Trace API

```text
POST   /__frontend-helper/traces
GET    /__frontend-helper/traces
GET    /__frontend-helper/traces/:id
PATCH  /__frontend-helper/traces/:id
DELETE /__frontend-helper/traces/:id
```

轨迹默认存储在 Vite 项目的 `.frontend-helper/traces`，并被 Git 忽略。保存时会尽可能固定项目名称、`package.json` 版本、Git commit、branch 和 dirty 状态。

## 验证

```bash
npm run typecheck
npm run build
npm run test:smoke
```

生产构建只包含演示网站本身；Vite 插件使用 `apply: "serve"`，调试 UI 和轨迹 API 都不会进入 production build。
