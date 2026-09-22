/**
 * Panel styles, injected once as a `<style>` element. Only semantic theme
 * tokens (`--dsw-alias-*`) appear here so light and dark themes both work;
 * no literal colors.
 *
 * @module dsh-baton/client/styles
 */

const STYLE_ID = 'dsh-baton-styles'
const P = 'dshBaton'

/** CSS class names used by the components. */
export const css = {
  root: `${P}Root`,
  header: `${P}Header`,
  headerTitle: `${P}HeaderTitle`,
  headerChip: `${P}HeaderChip`,
  headerRight: `${P}HeaderRight`,
  banner: `${P}Banner`,
  bannerWarn: `${P}BannerWarn`,
  bannerText: `${P}BannerText`,
  bannerActions: `${P}BannerActions`,
  body: `${P}Body`,
  center: `${P}Center`,
  transcript: `${P}Transcript`,
  transcriptInner: `${P}TranscriptInner`,
  empty: `${P}Empty`,
  row: `${P}Row`,
  avatar: `${P}Avatar`,
  avatarUser: `${P}AvatarUser`,
  avatarAi: `${P}AvatarAi`,
  bubble: `${P}Bubble`,
  streaming: `${P}Streaming`,
  notice: `${P}Notice`,
  toolRow: `${P}ToolRow`,
  card: `${P}Card`,
  cardHead: `${P}CardHead`,
  cardTitle: `${P}CardTitle`,
  cardMeta: `${P}CardMeta`,
  cardSub: `${P}CardSub`,
  cardActions: `${P}CardActions`,
  mono: `${P}Mono`,
  composer: `${P}Composer`,
  composerBox: `${P}ComposerBox`,
  textarea: `${P}Textarea`,
  composerBar: `${P}ComposerBar`,
  composerChips: `${P}ComposerChips`,
  sendButton: `${P}SendButton`,
  side: `${P}Side`,
  sideHead: `${P}SideHead`,
  sideTitle: `${P}SideTitle`,
  filters: `${P}Filters`,
  count: `${P}Count`,
  taskList: `${P}TaskList`,
  task: `${P}Task`,
  taskAccent: `${P}TaskAccent`,
  taskMain: `${P}TaskMain`,
  taskTitle: `${P}TaskTitle`,
  taskMeta: `${P}TaskMeta`,
  taskActions: `${P}TaskActions`,
  status: `${P}Status`,
  error: `${P}Error`,
  menu: `${P}Menu`,
  menuItem: `${P}MenuItem`,
  toastStack: `${P}ToastStack`,
  toast: `${P}Toast`,
  toastTitle: `${P}ToastTitle`,
  toastBody: `${P}ToastBody`,
  icon: `${P}Icon`,
} as const

