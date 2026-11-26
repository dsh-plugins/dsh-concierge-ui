import type { PublicMessage } from '@dsh-prism/dsh-orchestrator/contracts'

/** Older hosts omit deliveryError; unknown failure details stay on the host. */
export function missingReply(message: PublicMessage): boolean {
  return message.role === 'user' && message.delivery === 'failed' &&
    'deliveryError' in message && message.deliveryError === 'no_response'
}
