export function buildWs (path, opts = {}) {
  const host = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  const candidates = [path, ...(opts.fallbacks || [])]
  let socket = null

  for (const p of candidates) {
    try {
      socket = new WebSocket(host + p)
      socket.addEventListener('message', (ev) => {
        try {
          const payload = JSON.parse(ev.data)
          opts.onMessage && opts.onMessage(payload)
        } catch {
          // ignore non-JSON
        }
      })
      break
    } catch {
      // try next
    }
  }
  if (!socket) socket = new WebSocket(host + path)

  return {
    socket,
    close: () => { if (socket && socket.readyState <= 1) socket.close() }
  }
}
