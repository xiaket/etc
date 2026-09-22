/**
 * Product copy for the workbench panel, in the two built-in locales.
 *
 * @module dsh-baton/client/locales
 */

/** Every copy key the panel reads. */
export type BatonKey =
  | 'panel.label'
  | 'header.title'
  | 'header.repos'
  | 'header.running'
  | 'banner.needsInput'
  | 'banner.needsInput.detail'
  | 'banner.kind.approval'
  | 'banner.kind.question'
  | 'banner.go'
  | 'banner.commanderWaiting'
  | 'banner.openFull'
  | 'connection.connecting'
  | 'connection.reconnecting'
  | 'commander.starting'
  | 'commander.failed'
  | 'commander.retry'
  | 'transcript.empty'
  | 'transcript.notice'
  | 'transcript.toolFailed'
  | 'dispatch.card'
  | 'dispatch.failed'
  | 'dispatch.open'
  | 'tasks.title'
  | 'tasks.empty'
  | 'tasks.filter.all'
  | 'tasks.filter.running'
  | 'tasks.filter.needs_input'
  | 'tasks.filter.in_review'
  | 'tasks.filter.failed'
  | 'tasks.sort'
  | 'tasks.sort.status'
  | 'tasks.sort.recent'
  | 'tasks.ack'
  | 'tasks.cancel'
  | 'tasks.open'
  | 'tasks.isolation.shared'
  | 'status.pending'
  | 'status.running'
  | 'status.needs_input'
  | 'status.in_review'
  | 'status.completed'
  | 'status.failed'
  | 'status.cancelled'
  | 'time.justNow'
  | 'time.minutes'
  | 'time.hours'
  | 'time.days'
  | 'composer.placeholder'
  | 'composer.send'
  | 'composer.stop'
  | 'composer.pickRepo'
  | 'composer.pickRepo.clear'
  | 'composer.researchOnly'
  | 'composer.researchOnly.suffix'
  | 'composer.pickRepo.prefix'
  | 'toast.in_review'
  | 'toast.failed'
  | 'markdown.copy'
  | 'markdown.copied'
  | 'markdown.footnotes'

/** One locale's dictionary. */
export type BatonDict = Record<BatonKey, string>

export const zh: BatonDict = {
  'panel.label': '代码工作台',
  'header.title': '代码工作台',
  'header.repos': '{count} 个已连接仓库',
  'header.running': '{count} 个任务运行中',
  'banner.needsInput': '{count} 个任务需要你处理',
  'banner.needsInput.detail': '{title} · {kind}',
  'banner.kind.approval': '等待审批',
  'banner.kind.question': '等待回答',
  'banner.go': '去处理',
  'banner.commanderWaiting': '指挥者在等你确认',
  'banner.openFull': '打开完整会话',
  'connection.connecting': '正在连接…',
  'connection.reconnecting': '连接中断，正在重试…',
  'commander.starting': '正在启动指挥者…',
  'commander.failed': '指挥者启动失败：{error}',
  'commander.retry': '重试',
  'transcript.empty': '描述你想做的事，我会自己找到相关仓库并开始调研。',
  'transcript.notice': '通知',
  'transcript.toolFailed': '失败',
  'dispatch.card': '任务',
  'dispatch.failed': '分派失败',
  'dispatch.open': '打开会话',
  'tasks.title': '进行中的任务',
  'tasks.empty': '还没有任务',
  'tasks.filter.all': '全部',
  'tasks.filter.running': '运行中',
  'tasks.filter.needs_input': '待输入',
  'tasks.filter.in_review': '待review',
  'tasks.filter.failed': '失败',
  'tasks.sort': '排序',
  'tasks.sort.status': '按状态',
  'tasks.sort.recent': '按时间',
  'tasks.ack': '确认',
  'tasks.cancel': '取消',
  'tasks.open': '打开会话',
  'tasks.isolation.shared': '未隔离',
  'status.pending': '待启动',
  'status.running': '运行中',
  'status.needs_input': '待输入',
  'status.in_review': '待review',
  'status.completed': '已完成',
  'status.failed': '失败',
  'status.cancelled': '已取消',
  'time.justNow': '刚刚',
  'time.minutes': '{n} 分钟',
  'time.hours': '{n} 小时',
  'time.days': '{n} 天',
  'composer.placeholder': '描述你想做的事，我会自己找到相关仓库并开始调研',
  'composer.send': '发送',
  'composer.stop': '停止',
  'composer.pickRepo': '指定仓库',
  'composer.pickRepo.clear': '不指定',
  'composer.researchOnly': '只调研，不改代码',
  'composer.researchOnly.suffix': '\n\n只调研，不改代码',
  'composer.pickRepo.prefix': '在 {title} 里：',
  'toast.in_review': '任务完成，等待你审阅：{title}',
  'toast.failed': '任务失败：{title}',
  'markdown.copy': '复制',
  'markdown.copied': '已复制',
  'markdown.footnotes': '脚注',
}

