// dsh-deepseek-balance — Host half (balance only).
// - API key resolution priority: manual key (in-memory, POST) > credentials
//   service (DEEPSEEK_API_KEY) > DEEPSEEK_API_KEY environment variable.
// - Serves a JSON endpoint on the harness web server (GET query / POST key).
import { request as httpsRequest } from 'node:https'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

const BALANCE_URL = 'https://api.deepseek.com/user/balance'

let manualKey = ''
let resolvedKey = ''
let keySource = 'none'

function httpsGetJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: 'GET', headers: headers, timeout: timeoutMs }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: body }))
    })
    req.on('timeout', () => { req.destroy(new Error('请求超时')) })
    req.on('error', (err) => { reject(err) })
    req.end()
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

async function fetchBalance() {
  if (resolvedKey.length === 0) {
    return { ok: false, code: 'no-key', message: '未配置 DeepSeek API Key（请手动输入，或在凭据 DEEPSEEK_API_KEY 中配置）' }
  }
  try {
    const res = await httpsGetJson(BALANCE_URL, { Authorization: 'Bearer ' + resolvedKey, Accept: 'application/json' }, 20000)
    let parsed = null
    try { parsed = JSON.parse(res.body) } catch (err) { parsed = null }
    if (parsed !== null && parsed.error !== undefined && parsed.error !== null) {
      return { ok: false, code: 'api-error', message: String(parsed.error.message || 'API 返回错误') }
    }
    if (parsed !== null && Array.isArray(parsed.balance_infos)) {
      return {
        ok: true,
        available: parsed.is_available === true,
        infos: parsed.balance_infos.map((info) => ({
          currency: String(info.currency || ''),
          total: String(info.total_balance != null ? info.total_balance : ''),
          granted: String(info.granted_balance != null ? info.granted_balance : ''),
          topped: String(info.topped_up_balance != null ? info.topped_up_balance : ''),
        })),
        fetchedAt: Date.now(),
      }
    }
    return { ok: false, code: 'bad-response', message: 'HTTP ' + String(res.status) + '：响应无法解析' + (res.body ? '：' + res.body.trim().slice(0, 200) : '') }
  } catch (err) {
    return { ok: false, code: 'network-error', message: String((err && err.message) || err) }
  }
}

export const inject = ['webServer', 'credentials']

export const apply = (ctx) => {
  const credentials = ctx.get('credentials')
  const webServer = ctx.get('webServer')
  if (credentials === undefined || webServer === undefined) {
    ctx.logger?.('dsh-deepseek-balance').warn('dsh-deepseek-balance: host services (credentials / webServer) are absent — the floating card stays empty')
    return
  }

  // Priority: manual (in-memory) > credential (DEEPSEEK_API_KEY) > env var.
  async function resolveKey() {
    if (manualKey.length > 0) {
      resolvedKey = manualKey
      keySource = 'manual'
      return
    }
    if (credentials !== undefined) {
      try {
        const cred = await credentials.resolve(credentialRef('DEEPSEEK_API_KEY'))
        if (cred !== undefined && cred.value.length > 0) {
          resolvedKey = cred.value.trim()
          keySource = 'credential'
          return
        }
      } catch (err) { /* fall through to env */ }
    }
    if (typeof process !== 'undefined' && process.env && typeof process.env.DEEPSEEK_API_KEY === 'string' && process.env.DEEPSEEK_API_KEY.length > 0) {
      resolvedKey = process.env.DEEPSEEK_API_KEY.trim()
      keySource = 'env'
      return
    }
    resolvedKey = ''
    keySource = 'none'
  }

  // JSON endpoint for the client card.
  //   GET  → { balance } with balance.keySource ('manual'|'credential'|'env'|'none')
  //   POST → { key }  sets/replaces the in-memory manual key ('' clears it)
  ctx.effect(() => webServer.register({
    path: '/api/dsh-deepseek-balance',
    handler: async (req, res) => {
      try {
        if (req.method === 'POST') {
          const raw = await readBody(req)
          let key = ''
          try {
            const parsed = JSON.parse(raw)
            if (parsed !== null && typeof parsed === 'object' && typeof parsed.key === 'string') key = parsed.key.trim()
          } catch (err) { /* empty key */ }
          manualKey = key
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: true, manual: manualKey.length > 0 }))
          return
        }
        await resolveKey()
        const balance = await fetchBalance()
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ balance: Object.assign(balance, { keySource: keySource }) }))
      } catch (err) {
        try {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: String((err && err.message) || err) }))
        } catch (err2) { /* response already sent */ }
      }
    },
  }))
}
