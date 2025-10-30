## DeepWide Research 技术架构方案（v1）

更新时间：2025-10-25

### 目标与范围
- 实现登录（Google、Microsoft/Outlook、邮箱）、用户与订阅管理、基于用量的计费（credits），并与现有聊天/研究引擎无缝集成。
- 兼顾可审计、可扩展、可回滚的计量与结算方案；保证并发安全与幂等。
- 最小化自管组件数量：保留现有前端（Next.js）与后端（FastAPI），将身份/数据/策略交给 Supabase，支付交给 Stripe。

---

## 1. 总体架构

- 前端 `chat_interface`（Next.js App Router）
  - 使用 Supabase Auth Helpers 获取会话与 access token
  - 所有调用后端 API 时在 `Authorization: Bearer <access_token>` 头中透传 token
  - 直接通过 Supabase JS SDK 读写对话历史（受 RLS 保护）
  - 承接支付：创建 Stripe Checkout/Portal，会接收支付成功/订阅更新 Webhook（可选放在 Next.js Route 或 Supabase Edge Function）

- 后端 `deep_wide_research`（FastAPI）
  - 保持无状态；在入口中校验 Supabase JWT（JWKS 验签），提取 `user_id`
  - 支持 API Key 调用：校验 `Authorization: ApiKey dwr_<prefix>_<secret>` 或 `X-API-Key`，将调用归属到对应 `user_id`
  - 执行研究引擎（现有 `/api/research` 流式接口）
  - 与 Supabase 交互以扣减/发放 credits（调用数据库存储过程，原子事务，含幂等）

- 平台 `Supabase`
  - Auth（Google、Microsoft、Email/SMTP）
  - Postgres（表、视图、存储过程、触发器、RLS）
  - 可选 Edge Functions（承接 Stripe Webhook、周期任务）

- 支付 `Stripe`
  - 订阅与一次性充值
  - Webhook 更新 `subscriptions`，并在周期开始/支付成功时发放 credits

- 支付 `Polar`（Plus 月订阅）
  - Plus 档位（$15/月）
  - 前端跳转 Polar 托管 Checkout，或服务端用 TS SDK 动态创建 Checkout 会话
  - Webhook 成功事件触发每月发放固定 credits（幂等）

部署拓扑建议：
- `chat_interface` → Vercel（域名如 `app.example.com`）
- `deep_wide_research` → Railway/Render/Fly（域名如 `api.example.com`）
- `Supabase` 托管

---

## 2. 组件职责与边界

### 前端（Next.js）
- 登录/登出、会话保持、路由守卫（受保护页面）
- 对话 UI；通过 Supabase SDK 读写 `threads`、`messages`
- 每次请求后端研究接口时，附带 Supabase access token
- 显示余额与套餐；引导升级/续费
- 创建 Stripe Checkout/Portal；监听 Webhook 更新 UI 状态

### 后端（FastAPI）
- 校验 JWT（Supabase JWKS）并获取 `user_id`
- 在研究请求完成后按实际用量扣费（方案A，后结算）
  - 可选预授权冻结（方案B，先扣后退），初期不启用
- 将每次用量写入 `credit_ledger`，以 `request_id` 保证幂等
- 不存储业务数据（如消息），仅负责计算与计量

### Supabase（Auth + DB）
- OAuth/Email 登录
- 表、视图、存储过程与 RLS：
  - `profiles`：用户档案
  - `credit_ledger`：只追加事件账本
  - `credit_balance` 视图：聚合余额
  - `subscriptions`：订阅状态
  - `threads`、`messages`：聊天历史
- 触发器：用户创建时初始化 `profiles` 并可发放新手额度

### Stripe（支付）
- 订阅/计费周期；Webhook 推送事件
- Webhook 更新 `subscriptions`，并在支付成功/周期开始时发放 credits（正向 `delta`）

### Polar（支付）
- Plus 档：$15/月；仅做“订阅→发放 credits”的极简流程
- 事件来源：Polar Webhook（订阅创建/续费/发票已支付）
- 后端：验签 → 识别 `user_id`（优先用 `metadata.user_id`，否则按邮箱匹配）→ `sp_grant_credits`
- 可选：同步 `subscriptions` 状态与 `current_period_end`

