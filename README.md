# github-latest-release-downloader

把 `/owner/repo/文件名` 重定向到该仓库**最新发行版本**中的同名文件，并额外提供一个可直接浏览
最新发行资源列表的页面。托管在 Cloudflare Workers 上，前端由 Astro 构建。

## 功能

### 1. 永久下载直链（原有功能）

```
https://<你的域名>/<owner>/<repo>/<文件名>
```

访问即 302 跳转到 `https://github.com/<owner>/<repo>/releases/download/<最新 tag>/<文件名>`。

文件名里可以用占位符，访问时会被替换成当前最新发行的实际值，因此链接可以长期复用：

| 占位符      | 替换为                              | 示例（tag 为 `v2.102.1`） |
| ----------- | ----------------------------------- | ------------------------- |
| `{tag}`     | 完整标签                            | `v2.102.1`                |
| `{version}` | 标签中的版本号部分（`[\d.]+` 首个匹配） | `2.102.1`              |

占位符的花括号在 URL 中需要编码，即 `{` → `%7B`、`}` → `%7D`：

```
https://<你的域名>/cli/cli/gh_%7Bversion%7D_linux_386.deb
  → https://github.com/cli/cli/releases/download/v2.102.1/gh_2.102.1_linux_386.deb
```

### 2. 资源列表页（新增）

```
https://<你的域名>/<owner>/<repo>
```

后端实时调用 GitHub API 动态生成页面，列出最新发行的全部 Assets：

- 每个文件名是**超链接**，直接指向 GitHub 上的最终下载地址；
- 文件名中若出现 `{tag}` / `{version}` 字面量，该片段会**高亮标识**，提示此处可被替换；
- 每个文件提供**复制直链**按钮，复制出的地址形如 `/<owner>/<repo>/<文件名>`，即功能 1 的形式，
  始终指向「当前最新发行」中的同名文件。

## 人机验证（Turnstile）

GitHub API 对未认证请求限制为 **60 次/小时/IP**，因此资源列表页由
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)（免费）保护：

- 首次访问列表页 → 展示验证表单 → 通过后签发一枚 **2 小时有效**的 HMAC 签名通行 Cookie（`glrd_pass`）；
- Cookie 有效期内反复浏览列表页不再消耗 Turnstile，也不重复触发验证；
- GitHub API 结果另有 **5 分钟** 的 isolate 内存缓存，进一步压低请求量；
- 未配置 Turnstile 密钥时**自动关闭门禁**，便于本地开发与首次部署。

### 配置

| 名称                   | 类型     | 必填 | 说明                                                        |
| ---------------------- | -------- | ---- | ----------------------------------------------------------- |
| `TURNSTILE_SITE_KEY`   | 明文变量 | 是   | 公开站点密钥，会渲染进页面，无需保密                        |
| `TURNSTILE_SECRET_KEY` | 密钥     | 是   | 服务端校验密钥，缺失时门禁自动关闭                          |
| `PASS_COOKIE_SECRET`   | 密钥     | 否   | 通行 Cookie 签名密钥，缺省回退到 `TURNSTILE_SECRET_KEY`     |
| `GITHUB_TOKEN`         | 密钥     | 否   | 带上后 GitHub API 限额从 60 次/时提升到 **5000 次/时**      |

**明文变量 vs 密钥**：`TURNSTILE_SITE_KEY` 会出现在 HTML 里，本来就是公开的，所以写成
`wrangler.jsonc` 的 `vars`；另外三个是凭证，必须存成加密的 secret。

### 如何获取 Turnstile 的两个密钥

`TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY` 是一对，来自**同一个 Turnstile 小组件（widget）**，
必须成对使用，不能拿 A 站点的 sitekey 配 B 站点的 secret。

1. 登录 Cloudflare 控制台，左侧菜单进 **Turnstile** 页面
   （直达：<https://dash.cloudflare.com/?to=/:account/turnstile>）；
