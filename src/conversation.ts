import type { ConversationView as CoreView, PublicMessage as CoreMessage } from '@dsh-prism/dsh-orchestrator/contracts'

/** 网页端只接收来源展示字段。 */
export interface PublicMessage extends CoreMessage {
  source?: {channel: string; sender?: string}
}

/** 网页使用的投影视图。 */
export interface ConversationView extends CoreView {
  messages: PublicMessage[]
}
