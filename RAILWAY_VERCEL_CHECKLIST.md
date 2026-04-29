# Railway + Vercel 一次对照清单

## 1) Railway → **edutech（Web 服务）** → Variables

你已经配好 `DB_*` 引用 MySQL。请再确认有这两项（没有就新增）：

| 变量名 | 值 |
|--------|-----|
| `FRONTEND_ORIGIN` | `https://edutech-swart.vercel.app` |
| `SECRET_KEY` | 你自己定的长密钥（**只写在 Railway**，不要提交到 Git） |

保存后会自动重新部署。

---

## 2) Railway → **edutech** → Settings → Networking

复制 **Public Domain** 的完整地址，例如：  
`https://xxxxxxxx.up.railway.app`  
（不要末尾 `/`，不要带 `/api`）

---

## 3) Vercel → **edutech-swart** 项目 → Settings → Environment Variables

新增：

| 变量名 | 值 |
|--------|-----|
| `RAILWAY_API_BASE_URL` | 上一步复制的 `https://xxxxxxxx.up.railway.app` |

---

## 4) Vercel → Settings → General（或 Build & Development）

- **Build Command**：`npm run build`  
- **Output Directory**：`.`（根目录，保持默认即可）

保存后 **Redeploy** 一次。

构建会把 `RAILWAY_API_BASE_URL` 写入 `config-runtime.js`，前端会请求你的 Railway API。

---

## 5) 验证

1. 浏览器打开：`https://edutech-swart.vercel.app`  
2. 再打开：`https://你的-railway域名/api/health`  
   应看到 `{"status":"ok"}`  
3. 在 Vercel 站点上试注册 / 登录。

---

## 6) 空数据库时

若 Railway MySQL 是新的，需在库里执行一次 `backend/sql/schema.sql`（可用 Railway MySQL 插件里的连接方式或 `MYSQL_PUBLIC_URL`）。
