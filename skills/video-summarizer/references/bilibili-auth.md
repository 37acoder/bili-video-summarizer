# B站登录：二维码、外部 Cookie 或 Browser

所有命令均为 `node "/absolute/skill/scripts/video.mjs" …`。实际读取的是登录 Cookie **SESSDATA**，不是 `bili_jct`（CSRF token）、DedeUserID、二维码 key 或 API access token。保留 Cookie 的原始编码值，不反复 URL 编解码。CLI 使用单个账号；库 API 的逗号分隔账号池不适用于此 CLI。

凭据读取优先级：`BILIBILI_SESSION_TOKEN` → `--auth-file` → `~/.config/video-summarizer/bilibili.json`。`auth import/poll` 写文件，环境变量不会被替换；旧环境变量会遮蔽新文件，必要时 unset。凭据只发送给 B站 API，字幕 CDN 请求不携带 Cookie。不要在聊天、日志、git 或命令行参数中粘贴凭据。

## A. 命令行二维码（首选）

```sh
node "/absolute/skill/scripts/video.mjs" auth login --out '/absolute/new-private-login-directory'
```

返回 `qrFile`（PNG）和 `stateFile`。向用户展示本地 PNG，或在支持附件的宿主中发送该图；由用户使用 B站 App 扫描并确认。二维码是临时登录凭据，不交给第三方图片/二维码网站。

```sh
node "/absolute/skill/scripts/video.mjs" auth poll --state '/absolute/new-private-login-directory/login.json'
# 终端用户可选择连续轮询，最长约 180 秒：
node "/absolute/skill/scripts/video.mjs" auth poll --state '/absolute/new-private-login-directory/login.json' --wait
```

Agent 优先单次 poll 配合宿主等待能力，让用户有时间扫码；不要忙轮询。状态：`waiting_for_scan` → `waiting_for_confirmation` → `authenticated`。过期报 `QR_EXPIRED`，在新目录重新生成并展示。成功响应取 Set-Cookie 中的 SESSDATA，调用 `/x/web-interface/nav` 验证 `isLogin=true` 后才原子保存为 0600 权限文件，随后删除临时二维码和 key。失败、过期或用户取消后可删除本次专用登录目录，不影响已有登录。没有实现长期自动刷新，失效时重新登录。

## B. 导入现有 session

让用户在已登录的 B站网页按 F12：Application/应用 → Storage/存储 → Cookies → `https://www.bilibili.com` → **SESSDATA**，复制 Value 到本机私有文件。Firefox 对应 Storage/存储检查器。HttpOnly Cookie 不可通过 `document.cookie` 可靠获取。也可导出 B站域下 Netscape cookies.txt、浏览器 cookie JSON 数组或 Playwright `{cookies:[…]}` storage state。

```sh
chmod 600 '/absolute/private-cookie.txt'
node "/absolute/skill/scripts/video.mjs" auth import --file '/absolute/private-cookie.txt'
node "/absolute/skill/scripts/video.mjs" auth status
```

导入还支持 `{ "SESSDATA": "…" }`、原始 SESSDATA 值、含 `SESSDATA=…` 的 Cookie header；只保存 SESSDATA。`--file -` 可从 stdin 输入；交互输入可用 shell 的隐藏读取而非写在 shell history：

```sh
# bash/zsh
read -rs BILIBILI_SESSION_TOKEN
export BILIBILI_SESSION_TOKEN
node "/absolute/skill/scripts/video.mjs" auth status
unset BILIBILI_SESSION_TOKEN
```

## C. 使用 Agent 的 Browser

用宿主提供的 Browser 打开 `https://www.bilibili.com`，让用户完成登录。仅在该 Browser 具备授权的 cookie/storage-state 导出 API 时将 B站 Cookie 写入本机私有文件，然后走 B 的 import/status。阅读 Browser 工具实际文档，不猜测不存在的 API；不要声称打开登录页就已经拿到 session。若工具不能导出 HttpOnly Cookie，让用户按 B 导出或改走 A。不读取浏览器其他域的 cookie，不用 OS 密钥库或未授权的浏览器配置文件绕过权限。

## 诊断与协议依据

`AUTH_REQUIRED` 表示缺凭据；`AUTH_INVALID` 表示 nav 未确认有效登录；HTTP 412/风控、网络错误需要稍后重试或使用正常浏览器，不绕过验证。有效账号仍可能没有某个视频的字幕权限。全流程扫码完成必须由真实用户确认；离线模拟无法证明账号已登录。

实现使用 B站 Web passport 的 `/x/passport-login/web/qrcode/generate` 和 `/poll`。它们是网站接口，可能变化，不是稳定的开放平台合约。可对照 [扫码协议记录](https://github.com/pskdje/bilibili-API-collect/blob/main/docs/login/login_action/QR.md) 并以现场响应验证；状态码 86101 等待、86090 待确认、86038 过期、0 成功。
