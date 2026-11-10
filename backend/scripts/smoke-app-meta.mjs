/**
 * 应用元数据 + 个人/企业开发者 冒烟测试：
 * - 企业开发者创建应用必须填写 ICP 备案号（400）
 * - 个人开发者 / 管理端创建应用不强制 ICP
 * - 创建 / 更新应用支持类目、图标、简介、官网、ICP、标签，并正确入库
 * - 简介超长会被截断到 200；官网不合法被拒（400）
 * - 类目 mobile_app / mini_program 派生 application_type = spa
 *
 * 用法：node scripts/smoke-app-meta.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:3200';

function loadEnv() {
  const env = { ...process.env };
  try {
    const text = readFileSync(resolve(BACKEND, '.env'), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!(k in env)) env[k] = v;
    }
  } catch {
    /* 缺 .env 用默认值 */
  }
  return env;
}

const env = loadEnv();
const pool = new Pool({
  host: env.PG_HOST || 'localhost',
  port: Number(env.PG_PORT || 5432),
  user: env.PG_USER || 'postgres',
  password: env.PG_PASSWORD || 'postgres',
  database: env.PG_DATABASE || 'wb_oidc',
});

const suffix = Date.now().toString(36);
const ADMIN_USER = `meta_admin_${suffix}`;
const ADMIN_PWD = 'MetaAdmin1234';
const ENT_EMAIL = `meta_ent_${suffix}@example.com`;
const PER_EMAIL = `meta_per_${suffix}@example.com`;
const DEV_PWD = 'MetaDev12345';