const SHEET = `
.${css.root}{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.${css.header}{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.${css.headerTitle}{font-weight:600;font-size:15px}
.${css.headerChip}{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary)}
.${css.headerRight}{margin-left:auto;display:flex;gap:8px}
.${css.banner}{display:flex;align-items:center;gap:12px;padding:8px 20px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:13px;flex:none}
.${css.bannerWarn}{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.${css.bannerText}{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${css.bannerActions}{display:flex;gap:6px;flex:none}
.${css.body}{display:flex;flex:1;min-height:0}
.${css.center}{display:flex;flex-direction:column;flex:1;min-width:0}
.${css.transcript}{flex:1;min-height:0;overflow:auto;padding:24px 0}
.${css.transcriptInner}{max-width:760px;margin:0 auto;padding:0 24px;display:flex;flex-direction:column;gap:18px}
.${css.empty}{color:var(--dsw-alias-label-tertiary);text-align:center;padding:48px 0;font-size:14px}
.${css.row}{display:flex;gap:12px;align-items:flex-start}
.${css.avatar}{width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:var(--dsw-alias-label-primary-inverted)}
.${css.avatarUser}{background:var(--dsw-alias-state-business-primary)}
.${css.avatarAi}{background:var(--dsw-alias-brand-primary)}
.${css.bubble}{flex:1;min-width:0;font-size:14px;line-height:1.6;word-break:break-word}
.${css.streaming}::after{content:"▍";opacity:.6;animation:${P}Blink 1s steps(2) infinite}
@keyframes ${P}Blink{50%{opacity:0}}
.${css.notice}{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:4px 12px;border-left:2px solid var(--dsw-alias-border-l2);margin-left:38px}
.${css.toolRow}{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:38px}
.${css.card}{margin-left:38px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px}
.${css.cardHead}{display:flex;align-items:center;gap:8px;font-size:13px}
.${css.cardTitle}{font-weight:600}
.${css.cardMeta}{margin-left:auto}
.${css.cardSub}{font-size:12px;color:var(--dsw-alias-label-secondary)}
.${css.cardActions}{display:flex;gap:6px;margin-top:4px}
.${css.mono}{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;color:var(--dsw-alias-label-secondary)}
.${css.composer}{flex:none;padding:12px 24px 20px}
.${css.composerBox}{max-width:760px;margin:0 auto;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px 10px;display:flex;flex-direction:column;gap:8px}
.${css.composerBox}:focus-within{border-color:var(--dsw-alias-border-l3)}
.${css.textarea}{width:100%;border:0;outline:0;resize:none;background:transparent;color:inherit;font:inherit;font-size:14px;line-height:1.5;min-height:44px;max-height:240px}
.${css.textarea}::placeholder{color:var(--dsw-alias-label-tertiary)}
.${css.composerBar}{display:flex;align-items:center;gap:8px}
.${css.composerChips}{display:flex;gap:6px;flex-wrap:wrap;position:relative}
.${css.sendButton}{margin-left:auto}
.${css.side}{width:340px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-base)}
.${css.sideHead}{padding:14px 16px 8px;display:flex;flex-direction:column;gap:10px;flex:none}
.${css.sideTitle}{display:flex;align-items:center;font-weight:600;font-size:14px}
.${css.sideTitle} > :last-child{margin-left:auto}
.${css.filters}{display:flex;gap:6px;flex-wrap:wrap}
.${css.count}{margin-left:4px;opacity:.7;font-size:11px}
.${css.taskList}{flex:1;min-height:0;overflow:auto;padding:4px 16px 16px;display:flex;flex-direction:column;gap:8px}
.${css.task}{display:flex;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;cursor:pointer}
.${css.task}:hover{background:var(--dsw-alias-interactive-bg-hover)}
.${css.taskAccent}{width:3px;flex:none}
.${css.taskMain}{flex:1;min-width:0;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.${css.taskTitle}{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
.${css.taskTitle} > :last-child{margin-left:auto;flex:none}
.${css.taskMeta}{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--dsw-alias-label-tertiary);min-width:0}
.${css.taskMeta} > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${css.taskActions}{display:flex;gap:6px;margin-top:2px}
.${css.status}{font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap}
.${css.error}{font-size:12px;color:var(--dsw-alias-state-error-primary)}
.${css.menu}{position:absolute;bottom:calc(100% + 6px);left:0;z-index:20;min-width:200px;max-height:260px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-1);padding:4px}
.${css.menuItem}{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;padding:8px 10px;border-radius:6px;cursor:pointer}
.${css.menuItem}:hover{background:var(--dsw-alias-interactive-bg-hover)}
.${css.toastStack}{position:fixed;top:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:1000;pointer-events:none}
.${css.toast}{pointer-events:auto;min-width:260px;max-width:380px;border-radius:10px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-1);cursor:pointer;display:flex;gap:10px;align-items:flex-start}
.${css.toastTitle}{font-weight:600;font-size:13px}
.${css.toastBody}{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${css.icon}{display:inline-flex;align-items:center;justify-content:center}
[data-baton-accent="running"]{background:var(--dsw-alias-state-success-primary)}
[data-baton-accent="needs_input"]{background:var(--dsw-alias-state-warn-primary)}
[data-baton-accent="in_review"]{background:var(--dsw-alias-link)}
[data-baton-accent="failed"]{background:var(--dsw-alias-state-error-primary)}
[data-baton-accent="pending"],[data-baton-accent="completed"],[data-baton-accent="cancelled"]{background:var(--dsw-alias-border-l3)}
`

/** Insert the sheet once per document. */
export function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = SHEET
  document.head.appendChild(style)
}
