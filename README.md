# wb-oidc — C 端 OIDC 统一认证系统

前后端分离的 OIDC Provider，让第三方应用接入你的存量注册用户登录。

- **后端**：NestJS + `oidc-provider`（OpenID 官方认证库）+ PostgreSQL（授权数据）+ 只读连老系统 PostgreSQL 校验存量用户
- **前端**：Vue3 + element-plus — 统一登录页、授权确认页、开发者控制台、PKCE 回调演示页

## 目录结构

```
wb-oidc/
├── backend/                 # NestJS 服务（端口 3000，含前端静态托管）
│   ├── src/
│   │   ├── main.ts              # 入口：挂载 OIDC 中间件 + interaction 路由 + SPA
│   │   ├── config/env.ts        # 环境变量集中校验（启动即失败）
│   │   ├── db/pool.ts           # PG 连接池（adapter / clients 共用）
│   │   ├── oidc/
│   │   │   ├── provider.factory.ts   # oidc-provider 配置（PKCE 默认、RS256、claims）
│   │   │   ├── pg.adapter.ts         # 会话/code/token/grant 持久化到 PG
│   │   │   ├── interaction.routes.ts # 登录/授权页数据与提交端点
│   │   │   └── legacy/legacy-user.service.ts  # 老库用户校验（bcrypt/md5/sha1/...，只读连老系统 PG）
│   │   ├── clients/             # 第三方应用管理（注册/密钥/回调白名单/启停/审核）
│   │   ├── admin/               # 管理员鉴权、账号管理、审计、概览/会话/老库查询
│   │   ├── developer/           # 开发者门户后端（注册/登录/资格申请/应用申请/审核）
│   │   └── health/health.controller.ts
│   └── scripts/
│       ├── seed.mjs             # 建表 + 注册示例应用 + 首个超管
│       ├── verify-legacy.mjs    # 探测老库密码算法
│       └── smoke-all.mjs        # 全链路冒烟（46 项断言）
├── frontend/
│   └── src/
│       ├── views/
│       │   ├── InteractionView.vue      # 统一登录页 / consent 授权页
│       │   ├── ConsoleView.vue          # 管理控制台布局
│       │   ├── console/                 # 概览/应用/用户与开发者/管理员/审计/会话/老库用户
│       │   ├── developer/               # 开发者门户（登录注册/工作台/接入文档）
│       │   ├── LoginView.vue            # 管理员登录
│       │   └── CallbackView.vue         # PKCE 回调演示（code → token → userinfo）
│       └── api/
│           ├── index.ts                 # 管理端 API（内存 token + 静默续期）
│           └── dev.ts                   # 开发者门户 API（独立 token，互不串）
└── docker-compose.yml       # PostgreSQL 5432 + 老库模拟 PG 5433
```

## 快速开始

### 1. 准备数据库

```bash
# 方式一：docker 起 PG（老库模拟实例可选，直连真实老库时不需要）
docker compose up -d

# 方式二：用本地已有的 PostgreSQL，手动建库
psql -U postgres -c "CREATE DATABASE wb_oidc"
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env：PG 账号密码、老系统 PostgreSQL 连接、LEGACY_* 字段映射、改掉两个 please-change-me
```

### 3. 初始化表和示例应用

```bash
cd backend
node scripts/seed.mjs
# 成功后输出示例 client：wb-demo-spa / secret
```

### 3.1 确认老库密码算法（建议先跑一次）

老库密码算法不是猜的，用真实测试账号跑一遍即可确认：

```bash
cd backend
node scripts/verify-legacy.mjs <用户名> <密码>
```

脚本会连老库取该用户记录，依次尝试 HMAC-SHA256/SHA-256/MD5/SHA-1（hex 与 base64 两种输出）和 bcrypt，输出匹配的算法与应写入 `.env` 的配置项。

已实测（moondrop 老库）：

| 项 | 值 |
|---|---|
| 库 | `moondrop-service-test`（与授权库同一 PG 实例） |
| 用户表 | `USER`（大写，PG 需 `"USER"` 引用） |
| 主键 | `uuid`（推荐作为 OIDC `sub`） |
| 密码字段 | `password`，44 位 base64 |
| 算法 | `LEGACY_PASSWORD_HASH=hmac-sha256-b64` + `LEGACY_HMAC_KEY=moondropapp&&` |
| 状态 | `LEGACY_STATUS_FIELD=status`，`LEGACY_STATUS_ACTIVE=1` |
| 头像 | `profilepic` |

### 4. 构建并启动

```bash
# 后端
cd backend && npm install && npm run build
npm run start   # 或 node dist/main.js

# 前端（构建产物由后端静态托管，访问 http://localhost:3000/console）
cd frontend && npm install && npm run build
```

开发模式前端可单独跑 `npm run dev`（Vite，5173），已配代理到后端。