export const en: BatonDict = {
  'panel.label': 'Workbench',
  'header.title': 'Workbench',
  'header.repos': '{count} repos connected',
  'header.running': '{count} tasks running',
  'banner.needsInput': '{count} tasks need you',
  'banner.needsInput.detail': '{title} · {kind}',
  'banner.kind.approval': 'awaiting approval',
  'banner.kind.question': 'awaiting an answer',
  'banner.go': 'Handle it',
  'banner.commanderWaiting': 'The commander is waiting for your confirmation',
  'banner.openFull': 'Open full session',
  'connection.connecting': 'Connecting…',
  'connection.reconnecting': 'Connection lost, retrying…',
  'commander.starting': 'Starting the commander…',
  'commander.failed': 'Commander failed to start: {error}',
  'commander.retry': 'Retry',
  'transcript.empty': 'Describe what you want done; I will find the right repos and start investigating.',
  'transcript.notice': 'Notice',
  'transcript.toolFailed': 'failed',
  'dispatch.card': 'Task',
  'dispatch.failed': 'Dispatch failed',
  'dispatch.open': 'Open session',
  'tasks.title': 'Tasks',
  'tasks.empty': 'No tasks yet',
  'tasks.filter.all': 'All',
  'tasks.filter.running': 'Running',
  'tasks.filter.needs_input': 'Needs input',
  'tasks.filter.in_review': 'In review',
  'tasks.filter.failed': 'Failed',
  'tasks.sort': 'Sort',
  'tasks.sort.status': 'By status',
  'tasks.sort.recent': 'By time',
  'tasks.ack': 'Confirm',
  'tasks.cancel': 'Cancel',
  'tasks.open': 'Open session',
  'tasks.isolation.shared': 'not isolated',
  'status.pending': 'Pending',
  'status.running': 'Running',
  'status.needs_input': 'Needs input',
  'status.in_review': 'In review',
  'status.completed': 'Completed',
  'status.failed': 'Failed',
  'status.cancelled': 'Cancelled',
  'time.justNow': 'just now',
  'time.minutes': '{n} min',
  'time.hours': '{n} h',
  'time.days': '{n} d',
  'composer.placeholder': 'Describe what you want done; I will find the right repos and start investigating',
  'composer.send': 'Send',
  'composer.stop': 'Stop',
  'composer.pickRepo': 'Pick repo',
  'composer.pickRepo.clear': 'Any repo',
  'composer.researchOnly': 'Research only, no code changes',
  'composer.researchOnly.suffix': '\n\nResearch only; do not change any code.',
  'composer.pickRepo.prefix': 'In {title}: ',
  'toast.in_review': 'Task finished, awaiting your review: {title}',
  'toast.failed': 'Task failed: {title}',
  'markdown.copy': 'Copy',
  'markdown.copied': 'Copied',
  'markdown.footnotes': 'Footnotes',
}

/** Locale namespace registered with `ctx.locale`. */
export const NS = 'baton'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench panel copy. */
    baton: BatonKey
  }
}
