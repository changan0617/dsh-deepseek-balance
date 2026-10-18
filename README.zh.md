# dsh-deepseek-balance（中文说明）

DeepSeek API 余额与用量浮窗插件：会话界面左下角（默认位置，可拖动）常驻一张半透明卡片，显示账户余额、官方平台当月/今日消耗，以及本机当天的 API 调用与 token 统计。

## 安装

```sh
dsh plugin --profile web add github:changan0617/dsh-deepseek-balance
```

安装后重启 `dsh web`。卸载：

```sh
dsh plugin --profile web remove dsh-deepseek-balance
```

## 密钥优先级

1. 卡片里手动输入的 Key（只留在内存，刷新页面即失效）
2. 凭据服务里的 `DEEPSEEK_API_KEY`
3. 环境变量 `DEEPSEEK_API_KEY`

## 官方平台消耗

官方平台消耗来自 platform.deepseek.com 的私有接口（`/api/v0/usage/cost`、`/api/v0/usage/amount`），需要手动填入平台 `userToken`（浏览器里 `JSON.parse(localStorage.userToken).value`）。API Key 无法访问这些接口；返回 40002/40003 表示 token 过期，重新取一个即可。

## 说明

- 本地用量统计来自 harness 自身的 `llm/stream` 调用，重启后清零，不是 DeepSeek 平台计费数据。
- 官方消耗接口为私有接口，可能随时变更。

## License

MIT © 2026 changan0617
