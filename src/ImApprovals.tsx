import { useEffect, useRef, useState } from 'react'
import { admin, AdminError, type Channel } from './im-admin.js'
import type { ImCopy } from './im-copy.js'
import { ui } from './im-style.js'

interface Approval {
  id: string
  channel: Channel
  username?: string
  userId: string
}

export function ImApprovals({ copy }: {copy: ImCopy}) {
  const text = copy.approvals
  const [approvals, setApprovals] = useState<Approval[]>()
  const [pollError, setPollError] = useState('')
  const [actionError, setActionError] = useState('')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const poll = useRef<AbortController>()
  const action = useRef<AbortController>()

  useEffect(() => () => action.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    poll.current = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    async function read() {
      try {
        const result = await admin<{approvals: Approval[]}>(undefined, controller.signal)
        if (!Array.isArray(result.approvals)) {
          throw new Error('Missing IM approvals')
        }
        if (!controller.signal.aborted) {
          setApprovals(result.approvals)
          setPollError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setPollError(failure instanceof AdminError && failure.code === 'forbidden' ? copy.forbidden : copy.noGateway)
        }
      } finally {
        if (!controller.signal.aborted) {
          timer = setTimeout(() => void read(), 4000)
        }
      }
    }
    void read()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [copy, version])

  function refresh() {
    poll.current?.abort()
    setVersion(current => current + 1)
  }

  async function decide(id: string, decision: 'approve' | 'reject') {
    if (action.current) {
      return
    }
    const controller = new AbortController()
    action.current = controller
    setBusy(true)
    setActionError('')
    try {
      const result = await admin<{ok: true}>({op: 'decideApproval', id, decision}, controller.signal)
      if (result.ok !== true) {
        throw new Error('Missing IM approval result')
      }
      if (!controller.signal.aborted) {
        setApprovals(current => current?.filter(approval => approval.id !== id))
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setActionError(failure instanceof AdminError && failure.code === 'forbidden' ? copy.forbidden : copy.error)
      }
    } finally {
      if (!controller.signal.aborted) {
        action.current = undefined
        setBusy(false)
        refresh()
      }
    }
  }

  return <section data-prism-approvals="" style={ui.stack}>
    <div style={{...ui.row, justifyContent: 'space-between'}}>
      <h3 style={{margin: 0}}>{text.title}</h3>
      <button type="button" style={ui.button} onClick={refresh}>{text.refresh}</button>
    </div>
    {approvals?.length === 0 && <p style={{margin: 0}}>{text.empty}</p>}
    {approvals?.map(({id, channel, username, userId}) => <article key={id} data-prism-approval="" style={ui.panel}>
      <div style={ui.row}><strong>{copy.names[channel]}</strong><span>{username || text.unnamed}</span></div>
      <div style={{overflowWrap: 'anywhere'}}>{text.userId} <code>{userId}</code></div>
      <div style={ui.row}>
        <button type="button" style={ui.button} disabled={busy} onClick={() => void decide(id, 'approve')}>{text.approve}</button>
        <button type="button" style={ui.button} disabled={busy} onClick={() => void decide(id, 'reject')}>{text.reject}</button>
      </div>
    </article>)}
    {pollError && <p role="alert" style={{margin: 0}}>{pollError}</p>}
    {actionError && <p role="alert" style={{margin: 0}}>{actionError}</p>}
  </section>
}