---

## 3. 数据模型（最小可用集）

注意：以下 SQL 为设计原型，建议作为一次迁移脚本执行（在 Supabase SQL Editor 中）。

```sql
-- 1) 用户档案
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','plus','pro','team')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 订阅表
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  status text not null,
  seat_type text not null default 'individual',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

-- 3) 额度事件账本（只追加）
create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null, -- 正数发放，负数扣减（单位：credits）
  request_id text not null,
  constraint credit_ledger_request_id_unique unique (user_id, request_id),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_ledger_user_time on public.credit_ledger (user_id, created_at desc);

-- 3.1) API Keys（用户自助生成、可吊销）
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'default',
  prefix text not null,              -- 明文前缀（用于快速定位）
  salt text not null,                -- 服务器端盐
  secret_hash text not null,         -- secret 的哈希（salt+secret -> sha256）
  secret_plain text,                 -- 明文完整 API Key（按产品需求持久化）
  scopes text[] not null default array['research:invoke']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_keys_prefix_unique unique (prefix)
);
create index if not exists idx_api_keys_user on public.api_keys (user_id, created_at desc);

-- 4) 余额视图（由账本聚合）
create or replace view public.credit_balance as
select user_id, coalesce(sum(delta), 0) as balance
from public.credit_ledger
group by user_id;

-- 5) 对话数据
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_threads_user on public.threads (user_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_thread_time on public.messages (thread_id, created_at asc);


alter table public.profiles enable row level security;
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select
  using (user_id = auth.uid());

alter table public.subscriptions enable row level security;
drop policy if exists subs_self_read on public.subscriptions;
create policy subs_self_read on public.subscriptions
  for select
  using (user_id = auth.uid());

alter table public.credit_ledger enable row level security;
drop policy if exists ledger_self_read on public.credit_ledger;
create policy ledger_self_read on public.credit_ledger
  for select
  using (user_id = auth.uid());

alter table public.threads enable row level security;
drop policy if exists threads_self_rw on public.threads;
create policy threads_self_rw on public.threads
  for select
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.messages enable row level security;
drop policy if exists messages_self_rw on public.messages;
create policy messages_self_rw on public.messages
  for select
  using (exists (
    select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid()
  ))
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

-- RLS
-- 启用扩展（如未启用）
create extension if not exists pgcrypto;

-- profiles
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (user_id = auth.uid());

-- subscriptions
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select
  using (user_id = auth.uid());

-- credit_ledger
alter table public.credit_ledger enable row level security;
drop policy if exists credit_ledger_select on public.credit_ledger;
create policy credit_ledger_select on public.credit_ledger
  for select
  using (user_id = auth.uid());

-- api_keys（仅本人可读；写操作通过 Service Key 或安全的 RPC）
alter table public.api_keys enable row level security;
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys
  for select
  using (user_id = auth.uid());

-- threads
alter table public.threads enable row level security;
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads
  for select
  using (user_id = auth.uid());

drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert
  with check (user_id = auth.uid());

drop policy if exists threads_update on public.threads;
create policy threads_update on public.threads
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists threads_delete on public.threads;
create policy threads_delete on public.threads
  for delete
  using (user_id = auth.uid());

-- messages
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );


-- 7) 存储过程（扣费/发放，幂等 + 并发安全）
create or replace function public.sp_consume_credits(
  p_user_id uuid,
  p_units integer,
  p_request_id text,
  p_meta jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
as $$
declare
  v_balance integer;
begin
  if p_units <= 0 then
    raise exception 'p_units must be positive';
  end if;

  -- 对用户行加锁，串行化同一用户的扣费
  perform 1 from public.profiles where user_id = p_user_id for update;

  select coalesce(sum(delta),0) into v_balance from public.credit_ledger where user_id = p_user_id;
  if v_balance < p_units then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_ledger (user_id, delta, request_id, meta)
  values (p_user_id, -p_units, p_request_id, coalesce(p_meta, '{}'::jsonb));

  select coalesce(sum(delta),0) into v_balance from public.credit_ledger where user_id = p_user_id;
  return v_balance;

exception when unique_violation then
  -- 幂等：重复 request_id 返回当前余额
  select coalesce(sum(delta),0) into v_balance from public.credit_ledger where user_id = p_user_id;
  return v_balance;
end;
$$;

create or replace function public.sp_grant_credits(
  p_user_id uuid,
  p_units integer,
  p_request_id text,
  p_meta jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
as $$
declare
  v_balance integer;
begin
  if p_units <= 0 then
    raise exception 'p_units must be positive';
  end if;
  begin
    insert into public.credit_ledger (user_id, delta, request_id, meta)
    values (p_user_id, p_units, p_request_id, coalesce(p_meta, '{}'::jsonb));
  exception when unique_violation then
    -- 幂等
    null;
  end;
  select coalesce(sum(delta),0) into v_balance from public.credit_ledger where user_id = p_user_id;
  return v_balance;
end;
$$;

-- 8) 新用户初始化（触发器）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email);
  -- 可选：赠送新手额度
  insert into public.credit_ledger (user_id, delta, request_id, meta)
  values (new.id, 100, 'welcome_' || new.id::text, jsonb_build_object('reason','welcome_bonus'))
  on conflict (request_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 3A. 一次性完整初始化脚本（推荐执行）

以下脚本为经过修订的可重复执行的一次性初始化脚本，已包含表/索引/视图、RLS、存储过程与触发器。建议在 Supabase SQL Editor 直接整段执行。

```sql
-- ------------------------------------------------------------
-- DeepWide Research - Supabase 初始化脚本（一次性执行版）
-- 功能：表/索引/视图、RLS 策略、存储过程、触发器
-- 兼容：可重复执行（幂等）
-- 依赖：pgcrypto（用于 gen_random_uuid）
-- ------------------------------------------------------------