## 接入流程（第三方应用视角）

两条路：**自助门户**（推荐给第三方）或**管理端直接建**（平台内部/联调）。

### A. 开发者门户自助接入

1. 打开 `/developer/login` → **注册（只需邮箱 + 密码）→ 立即可以登录**，此时是普通用户（`developer_status=none`），可浏览首页与接入文档
2. 登录后进入 `/apps` **工作台**，两个模块常显：**用户资料与状态**（账号状态、开发者资格、资料字段、审核进度）+ **我的应用列表**（普通用户为空列表）
3. 点击「新建应用」时才触发资格检测：非开发者弹出**补充开发者信息**表单，填写**公司 / 团队 + 联系方式** → 提交后 `developer_status=pending`；审核中提示进度，被驳回可改资料重提
4. 管理员在控制台「用户与开发者」审核资格：通过 → `approved`；驳回（填理由）→ `rejected`
5. **资格 `approved` 后点「新建应用」才会打开创建表单**：提交名称 / 回调 / scopes → 应用 `pending`，此时无法发起授权
6. 管理员在「应用管理」审核通过 → 应用 `approved`，可正常走 OIDC；修改**回调地址或 scope** → 自动回到 `pending` 重新审核（名称改动不触发）

> 账号状态（能否登录）与开发者资格（能否建应用）是两个独立字段；创建应用时服务端**实时查库**校验资格，不依赖 JWT 里签发的旧状态。应用列表接口不校验资格，普通用户也能正常看到空列表。

### B. 管理端直接注册

登录控制台（`/console`）或调用 `POST /api/admin/clients`（Bearer token），拿到 `client_id`（SPA/PKCE 客户端可不发 secret），应用直接 `approved`。

### C. 发起授权

1. 302 跳转

   ```
   GET /auth?client_id=xxx&response_type=code
      &scope=openid profile&redirect_uri=回调白名单地址
      &code_challenge=<S256>&code_challenge_method=S256&state=随机串
   ```

2. **用户登录 + 授权**：跳到你域名下的统一登录页（`/interaction/:uid`，Vue 页面），用**老系统的账号密码**登录 → consent 页确认 → 发 code。
3. **换 token**：后端用 code 换 `id_token + access_token + refresh_token`。

   ```
   POST /token  grant_type=authorization_code&code=...&client_id=...&code_verifier=...
   ```

4. **拿用户信息**：`GET /userinfo`（Bearer access_token）→ sub / nickname / email / phone / avatar。
5. **演示**：本仓库前端自带完整演示，访问 `http://localhost:3000/callback?start=1` 一键走完 PKCE 流程。

## 管理端登录与 API

管理端不再使用静态 `x-admin-key`，而是**独立管理员表 + 账号密码登录**：

| 表 | 用途 |
|---|---|
| `oidc_admin` | 管理员账号（bcrypt 密码、角色 `super_admin` / `operator`、启停） |
| `oidc_admin_session` | refresh token（只存 SHA-256 哈希，刷新即轮换、可单独吊销） |
| `oidc_admin_log` | 操作审计（谁、何时、哪个 IP、对哪个应用做了什么） |

登录流程：

1. `POST /api/admin/auth/login` `{username,password}` → 返回 15 分钟 `access_token`（前端只放内存）+ `httpOnly` 刷新 cookie（7 天）
2. 之后所有管理请求带 `Authorization: Bearer <access_token>`
3. access token 过期 → 前端自动调 `POST /api/admin/auth/refresh` 续期并重放原请求
4. `POST /api/admin/auth/logout` 吊销刷新令牌
5. `POST /api/admin/auth/change-password` 自助改密码（校验原密码，成功后吊销全部会话）

**改自己的密码**：登录控制台 → 右上角「修改密码」→ 填原密码 + 新密码（至少 10 位、含字母和数字）。改完所有设备都会退出，用新密码重新登录即可。忘记密码则用 `npm run reset-admin -- <用户名>` 重置。

首次使用：

```bash
cd backend
npm run seed                      # 建表 + 示例客户端 + 首个超级管理员
npm run reset-admin -- admin      # 忘记密码时重置，凭据写入 backend/.admin-credentials.txt
npm run smoke:admin -- http://127.0.0.1:3000    # 鉴权链路冒烟（9 项断言）
npm run smoke:password -- http://127.0.0.1:3000 # 改密码链路冒烟（9 项断言，测完自动恢复原密码）
npm run smoke:all -- http://127.0.0.1:3200      # 全链路冒烟：开发者门户 + 审核 + OIDC + 审计/会话/老库（46 项）
```