2. 点 **Add widget**，填写：
   - **Widget name**：随便取个能认出的名字，如 `glrd-release-list`；
   - **Hostname management**：**必填，且至少一个**，填你实际访问的域名。三条常见情况：
     - 默认 `workers.dev` 地址 → 填完整的 `<worker名>.<你的账户>.workers.dev`；
     - 绑了自定义域名 → 填该域名，如 `glrd.example.com`（加上后其子域名自动放行）；
     - 本地调试**不用**加 `localhost`——测试密钥在任意域名都可用；只有想用**正式密钥**在
       `localhost` 调试时，才把 `localhost` / `127.0.0.1` 一并加上。
     域名**不必**托管在 Cloudflare，任何 FQDN 都能填；
   - **Widget mode**：选 **Managed**（默认，推荐）。它自动判断风险，多数用户无感通过；
   - **Pre-clearance（「为已验证的访问者跳过将来的安全规则质询」）**：选 **No**，保持关闭。
     它发放的是给 **Cloudflare WAF 防火墙规则**用的 `cf_clearance` 通行证，与本项目无关：
     - 它只能作用在**橙云代理的自有 zone**（即域名已托管在 Cloudflare 且开了代理）。
       `*.workers.dev` 不是你的 zone，没有可配置的 WAF 规则，开了也不会有任何效果；
     - 本项目要「验证过的访客别再被拦」这件事，已经由应用自己签发的 **2 小时 HMAC 通行
       Cookie（`glrd_pass`）** 解决，跟 WAF 无关；GitHub API 限流是业务逻辑，WAF 也管不到；
     - 免费账户还必须为 widget 填至少一个 zone 内的 hostname 才能开，填 `workers.dev` 子域
       属于无效配置，只会让设置变乱。
3. 点 **Create**，页面会显示 **Sitekey** 与 **Secret Key**，两个都要复制走：
   - Sitekey → 填进 `wrangler.jsonc` 的 `vars.TURNSTILE_SITE_KEY`；
   - Secret Key → `npx wrangler secret put TURNSTILE_SECRET_KEY`。

Secret Key **创建后只完整显示一次**，之后只能「Rotate」生成新的（旧密钥立即失效）。丢了就轮换，
别指望还能找回来。轮换会让所有已签发的 `glrd_pass` Cookie 失效（除非单独设了 `PASS_COOKIE_SECRET`）。

也可以完全跳过控制台，用 Wrangler 一条命令建好并直接打印 sitekey 与 secret（`--domain` 同样是必填项）：

```bash
npx wrangler turnstile widget create glrd-release-list \
  --domain <worker名>.<你的账户>.workers.dev --mode managed
```

域名后续可随时在 widget 的 **Settings → Hostname Management → Add Hostnames** 增删，
免费账户每个 widget 上限 10 个（Enterprise 200 个）。

### 本地开发：用官方测试密钥，无需创建站点

Turnstile 提供一对固定的测试密钥，**任意域名都可用，永远通过**，`.dev.vars.example` 里已预填：

| 用途 | 值 |
| --- | --- |
| sitekey | `1x00000000000000000000AA` |
| secret | `1x0000000000000000000000000000000AA` |

测试 sitekey 生成的是固定假 token `XXXX.DUMMY.TOKEN.XXXX`，只有测试 secret 接受它；
**生产 secret 会拒绝假 token**，反之亦然。其他可用的测试密钥：

| sitekey | secret | 行为 |
| --- | --- | --- |
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | 永远通过 |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | 永远失败（测错误分支） |
| `3x00000000000000000000FF` | `1x0000000000000000000000000000000AA` | 强制弹出交互式挑战 |

### `GITHUB_TOKEN` 怎么拿

不是必须，但**强烈建议**：不带 Token 时 GitHub API 按 IP 限 60 次/时，带上后 5000 次/时。

1. 打开 <https://github.com/settings/tokens>（Fine-grained tokens 或 Classic 均可）；
2. 生成一个新 token。**只读公开仓库数据不需要任何 scope**，保持全部勾选为空即可
   （Classic token 一个 scope 都不勾）；
3. 复制 `ghp_...` / `github_pat_...`，然后 `npx wrangler secret put GITHUB_TOKEN`。

Token 只用于读 `releases/latest`，泄露的风险是「别人用你的配额」，不涉及代码读写。

**secret 的两种设置方式，效果等价，任选其一：**

```bash
# 方式 A：命令行（写入后立即生效，不需要重新 deploy）
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put GITHUB_TOKEN          # 可选，但强烈建议
```

```
# 方式 B：Cloudflare 控制台
Workers & Pages → 选中本 Worker → Settings → Variables and Secrets
→ Add → Type 选「Secret」→ 填名称与值 → Deploy
```