let passed = 0;
let failed = 0;
const results = [];

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    results.push(`  ✅ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function cleanup() {
  try {
    await pool.query('DELETE FROM oidc_clients WHERE client_name LIKE $1', [`meta_%_${suffix}`]);
    await pool.query('DELETE FROM oidc_developer WHERE email LIKE $1', [`meta_%_${suffix}@example.com`]);
    await pool.query('DELETE FROM oidc_admin WHERE username = $1', [ADMIN_USER]);
  } catch (e) {
    console.log(`  WARN 清理失败：${e.message}`);
  }
}

async function main() {
  console.log(`\n===== 应用元数据 / 个人企业开发者 冒烟 @ ${BASE} =====\n`);
  let entToken = '';
  let perToken = '';
  let adminToken = '';
  let entAppId = '';

  try {
    // 临时超管
    await pool.query(
      `INSERT INTO oidc_admin (username, password_hash, display_name, role, enabled)
       VALUES ($1,$2,'元数据冒烟超管','super_admin',TRUE)`,
      [ADMIN_USER, bcrypt.hashSync(ADMIN_PWD, 10)],
    );
    const adminLogin = await req('POST', '/api/admin/auth/login', {
      body: { username: ADMIN_USER, password: ADMIN_PWD },
    });
    adminToken = adminLogin.data?.access_token;
    check('管理员登录', adminLogin.status === 200 && !!adminToken);

    // 注册企业开发者（先设类型，再申请，再审核通过）
    const entReg = await req('POST', '/api/developer/auth/register', {
      body: { email: ENT_EMAIL, password: DEV_PWD },
    });
    const entLogin0 = await req('POST', '/api/developer/auth/login', {
      body: { email: ENT_EMAIL, password: DEV_PWD },
    });
    entToken = entLogin0.data?.access_token;
    await req('PATCH', '/api/developer/profile', {
      token: entToken,
      body: { company: '元数科技有限公司', contact: '13800000000', developer_type: 'enterprise' },
    });
    await req('POST', '/api/developer/apply', {
      token: entToken,
      body: { company: '元数科技有限公司', contact: '13800000000', developer_type: 'enterprise' },
    });
    await pool.query(
      "UPDATE oidc_developer SET developer_status='approved' WHERE email=$1",
      [ENT_EMAIL],
    );
    const entLogin = await req('POST', '/api/developer/auth/login', {
      body: { email: ENT_EMAIL, password: DEV_PWD },
    });
    entToken = entLogin.data?.access_token;
    check('企业开发者资格审核通过', entLogin.data?.developer?.developer_status === 'approved'
      && entLogin.data?.developer?.developer_type === 'enterprise');

    // 注册个人开发者
    await req('POST', '/api/developer/auth/register', {
      body: { email: PER_EMAIL, password: DEV_PWD },
    });
    const perLogin0 = await req('POST', '/api/developer/auth/login', {
      body: { email: PER_EMAIL, password: DEV_PWD },
    });
    perToken = perLogin0.data?.access_token;
    await req('PATCH', '/api/developer/profile', {
      token: perToken,
      body: { company: '个人工作室', contact: '13900000000', developer_type: 'personal' },
    });
    await req('POST', '/api/developer/apply', {
      token: perToken,
      body: { company: '个人工作室', contact: '13900000000', developer_type: 'personal' },
    });
    await pool.query(
      "UPDATE oidc_developer SET developer_status='approved' WHERE email=$1",
      [PER_EMAIL],
    );
    const perLogin = await req('POST', '/api/developer/auth/login', {
      body: { email: PER_EMAIL, password: DEV_PWD },
    });
    perToken = perLogin.data?.access_token;
    check('个人开发者资格审核通过', perLogin.data?.developer?.developer_status === 'approved'
      && perLogin.data?.developer?.developer_type === 'personal');

    // 1. 企业开发者缺 ICP → 400
    const entNoIcp = await req('POST', '/api/developer/apps', {
      token: entToken,
      body: {
        client_name: `meta_ent_noicp_${suffix}`,
        redirect_uris: ['https://ent.example.com/cb'],
        category: 'web_app',
      },
    });
    check('企业开发者缺 ICP 被拒（400）', entNoIcp.status === 400, `status=${entNoIcp.status}`);

    // 2. 企业开发者带 ICP + 元数据 → 200 且入库正确
    const logo = 'data:image/jpeg;base64,' + 'A'.repeat(120);
    const entCreate = await req('POST', '/api/developer/apps', {
      token: entToken,
      body: {
        client_name: `meta_ent_ok_${suffix}`,
        redirect_uris: ['https://ent.example.com/cb'],
        category: 'mobile_app',
        logo,
        description: '一个用于演示的企业移动应用',
        website: 'https://ent.example.com',
        icp_number: '京ICP备2026000000号',
        tags: ['内部工具', '移动端'],
      },
    });
    check('企业开发者带 ICP 创建成功（2xx）', entCreate.status === 200 || entCreate.status === 201, `status=${entCreate.status}`);
    if (entCreate.status >= 300) console.log('  DEBUG entCreate:', entCreate.status, JSON.stringify(entCreate.data).slice(0, 300));
    const entData = entCreate.data?.data;
    entAppId = entData?.client_id || '';
    check('返回类目为 mobile_app', entData?.category === 'mobile_app');
    check('类目派生 application_type=spa', entData?.application_type === 'spa');
    check('返回简介/官网/ICP/标签正确', entData?.description === '一个用于演示的企业移动应用'
      && entData?.website === 'https://ent.example.com'
      && entData?.icp_number === '京ICP备2026000000号'
      && Array.isArray(entData?.tags) && entData?.tags.includes('内部工具'));

    // 直接查库验证持久化
    const dbRow = await pool.query(
      'SELECT category, logo, description, website, icp_number, tags, application_type FROM oidc_clients WHERE client_id=$1',
      [entAppId],
    );
    const r = dbRow.rows[0];
    check('数据库持久化元数据', r && r.category === 'mobile_app' && r.website === 'https://ent.example.com'
      && Array.isArray(r.tags) && r.tags.includes('移动端') && r.logo === logo);

    // 3. 个人开发者缺 ICP → 仍 200
    const perCreate = await req('POST', '/api/developer/apps', {
      token: perToken,
      body: {
        client_name: `meta_per_ok_${suffix}`,
        redirect_uris: ['https://per.example.com/cb'],
        category: 'web_app',
      },
    });
    check('个人开发者缺 ICP 仍创建成功（2xx）', perCreate.status === 200 || perCreate.status === 201, `status=${perCreate.status}`);
    if (perCreate.status >= 300) console.log('  DEBUG perCreate:', perCreate.status, JSON.stringify(perCreate.data).slice(0, 300));

    // 4. 管理端创建应用缺 ICP → 200（无 developerId 不强制）
    const adminCreate = await req('POST', '/api/admin/clients', {
      token: adminToken,
      body: {
        client_name: `meta_admin_ok_${suffix}`,
        redirect_uris: ['https://admin.example.com/cb'],
        category: 'mini_program',
      },
    });
    check('管理端创建应用缺 ICP 成功（2xx）', adminCreate.status === 200 || adminCreate.status === 201, `status=${adminCreate.status}`);
    if (adminCreate.status >= 300) console.log('  DEBUG adminCreate:', adminCreate.status, JSON.stringify(adminCreate.data).slice(0, 300));
    check('管理端 mini_program 派生 spa', adminCreate.data?.data?.application_type === 'spa');

    // 5. 先由管理员审核通过企业应用，才能编辑
    const review = await req('POST', `/api/admin/clients/${entAppId}/review`, {
      token: adminToken,
      body: { action: 'approve' },
    });
    check('企业应用审核通过（2xx）', review.status === 200 || review.status === 201, `status=${review.status}`);

    // 6. 审核通过后更新应用：简介超长截断到 200
    const longDesc = '描'.repeat(500);
    const upd = await req('PATCH', `/api/developer/apps/${entAppId}`, {
      token: entToken,
      body: { description: longDesc, website: 'https://updated.example.com' },
    });
    check('更新应用成功（200）', upd.status === 200, `status=${upd.status}`);
    check('简介超长被截断到 200', (upd.data?.data?.description || '').length === 200,
      `len=${(upd.data?.data?.description || '').length}`);

    // 7. 官网不合法 → 400
    const badSite = await req('PATCH', `/api/developer/apps/${entAppId}`, {
      token: entToken,
      body: { website: 'not-a-url' },
    });
    check('官网不合法被拒（400）', badSite.status === 400, `status=${badSite.status}`);

    // 8. 企业开发者清空 ICP → 400（企业强制）
    const entEditNoIcp = await req('PATCH', `/api/developer/apps/${entAppId}`, {
      token: entToken,
      body: { icp_number: '' },
    });
    check('企业开发者清空 ICP 被拒（400）', entEditNoIcp.status === 400, `status=${entEditNoIcp.status}`);
  } catch (e) {
    check('脚本执行未抛异常', false, e.message);
  } finally {
    await cleanup();
  }

  console.log(results.join('\n'));
  console.log(`\n===== 结果：${passed} 项通过，${failed} 项失败 =====\n`);
  process.exit(failed ? 1 : 0);
}

main();
