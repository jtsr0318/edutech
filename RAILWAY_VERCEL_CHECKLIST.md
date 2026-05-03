# Railway + Vercel 一次对照清单

## 1) Railway → **edutech（Web 服务）** → Variables

你已经配好 `DB_*` 引用 MySQL。若部署日志仍出现 **连 `localhost` 的 MySQL** 报错，说明 Web 服务进程里 **`DB_HOST` / `MYSQLHOST` 实际没生效**；代码已支持直接读取 Railway 自带的 **`MYSQLHOST`、`MYSQLPORT`、`MYSQLUSER`、`MYSQLPASSWORD`、`MYSQLDATABASE`** 以及 **`MYSQL_URL`**。你也可以在 Web 服务里 **新增一条变量**：`MYSQL_URL` → Reference → `MySQL.MYSQL_URL`（内网连接串）。

请再确认有这两项（没有就新增）：

| 变量名 | 值 |
|--------|-----|
| `FRONTEND_ORIGIN` | `https://edutech-swart.vercel.app` |
| `SECRET_KEY` | 你自己定的长密钥（**只写在 Railway**，不要提交到 Git） |

保存后会自动重新部署。

**若一直 502 / health failed：** 在 **edutech → Settings** 看 **Root Directory**。若填了 `backend`，以前用 `gunicorn app:app` 时 Python 会导入 **`backend/app` 包**（只有 `create_app`，没有名为 `app` 的变量），**Worker 无法启动**。仓库已改为 **`run_web.sh` + `wsgi.py`**，在「根目录」或「backend 子目录」两种 cwd 下都会先 `cd` 到含 `wsgi.py` 的仓库根再启动；仍建议 Root Directory **留空**（用整个仓库为根）。

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

## 6) 空数据库时（你现在就是「没有表」）

Railway 默认库名一般是 **`railway`**。不要用仓库里的 **`backend/sql/schema.sql` 直接整文件执行**，因为它开头有 `CREATE DATABASE edutech` 和 `USE edutech`，表会建到 **`edutech` 库里**，你在 **`railway`** 的 Data 面板里会一直看到「没有表」。

请改用（二选一，表结构一致）：

- **`backend/sql/schema_railway_default_db.sql`**（推荐：无 `CREATE DATABASE` / `USE`）
- 或从 **`backend/sql/schema.sql`** 复制 **从第一个 `CREATE TABLE` 到文件末尾** 的全部语句，在已选中默认库 **`railway`** 的查询窗口里执行（不要执行文件开头的 `CREATE DATABASE` / `USE edutech`）。

操作：**Railway → MySQL → Data**，打开 SQL 编辑器，把所选内容 **全文粘贴** 进去执行。执行完后刷新，应能看到多张表。

然后再触发 **edutech** 服务 **Redeploy**。