-- 扩展
create extension if not exists pgcrypto;

-- =========================
-- 1) 数据表与索引
-- =========================

-- 用户档案
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','plus','pro','team')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 订阅
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'stripe',
  status text not null,
  seat_type text not null default 'individual',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

-- 额度事件账本（只追加）
create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null, -- 正数发放，负数扣减（单位：credits）
  request_id text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_ledger_request_id_unique unique (user_id, request_id)
);
create index if not exists idx_credit_ledger_user_time on public.credit_ledger (user_id, created_at desc);

-- 余额视图（由账本聚合）
create or replace view public.credit_balance as
select user_id, coalesce(sum(delta), 0) as balance
from public.credit_ledger
group by user_id;

-- 对话线程
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_threads_user on public.threads (user_id, created_at desc);

-- 对话消息
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_thread_time on public.messages (thread_id, created_at asc);

-- API Keys（用户自助生成、可吊销）
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'default',
  prefix text not null,
  salt text not null,
  secret_hash text not null,
  scopes text[] not null default array['research:invoke']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_keys_prefix_unique unique (prefix)
);
create index if not exists idx_api_keys_user on public.api_keys (user_id, created_at desc);

-- =========================
-- 2) RLS 策略（分离各命令；SELECT/INSERT/UPDATE/DELETE）
-- =========================

-- profiles（仅本人可读；写操作仅限 service role/存储过程）
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (user_id = auth.uid());

-- subscriptions（仅本人可读）
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select
  using (user_id = auth.uid());

-- credit_ledger（仅本人可读；写通过存储过程/服务角色）
alter table public.credit_ledger enable row level security;
drop policy if exists credit_ledger_select on public.credit_ledger;
create policy credit_ledger_select on public.credit_ledger
  for select
  using (user_id = auth.uid());

-- api_keys
alter table public.api_keys enable row level security;
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys
  for select
  using (user_id = auth.uid());

-- threads（本人读写删；写时校验归属）
alter table public.threads enable row level security;
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads
  for select
  using (user_id = auth.uid());

drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert
  with check (user_id = auth.uid());

drop policy if exists threads_update on public.threads;
create policy threads_update on public.threads
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists threads_delete on public.threads;
create policy threads_delete on public.threads
  for delete
  using (user_id = auth.uid());

-- messages（必须属于本人线程；写时要求 user_id=auth.uid()）
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete
  using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