两点注意：

1. **明文变量以 `wrangler.jsonc` 为准**。每次 `wrangler deploy` 都会用仓库里的 `vars` 覆盖
   控制台上同名的明文变量；反之 secret 不会被 deploy 覆盖或删除。所以不要把同一个名字既写在
   `wrangler.jsonc` 又指望在控制台改它。
2. `PASS_COOKIE_SECRET` 不填时会回退用 `TURNSTILE_SECRET_KEY` 签名。这意味着**轮换 Turnstile
   密钥会让所有已签发的通行 Cookie 立即失效**（用户需重新验证一次）；若想轮换时不影响在线用户，
   就单独设置一个固定的 `PASS_COOKIE_SECRET`。

## 本地开发

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 已内置 Turnstile「始终通过」测试密钥
pnpm dev                          # = astro build && wrangler dev
```

`.dev.vars` 已被 `.gitignore` 忽略。默认填入的是 Turnstile 官方测试密钥，
因此本地无需任何配置就能走通完整验证流程。

其他脚本：

| 命令            | 作用                          |
| --------------- | ----------------------------- |
| `pnpm build`    | 仅构建（`astro build`）       |
| `pnpm dev`      | 构建后启动 `wrangler dev`     |
| `pnpm deploy`   | 构建后部署到 Cloudflare       |
| `pnpm check`    | 类型/模板检查                 |

## 部署

```bash
pnpm deploy
```

部署前需要：

1. 在 Cloudflare 控制台 → **Turnstile** → **Add widget** 创建一个小组件，拿到 sitekey 与 secret
   （详细步骤见上方「如何获取 Turnstile 的两个密钥」）；
2. 把 sitekey 填进 `wrangler.jsonc` 的 `vars.TURNSTILE_SITE_KEY`（明文，随代码走）；
3. 设置三个密钥——`TURNSTILE_SECRET_KEY` 必填，`PASS_COOKIE_SECRET`、`GITHUB_TOKEN` 可选。
   用 `wrangler secret put` 或控制台的 Variables and Secrets 均可（见上表）。

> `astro build` 会在 `dist/server/wrangler.json` 生成适配器侧的配置，`wrangler deploy`
> 会自动读取并继承根目录 `wrangler.jsonc` 中的 `vars`、`assets` 等设置。

## 技术说明

- **混合渲染**：`astro.config.mjs` 中 `output: "static"`，首页在构建期产出静态 HTML；
  列表页与重定向端点各自声明 `export const prerender = false` 按需渲染。
- **运行时变量**：通过 `import { env } from "cloudflare:workers"` 读取（`Astro.locals.runtime`
  在适配器 v13 起已移除）。
- **降级策略**：重定向端点优先用 GitHub API 精确匹配 Asset 名称；API 不可用（限流/网络异常）时
  退回轻量探测——只读 `releases/latest` 的 302 `Location` 头取标签，再拼下载地址，
  与最初的实现行为一致。
- **适配器入口**：`wrangler.jsonc` 的 `main` 指向 `@astrojs/cloudflare/entrypoints/server`
  （Astro 6+ 起旧的 `dist/_worker.js/index.js` 已废弃）。

## 目录结构

```
src/
├─ pages/
│  ├─ index.astro                      # 静态首页
│  ├─ [owner]/[repo].astro             # 资源列表页（按需渲染 + Turnstile 门禁）
│  ├─ [owner]/[repo]/[filename].js     # 下载直链重定向端点
│  └─ api/verify.js                    # Turnstile 校验 + 签发通行 Cookie
├─ lib/
│  ├─ config.js                        # 运行时配置读取
│  ├─ github-api.js                    # GitHub REST 客户端 + 内存缓存
│  ├─ resolve.js                       # 双路径解析（API 精确匹配 / 轻量探测兜底）
│  ├─ turnstile.js                     # siteverify 调用与错误文案
│  ├─ pass-cookie.js                   # HMAC 通行 Cookie
│  ├─ placeholders.js                  # 占位符定义、替换、分词高亮
│  └─ format.js                        # 体积/数量/日期格式化
├─ layouts/BaseLayout.astro
├─ styles/global.css
└─ github.js                           # 轻量探测（releases/latest 的 Location 头）
```

## 许可

Mozilla Public License 2.0，见 [LICENSE](./LICENSE)。
