# dsh-deepseek-balance

Persistent DeepSeek API balance & usage plugin for the web profile.

## What it does

- Registers a floating card on `shell.overlay` (top-right, draggable, collapsible).
- Shows the DeepSeek account balance (total / granted / topped-up), refreshed every 60 s.
- Shows **official platform consumption** (current-month cost, today's cost, month tokens)
  from the private dashboard endpoints `platform.deepseek.com/api/v0/usage/cost` and
  `.../usage/amount?month=<M>&year=<Y>`, authenticated with the platform `userToken`
  (from the browser: `JSON.parse(localStorage.userToken).value`). API keys cannot access
  these endpoints. Codes 40002/40003 mean the token expired — re-fetch it.
- Shows today's local usage: API request count, input/output tokens, cache hits
  (measured from the harness's own `llm/stream` calls; not platform billing data).
- API key resolution priority: manual key (typed in the card, in-memory) > credentials
  service `DEEPSEEK_API_KEY` > `DEEPSEEK_API_KEY` environment variable.
  The platform userToken is entered manually in the card and kept in memory only.

## Layout

- `package.json` — declares `dsh.client` (web bundle) + `./client` export.
- `lib/index.js` — host half: `llm/stream` usage counter, HTTPS balance query,
  `/api/dsh-deepseek-balance` JSON route on the harness web server.
- `lib/client.js` — web bundle (plain `__ModuleLoader__` format, no build step):
  the floating card UI.

## Install

Installed by hand at `~/.dsh/profiles/node_modules/dsh-deepseek-balance` and wired into
the profile composition via `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: deepseek-balance
      name: dsh-deepseek-balance
```

Takes effect on the next harness start. To remove, delete the insert entry and the
package directory.

## Notes

- Official consumption comes from the private dashboard endpoints, which are unofficial
  and may change without notice; they require a fresh platform `userToken`.
- Local usage stats are counted from the harness's own model calls and reset on restart;
  they are not DeepSeek platform billing data.