-- =========================
-- 3) 存储过程（扣费/发放；幂等 + 并发安全）
-- =========================

create or replace function public.sp_consume_credits(
  p_user_id uuid,
  p_units integer,
  p_request_id text,
  p_meta jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_units <= 0 then
    raise exception 'p_units must be positive';
  end if;

  -- 对用户档案行加锁，串行化同一用户扣费
  perform 1 from public.profiles where user_id = p_user_id for update;

  select coalesce(sum(delta),0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < p_units then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_ledger (user_id, delta, request_id, meta)
  values (p_user_id, -p_units, p_request_id, coalesce(p_meta, '{}'::jsonb));

  select coalesce(sum(delta),0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  return v_balance;

exception when unique_violation then
  -- 幂等：同一 (user_id, request_id) 重试不重复扣
  select coalesce(sum(delta),0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;
  return v_balance;
end;
$$;

create or replace function public.sp_grant_credits(
  p_user_id uuid,
  p_units integer,
  p_request_id text,
  p_meta jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_units <= 0 then
    raise exception 'p_units must be positive';
  end if;

  begin
    insert into public.credit_ledger (user_id, delta, request_id, meta)
    values (p_user_id, p_units, p_request_id, coalesce(p_meta, '{}'::jsonb));
  exception when unique_violation then
    -- 幂等：同一 (user_id, request_id) 重试忽略
    null;
  end;

  select coalesce(sum(delta),0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  return v_balance;
end;
$$;

-- =========================
-- 4) 触发器：新用户初始化（profiles + 欢迎额度）
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;

  -- 赠送新手额度（示例：100 credits），按 (user_id, request_id) 幂等
  insert into public.credit_ledger (user_id, delta, request_id, meta)
  values (new.id, 100, 'welcome_bonus', jsonb_build_object('reason','welcome_bonus'))
  on conflict (user_id, request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- 5) 可选验证（执行后）
-- =========================
-- select * from public.credit_balance limit 10;
-- select schemaname, tablename, policyname, cmd from pg_policies
-- where tablename in ('profiles','subscriptions','credit_ledger','threads','messages')
-- order by tablename, cmd;
```

---

## 4. 鉴权与安全

### 后端 JWT / API Key 验证（FastAPI）
- 从 `Authorization: Bearer <token>` 获取 Supabase Access Token
- 使用 `SUPABASE_JWKS_URL` 获取 JWKS，校验 `RS256` 签名、`iss`、`aud`
- 解出 `sub`（即 `user_id`）并注入请求上下文

- 支持 API Key：
  - 头 `Authorization: ApiKey dwr_<prefix>_<secret>` 或 `X-API-Key: dwr_<prefix>_<secret>`
  - 后端读取 `prefix`，从 `api_keys` 表取出对应行，使用 `salt`+`secret` 做 `sha256` 对比 `secret_hash`
  - 校验 `revoked_at`/`expires_at`，通过后解析出 `user_id`，并可回写 `last_used_at`

```python
# 伪代码示例
from fastapi import Depends, HTTPException
from jose import jwt
import requests, os

JWKS_URL = os.getenv('SUPABASE_JWKS_URL')
JWKS = requests.get(JWKS_URL, timeout=5).json()

def verify_supabase_jwt(token: str) -> str:
    try:
        headers = jwt.get_unverified_header(token)
        jwk = next(k for k in JWKS['keys'] if k['kid'] == headers['kid'])
        payload = jwt.decode(
            token,
            jwk,
            algorithms=['RS256'],
            audience='authenticated',
            options={'verify_aud': False}  # 视配置调整
        )
        return payload['sub']
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid token')
```

### RLS 与密钥
- 前端仅使用 `anon key`，所有数据访问受 RLS 保护
- 后端与 Webhook 使用 `service role key` 调用存储过程/写入账本
- Webhook 端点必须校验 Stripe 签名（`STRIPE_WEBHOOK_SECRET`）
  
新增：
- `api_keys` 表的写入（创建/吊销）建议由后端以 Service Role 调用 REST/RPC 完成；前端仅通过 JWT 调用后端的 `/api/keys` 管理接口，不直接写表。

---

## 5. 计量与扣费策略

原则：事件账本 + 聚合视图，保证可审计与幂等。

- 方案A（推荐起步）：后结算
  - 完成研究后统计实际用量（tokens/请求单位）→ 调用 `sp_consume_credits(user_id, used_units, request_id, meta)`
  - 失败则不扣费

- 方案B（可选）：预授权冻结
  - 开始前按最大可能用量预扣 → 完成后按实际费用差额退回/补扣
  - 适合成本不确定且任务时间较长的场景

`request_id` 生成建议：`
<user_id>-<UTC_TS>-<uuid>`，前后端全链路透传，支持重试幂等。

API Key 场景：
- 通过 API Key 直接调用 `/api/research`，后端照常消费 credits，并在 `meta` 中记录 `auth=api_key` 与 `api_key_prefix`，便于审计。

---

## 6. 关键业务流程

1) 登录
- 前端使用 Supabase Auth 完成 OAuth/Email 登录，拿到 session 与 access token

2) 发起研究
- 前端调用 `POST /api/research`（后端），在 Header 透传 token
- 后端：校验 JWT → 执行研究 → 统计用量 → 调用 `sp_consume_credits` 扣减 → 返回结果（SSE 流）

2A) 以 API Key 发起研究（集成场景）
- 客户后端/脚本直接调用 `POST /api/research`，Header: `Authorization: ApiKey dwr_<prefix>_<secret>`
- 后端：校验 API Key（`prefix` + `salt`/`secret_hash`；校验过期/吊销）→ 执行研究 → 消费 credits → 返回流式结果

3) 订阅与额度发放
- 前端创建 Stripe Checkout → 用户支付成功
- Webhook 接收事件：更新 `subscriptions`、在账本中发放月度额度 `sp_grant_credits`

3A) Polar Plus 月订阅（极简）
- 前端跳转 Polar 托管 Checkout（Plus $15/月）
- 支付成功/续费 → Polar 推送 Webhook 到后端 `/api/polar/webhook`
- 后端验签（`POLAR_WEBHOOK_SECRET`），优先使用 `metadata.user_id` 识别用户；如无则按订单邮箱匹配 Supabase 用户
- 发放：`sp_grant_credits(user_id, POLAR_PLUS_CREDITS, request_id='polar_<event_id>')`（幂等）

4) 历史记录
- 前端直接读写 `threads`、`messages` 表；RLS 限制为本人数据

---

## 7. 后端 API 设计（在现有基础上扩展）

- `GET /health`：健康检查（已存在）
- `POST /api/research`：流式研究
  - 认证：必需（Bearer Supabase JWT）
  - 计量：完成后调用 `sp_consume_credits`
  - 幂等：请求体中必须包含 `request_id`（若为空则由后端生成并回传）

  扩展支持：API Key (`Authorization: ApiKey ...` 或 `X-API-Key`)

- `GET /api/credits/balance`：查询余额
  - 认证：必需
  - 返回：当前用户的 `credit_balance`
- `POST /api/keys`：创建 API Key（仅 JWT 用户）
  - 生成 `prefix` 与 `secret`，只返回一次完整 key：`dwr_<prefix>_<secret>`
  - 服务端存 `salt` + `sha256(salt+secret)`，不明文存储 secret

- `GET /api/keys`：列出当前用户的 API Keys（不返回 secret）

- `DELETE /api/keys/{key_id}`：吊销 API Key（写 `revoked_at`）

- `POST /api/stripe/webhook`（可部署在前端或 Edge Function）
  - 验证 Stripe 签名
  - 处理 `customer.subscription.created|updated|deleted`、`invoice.paid` 等
  - 更新 `subscriptions` 并发放额度

- `POST /api/polar/webhook`（后端 FastAPI）
  - 验证 Polar Webhook 签名（`POLAR_WEBHOOK_SECRET`）
  - 事件：订阅创建/续费/发票已支付
  - 读取事件 `id`、金额、买家信息、`metadata.user_id`
  - 发放月度额度：`sp_grant_credits(user_id, POLAR_PLUS_CREDITS, request_id='polar_<event_id>')`（幂等）
  - 可选：更新 `subscriptions`

---

## 8. 前端集成要点（`chat_interface`）

- 集成 Supabase Auth Helpers（App Router）
- 将 access token 注入到调用后端的 `fetch`/SDK 中
- 新增页面/组件：
  - 账户与余额（读取 `credit_balance`）
  - API Keys 管理：创建/查看/吊销（调用后端 `/api/keys`）
  - 升级/订阅（集成 Stripe Checkout/Portal）
  - 会话与消息：改为读写 Supabase 表，替代本地 `data/chat_history`
- 可选：中间件或 server components 做路由保护

- 订阅（Polar）：
  - 最简：使用 `NEXT_PUBLIC_POLAR_CHECKOUT_URL` 直接跳转托管 Checkout；无需等回跳，最终以 Webhook 发放为准
  - 可选：服务端用 Polar TS SDK 动态创建 Checkout，会话更灵活（参考文档：[Polar TypeScript SDK](https://polar.sh/docs/integrate/sdk/typescript)）

---

## 9. 环境变量（建议清单）

前端（Vercel）：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE`（后端域名，如 `https://api.example.com`）
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`（若 Webhook 放在前端）

后端（Railway/Render）：
- `ALLOWED_ORIGINS`（生产必须配置，逗号分隔）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWKS_URL`（如 `https://<project>.supabase.co/auth/v1/keys`）
- `STRIPE_SECRET_KEY`
- `OPENAI_API_KEY` 等模型相关密钥
  
- Polar：
- `POLAR_WEBHOOK_SECRET`（Webhook 签名校验）
- `POLAR_PLUS_CREDITS`（每月发放额度，例如 `1000`）
  
（可选）API Key 命名空间：无需新增变量，后端使用 Supabase REST 访问 `api_keys` 表。

Supabase（Dashboard）：
- 开启 Google、Microsoft、Email/SMTP 提供商
- Stripe Webhook 目标 URL（Next.js Route 或 Edge Function）

---

## 10. 部署与 CI/CD

- 前端：Vercel 项目 → 绑定域名 → 配置环境变量 → 打开 `Preview` 与 `Production` 环境
- 后端：Railway/Render/Fly → 使用 `Dockerfile` 启动 → 配置 `ALLOWED_ORIGINS`、Supabase/Stripe 密钥
- CORS：在后端严格配置前端域名；本地开发允许 `*`
- Webhook：确保只在生产环境启用并校验签名
- CI/CD：GitHub Actions（可选）：
  - 前端：lint、typecheck、build
  - 后端：lint、sast、镜像构建与推送

---

## 11. 观测与运维

- 日志：
  - 前后端使用结构化日志，携带 `request_id`、`user_id`
  - Webhook 记录事件类型与处理结果
- 指标：
  - 请求数、错误率、P95 时延
  - 用量与余额快照（可建物化视图/定时任务）
- 告警：
  - 余额为负（理论不应发生）
  - Webhook 失败重试超限

---

## 12. 渐进落地计划

1) 在 Supabase 配置登录提供商与 SMTP；执行本方案的 SQL（表/视图/函数/RLS/触发器）
2) 前端接入 Supabase Auth；受保护路由与 token 透传；添加余额展示
3) 后端加入 JWT 校验；实现 `GET /api/credits/balance`；在 `/api/research` 完成后调用 `sp_consume_credits`
4) 接入 Stripe Checkout 与 Webhook；创建/更新 `subscriptions`，并发放月度额度
5) 将聊天历史迁移至 Supabase 的 `threads`、`messages`
6) 上线与观测；根据负载与成本再评估预授权冻结（方案B）

