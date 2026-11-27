import type { ConversationView as CoreView, PublicMessage as CoreMessage } from '@dsh-prism/dsh-orchestrator/contracts'

/** 网页通过宿主鉴权读取本次对话中的附件。 */
export interface MediaAsset {
  assetId: string
  mimeType: string
  name?: string
}

/** 网页端只接收来源展示字段。 */
export interface PublicMessage extends CoreMessage {
  source?: {channel: string; sender?: string}
  attachments?: MediaAsset[]
}

/** 网页使用的投影视图。 */
export interface ConversationView extends CoreView {
  messages: PublicMessage[]
  mediaEnabled?: boolean
}