管理员接口（需 `super_admin`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/auth/me` | 当前登录管理员 |
| POST | `/api/admin/auth/change-password` | 修改**自己**的密码 `{old_password,new_password}` |
| GET | `/api/admin/users` | 管理员列表 |
| POST | `/api/admin/users` | 新建管理员 `{username,password,display_name,role}` |
| PATCH | `/api/admin/users/:id` | 改显示名/角色/启停 |
| POST | `/api/admin/users/:id/reset-password` | 重置**他人**密码（并吊销该账号所有会话） |

应用管理接口（任何已登录管理员）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/clients` | 列表（含申请人邮箱与审核状态） |
| POST | `/api/admin/clients` | 注册应用 `{ client_name, redirect_uris, application_type, scope }` |
| GET | `/api/admin/clients/:clientId` | 详情 |
| PATCH | `/api/admin/clients/:clientId/enabled/:enabled` | 启停 |
| PATCH | `/api/admin/clients/:clientId` | 编辑名称/回调/scope |
| POST | `/api/admin/clients/:clientId/review` | 审核 `{ action: approve\|reject\|suspend, reason }` |
| POST | `/api/admin/clients/:clientId/rotate-secret` | 轮换 secret |
| DELETE | `/api/admin/clients/:clientId` | 删除 |
| GET | `/api/admin/developers` | 用户/开发者列表（按 `status=none\|pending\|approved\|rejected\|suspended` 过滤，仅超管） |
| PATCH | `/api/admin/developers/:id/review` | 审核开发者资格 `{ action: approve\|reject, reason }` |
| PATCH | `/api/admin/developers/:id/status` | 账号启停 `{ status: active\|suspended, reason }` |
| GET | `/api/admin/logs` | 审计日志（page/size/action/username） |
| GET | `/api/admin/overview` | 概览统计（应用/开发者/会话/老库用户数 + 最近操作） |
| GET | `/api/admin/sessions` | OIDC 终端用户会话列表 |
| DELETE | `/api/admin/sessions/:id` | 吊销会话 |
| GET | `/api/admin/legacy-users` | 老库用户只读查询（keyword/page/size，密码脱敏） |

开发者门户接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/developer/auth/register` | 注册 `{ email, password }` → 立即 `active` 可登录，资格 `none` |
| POST | `/api/developer/auth/login` | 登录（仅 `active` 账号，独立 cookie） |
| GET | `/api/developer/auth/me` | 当前用户（含账号状态 / 开发者资格 / 驳回原因 / 申请时间） |
| POST | `/api/developer/apply` | 补充开发者资料 `{ company, contact }` → `pending`（仅 `none` / `rejected` 可提交） |
| GET | `/api/developer/apps` | 我的应用列表（不校验资格，普通用户返回空列表） |
| POST | `/api/developer/apps` | 提交应用申请 → `pending`（**需资格 `approved`**，否则 403） |
| PATCH | `/api/developer/apps/:clientId` | 编辑（改回调/scope 自动回 `pending`） |

全链路冒烟（46 项断言，自带临时超管并在结束后清理数据）：

```bash
cd backend && npm run build
PORT=3200 node dist/main.js &
node scripts/smoke-all.mjs http://localhost:3200
```

## 安全要点（已实现 / 待上线加固）

已实现：
- 默认 `authorization_code + PKCE`，隐式/密码 flow 未开放
- 回调 URL 严格白名单、client 启停开关、secret 轮换
- id_token RS256 签名（jwks 自动发现 `/.well-known/openid-configuration`）
- refresh token 轮换（oidc-provider 内建）
- 老库只读访问，不碰老系统写接口
- 管理端独立账号体系：bcrypt 密码、access token 仅内存持有、refresh token httpOnly + 服务端哈希存储、改密即吊销全部会话、操作审计

上线前还需要：
- [ ] `ISSUER` 换成正式 https 域名；全部走 HTTPS
- [ ] `ADMIN_JWT_SECRET` / `OIDC_COOKIE_SECRET` 换成强随机值（当前已随机生成，仍需按环境隔离），密钥用 KMS 或至少定期轮换
- [ ] `ADMIN_COOKIE_SECURE=true`（https 环境）
- [ ] 登录加图形/短信验证码 + 失败限流（防撞库）
- [ ] 管理员操作审计接入日志平台，保留 ≥ 180 天
- [ ] 老系统若支持改密/注销，补充 back-channel logout
- [ ] PG 数据库备份策略；adapter 表 `expires_at` 清理任务（seed 脚本里带了 SQL）

## 常见问题

- **3000 端口被占用**：改 `.env` 的 `PORT`，同时 `ISSUER` 保持与实际访问域名一致（discovery 端点按请求 Host 动态生成，issuer 决定 token 校验）。
- **登录报「老系统连接失败」**：检查 `LEGACY_DB_*` 与 `LEGACY_USER_TABLE` / 密码哈希算法配置是否与老库一致。
- **第三方换 token 报 invalid_grant**：code 一次性且 10 分钟过期，检查是否重复使用；PKCE verifier 要和 challenge 配对。