---

## 13. 风险与权衡

- 并发扣费：通过 `profiles` 行级锁 + 事务，降低超扣风险
- 幂等与重试：`request_id` 唯一索引；Webhook/后端均需幂等
- 供应商锁定：Auth/DB 绑定 Supabase；通过“账本 + 视图”抽象可相对平滑迁移
- 成本预测：先采用后结算；必要时增加预授权或分段结算

---

## 14. 预计改动清单（不实现，仅列出）

前端 `chat_interface`：
- 新增/修改：
  - `app/providers.tsx`：注入 Supabase 客户端/Session
  - `app/context/SessionContext.tsx`：从 Supabase session 读取用户与 token
  - `app/(protected)/account/page.tsx`：显示余额、订阅状态
  - `app/api/stripe/webhook/route.ts`（若前端承接 Webhook）
  - 将 `components` 中调用后端的逻辑统一透传 Bearer token
  - 聊天历史改为使用 Supabase JS SDK 读写 `threads`、`messages`

后端 `deep_wide_research`：
- 新增/修改：
  - 认证中间件（JWKS 验签），提取 `user_id`
  - `GET /api/credits/balance`（查询视图/或调用 RPC）
  - 在 `POST /api/research` 完成路径中统计用量并调用 `sp_consume_credits`
  - 统一 `request_id` 生成与日志相关性（correlation id）

