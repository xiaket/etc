# dsh-baton — 代码工作台

一个 DeepSeek Harness 插件：在侧栏加一个「代码工作台」面板，你在一个统一的输入框里描述想做的事，一个长期存在的**指挥者**（commander）session 判断该在哪个仓库做、用 `baton_dispatch` 派出 **worker** session 去干活，任务状态实时出现在右栏，完成时页面 toast + 音效提醒；需要深聊时点任务卡片进入那个 worker session 的普通会话视图。

## 安装

需要已安装的 `dsh`、符合本仓库 `package.json` 中 `engines.node` 要求的 Node.js，以及 `pnpm`。在本仓库根目录执行：

```sh
pnpm install
pnpm --filter dsh-baton build
dsh plugin --profile web add "link:$(pwd)/packages/baton"
dsh web
```

`build` 会生成 host 入口 `packages/baton/lib/index.js` 和浏览器入口 `packages/baton/lib/client.js`。必须在启动 web 前完成；缺少 `lib/client.js` 时，dsh web 会报 `client bundle not found`。`dsh plugin` 会把本地目录链接到 web profile，并自动将 `dsh-baton` 加入 `dsh.profile.bundles`；无需在 `cordis.patch.yml` 再写 `insert`。

启动后打开 dsh web 页面，侧栏应出现「代码工作台」。若 dsh web 已在运行，安装后先重启进程，再刷新浏览器。

更新本地源码后，重新构建并链接，然后重启 dsh web：

```sh
pnpm redeploy baton
```

如果使用自定义 `DSH_HOME`，安装、更新和启动时都要设置同一个值。可用 `dsh --version` 查看已安装的 Harness 版本；升级 Harness 后，按仓库根目录 README 的「Upgrading the harness」同步开发依赖并重建插件。

## 设计要点

**指挥者不属于任何 workspace。** 它以 `meta.cwd` 创建（默认 `~/.dsh/baton/`）、不传 `workspaceId`，因此 `attachSession` 不会执行；创建后立即 `workspaceRegistry.archiveSession`，侧栏任何分组都不显示它。

**面板不渲染官方 Conversation。** 官方 `ui-conversation` 的输入框在 `hero && chipTitle === undefined` 时禁用，而 `chipTitle` 只在某 workspace 的 `sessionIds` 含该 session 时存在——任何「不建 workspace 又复用官方对话面板」的路径都会撞上这条逻辑。本插件注册自己的 `main` 槽键 `baton`（`AppFrame` 按 `activePanelId` 分发，选中时官方面板整个不挂载），只借用官方**数据层**：`ctx.sessions.open(id)` 打开事件窗口拿历史与流式 chunk，`binding.session.prompt()` 发送。不做 DOM 劫持、不按 CSS Modules 类名匹配。

**host 必须持有指挥者的活句柄。** `session-controller` 的 `prompt()` 先复用活着的 agent，找不到才自己 resume——而它 resume 时没有 `setup`，`baton_*` 工具就会丢失。所以 host 启动时用 ledger 里记录的 id `agents.resume({ setup })`，全程持有；这也避免了残留 session 与 controller 争抢写句柄导致的 `SessionAlreadyOwnedError`。

**worker 在 worktree 里跑。** 派发时向 `dsh-worktree-pool` `acquire`；命中则 `cwd` 为 worktree（`isolation: 'worktree'`），miss 则在仓库根目录（`isolation: 'shared'`），卡片上标「未隔离」。worker 同样只传 `cwd`，不 attach workspace，因此它出现在侧栏「未分组」下——这正是「进入某个 session 深聊」的入口。

## 任务状态机

```
pending ──→ running ──→ in_review ──(用户确认)──→ completed
              │  ▲           │
              ▼  │           └──(follow_up)──→ running
        needs_input          
              │
              ▼
           failed ──(follow_up)──→ running
任意非终态 ──→ cancelled
```

- `needs_input`：worker 触发了 `approval/asked`（未 `decided`）或调用了 `ask_user_question`（未收到 `tool/result`）。横幅显示「N 个任务需要你处理」，「去处理」跳到该 worker 的官方会话视图原地回答。
- `in_review`：worker 到达 quiescence。`resultSummary` 取其最后一条 assistant 文本（≤ `summaryLimit`）。只有用户能确认为 `completed`；确认后释放 worker 句柄。
- host 重启：ledger 里 `running/needs_input/pending` 的任务标 `failed`，`error: host restarted while the task was running`。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 里按 id 覆盖（bundle 层已插入插件行，再 insert 一次会挂载两份）：

```yaml
- id: dsh-baton
  name: dsh-baton
  config:
    # commanderModel / workerModel 留空则跟随部署默认模型；需要覆盖时按下面的形状填：
    # commanderModel: { provider: <provider-id>, model: <model-id> }
    # workerModel:    { provider: <provider-id>, model: <model-id> }
    commanderCwd: ~/.dsh/baton
    commanderTitle: 代码工作台
    commanderPreset: ''        # 空 = 部署默认 preset（standard）
    workerPreset: ''
    workerNotes: []            # 逐行追加到每个 worker 的开场消息和指挥者的系统提示（可用 CLI、凭据位置等环境事实）
    summaryLimit: 500
```

## 文件

- `~/.dsh/dsh-baton.json` — 任务台账（schema v2；v1 自动迁移）与 `commanderSessionId`
- `~/.dsh/dsh-baton-workspace-map.json` — 工作区语义描述，注入指挥者 system prompt，`baton_update_workspace_map` 可改

## HTTP / SSE

| 路径 | 作用 |
|---|---|
| `GET /dsh-baton/state` | `{ revision, tasks, workspaceMap, commander }` |
| `POST /dsh-baton/commander` | resume 或创建指挥者，返回 `{ sessionId, created }` |
| `POST /dsh-baton/tasks/:id/ack` | in_review → completed（409 表示状态不允许） |
| `POST /dsh-baton/tasks/:id/cancel` | 取消并停止 worker |
| `GET /dsh-baton/events` | SSE：`state`（全量）、`task-settled { task, outcome }`、`heartbeat` |

## 指挥者工具

`baton_dispatch`、`baton_follow_up`、`baton_status`、`baton_cancel`、`baton_update_workspace_map`。只注册在指挥者的 scoped context 上；普通 workspace session 看不到它们。

## 开发

```sh
pnpm --filter dsh-baton typecheck
pnpm --filter dsh-baton test
pnpm run redeploy baton       # 清理重建 + 重新链接到 ~/.dsh/profiles/web
# 然后重启 dsh web；浏览器刷新即加载新 client bundle
```

浏览器 bundle 把 react、cordis、`dsh-client-store`、`dsh-client-ui-slots`、`dsh-client-ui-primitives` 声明为 external（平台共享模块），其余私有打包。`devDependencies` 里的 `@deepseek-ai/dsh-*` 只提供类型，版本须与安装版一致（见仓库 README「Upgrading the harness」）。

## 已知限制

- 指挥者自己触发 approval / `ask_user_question` 时，面板不代答，横幅引导「打开完整会话」。提示词已要求它用文字提问而不调用 `ask_user_question`。
- 面板不支持附件与截图；需要时打开指挥者的完整会话。
- 旧版本残留的 `session-baton-main-*` 会话文件不会被 resume；可手动删除 `~/.dsh/sessions/*/session-baton-main-*`。