Supabase：
- 执行本文件中的 SQL（可拆分为迁移脚本）
- Dashboard 中开启 OAuth/SMTP，配置 Stripe Webhook 目标

---

## 15. 命名与单位建议

- credits 的最小单位：按 token 或按请求进行标准化（例如：1 credit = 1k tokens）
- `meta` 字段建议包含：模型/温度/耗时/token 消耗/版本号，便于审计与成本分析

---

如需，我可以基于本方案输出：
- Supabase 迁移 SQL（可直接执行）
- 前后端文件的最小改动 PR（含 JWT 校验、RPC 调用、UI 升级面板）


---

## 16. Polar 多档位/多价格（极简架构）

- 目标：在 Polar 中配置多个订阅档位（如 Plus/Pro/Team），由前端选择档位，服务端创建对应 Checkout，会后端 Webhook 发放不同额度 credits，保持幂等。

- 后台（Polar Dashboard）
  - 为每个档位创建一个产品（或在一个产品下配置多个价格）。
  - 记录每个档位的 `product_id`（或 `price_id`）。

- 前端（Next.js）
  - 在 UI（如 `DevModePanel`）提供档位选择（Plus/Pro/Team）。
  - 跳转服务端路由：`/api/polar/checkout?products=<product_id>&customerEmail=<email>`（或 `prices=<price_id>`）。
  - 说明：我们使用 `@polar-sh/nextjs` 适配器，参数为 camelCase；邮箱使用 `customerEmail` 以便预填。
  - 文档参考：[Polar TypeScript SDK](https://polar.sh/docs/integrate/sdk/typescript)。

- 服务端（FastAPI Webhook）
  - 端点：`POST /api/polar/webhook`（验签 `POLAR_WEBHOOK_SECRET`）。
  - 从事件 payload 中读取 `product_id`/`price_id` 与 `event.id`。
  - 依据映射发放不同额度：`sp_grant_credits(user_id, amount, request_id='polar_<event_id>')`。
  - 幂等：同一 `event_id` 不重复发放；可选同步 `subscriptions` 表。

- 配置（建议）
  - 前端（Vercel）：
    - `NEXT_PUBLIC_POLAR_PRODUCT_ID_PLUS`、`NEXT_PUBLIC_POLAR_PRODUCT_ID_PRO`、`NEXT_PUBLIC_POLAR_PRODUCT_ID_TEAM`（或用一个 JSON：`NEXT_PUBLIC_POLAR_PRODUCT_IDS_JSON`）。
  - 后端（Railway/Render）：
    - `POLAR_ACCESS_TOKEN`（含 `checkouts:write`、`products:read`、`customers:read`）
    - `POLAR_SUCCESS_URL`
    - `POLAR_SERVER`（开发可设 `sandbox`）
    - `POLAR_PLAN_CREDITS_JSON`（如：`{"<PLUS_ID>":1000,"<PRO_ID>":3000,"<TEAM_ID>":10000}`）

- 流程
  1) 用户在前端选择档位 → 调用 `/api/polar/checkout?...` 创建会话，Polar 预填邮箱。
  2) 用户支付成功/续费 → Polar Webhook → 后端根据 `product_id` 发放对应 credits（幂等）。
  3) 前端余额查询使用 `GET /api/credits/balance` 实时展示。
