"""
Generate EduTech-项目文件说明.pdf (Chinese file inventory for the repo).
Run from repo root: python scripts/generate_edutech_files_pdf.py
Requires: pip install fpdf2
Uses Windows SimHei if present; otherwise falls back to Helvetica (ASCII only for body).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PDF = ROOT / "EduTech-项目文件说明.pdf"

# path -> 用途说明（简体中文）
DESCRIPTIONS: dict[str, str] = {
    ".env.example": "根目录环境变量示例（如前端 API 基地址），供复制为 .env 使用。",
    ".gitattributes": "Git 文本换行符等属性配置，保证跨平台协作一致。",
    ".gitignore": "指定 Git 忽略的文件（如 .env、缓存、本地导出 SQL 等）。",
    "DEPLOYMENT.md": "部署说明：前后端环境变量、数据库脚本与冒烟测试清单。",
    "PROJECT_DOCUMENTATION.md": "项目总体文档：功能、架构与数据流等说明。",
    "RAILWAY_VERCEL_CHECKLIST.md": "Railway + Vercel 部署检查清单与常见坑说明。",
    "Procfile": "Heroku/Railway 等平台的进程定义，启动 Web 服务（调用 run_web.sh）。",
    "app.js": "单页应用主逻辑：路由、学生/管理员界面、书店、论坛、聊天等前端行为。",
    "app.py": "本地启动 Flask 应用的入口（开发时 python app.py，默认端口 4000）。",
    "config-runtime.js": "运行时 API 基地址占位；生产可在部署平台注入 window.EDUTECH_API_BASE_URL。",
    "index.html": "静态站点入口 HTML，挂载样式与脚本并承载整页 UI 容器。",
    "package.json": "npm 项目元数据与构建脚本（如 Vercel 上执行 vercel-build）。",
    "styles.css": "全局与组件级 CSS 样式。",
    "vercel.json": "Vercel 静态托管配置：构建命令、输出目录与 SPA 重写规则。",
    "wsgi.py": "Gunicorn 等 WSGI 服务器的应用入口（避免与 backend/app 包名冲突）。",
    "requirements.txt": "根目录 Python 依赖（若用根目录方式安装后端相关包）。",
    "run_web.sh": "Procfile 调用的 shell：启动生产 Web 进程（如 gunicorn）。",
    "background.png": "首页或营销区块用的背景图资源。",
    "image1.png": "首页快捷入口或展示用图片资源。",
    "image2.png": "首页快捷入口或展示用图片资源。",
    "image3.png": "首页快捷入口或展示用图片资源。",
    "image4.png": "首页快捷入口或展示用图片资源。",
    "logo.png": "站点 Logo 图片。",
    "EduTech Platform.pdf": "项目相关说明或资料的既有 PDF（若与本次新生成的文件并存）。",
    "EduTech/EduTech Platform.pdf": "子目录 EduTech 内重复的说明 PDF 副本。",
    "EduTech/background.png": "子目录中的背景图副本（与根目录资源对应或用于独立打包）。",
    "EduTech/image1.png": "子目录中的图片副本。",
    "EduTech/image2.png": "子目录中的图片副本。",
    "EduTech/image3.png": "子目录中的图片副本。",
    "EduTech/image4.png": "子目录中的图片副本。",
    "EduTech/logo.png": "子目录中的 Logo 副本。",
    "scripts/vercel-build.mjs": "Vercel 构建脚本：准备静态资源等 Node 侧构建步骤。",
    "backend/.env.example": "后端环境变量示例：数据库、密钥等，复制为 backend/.env。",
    "backend/README.md": "Flask 后端说明：安装、建库、运行与主要 API 列表。",
    "backend/__init__.py": "将 backend 目录标记为 Python 包（可能为空或包初始化）。",
    "backend/requirements.txt": "后端 Python 依赖列表（pip install -r）。",
    "backend/run.py": "后端开发启动脚本（如 flask run / 自定义入口）。",
    "backend/test_db_connection.py": "独立脚本：检测数据库连接是否正常。",
    "backend/sql/schema.sql": "MySQL 全量建库脚本：创建 edutech 库并建表（本地常用）。",
    "backend/sql/schema_railway_default_db.sql": "仅建表脚本：适用于 Railway 默认库名 railway（无 CREATE DATABASE）。",
    "backend/sql/seed.sql": "可选种子数据，用于演示或初始化测试数据。",
    "backend/uploads/f64f97283cfe4e13a79fb5f52403d7ac_png": "仓库内随代码保留的示例上传文件（图片类资源路径演示）。",
    "backend/app/__init__.py": "Flask 应用工厂 create_app：注册蓝图、扩展、启动时 DB 兼容检查。",
    "backend/app/auth.py": "认证辅助：JWT 签发与校验、密码哈希等。",
    "backend/app/config.py": "Flask 配置类：从环境变量读取数据库 URI 等。",
    "backend/app/extensions.py": "Flask 扩展实例（如 SQLAlchemy）集中初始化。",
    "backend/app/models.py": "SQLAlchemy 模型：用户、课程、作业、论坛、订单等实体。",
    "backend/app/routes/__init__.py": "路由包初始化（可能注册各蓝图）。",
    "backend/app/routes/admin.py": "管理员 API：课程、书店、论坛、用户、聊天等管理端接口。",
    "backend/app/routes/auth.py": "注册、登录、管理员登录与首次引导等认证接口。",
    "backend/app/routes/chat.py": "学生与管理员侧聊天/支持消息相关接口。",
    "backend/app/routes/course.py": "课程、公告、资料、作业、评论、进度等课程域接口。",
    "backend/app/routes/student.py": "学生蓝图：选课、资料下载、作业提交、测验、论坛帖与回复、购物车与订单、上传等接口。",
    "scripts/generate_edutech_files_pdf.py": "根据 git 跟踪文件列表生成《EduTech-项目文件说明.pdf》的脚本（需 fpdf2）。",
    "EduTech-项目文件说明.pdf": "仓库内各已跟踪文件的用途汇总（简体中文 PDF，可由 scripts/generate_edutech_files_pdf.py 重新生成）。",
}


def git_ls_files(root: Path) -> list[str]:
    r = subprocess.run(
        ["git", "-C", str(root), "ls-files"],
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
    return sorted(lines)


def default_desc(path: str) -> str:
    return DESCRIPTIONS.get(path, "（未单独编写说明）仓库内由团队维护的源文件或资源。")


def main() -> int:
    try:
        from fpdf import FPDF
    except ImportError:
        print("Install fpdf2: pip install fpdf2", file=sys.stderr)
        return 1

    paths = git_ls_files(ROOT)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    font_name = "Helvetica"
    try:
        simhei = Path(r"C:\Windows\Fonts\simhei.ttf")
        if simhei.is_file():
            pdf.add_font("SimHei", "", str(simhei))
            font_name = "SimHei"
    except Exception:
        pass

    pdf.add_page()
    pdf.set_font(font_name, "", 16)
    pdf.multi_cell(0, 10, "EduTech 仓库文件说明", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(font_name, "", 10)
    pdf.multi_cell(
        0,
        6,
        "本文档根据当前 git 跟踪文件自动生成，概述各文件用途。生成脚本：scripts/generate_edutech_files_pdf.py",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    pdf.set_font(font_name, "", 10)
    for path in paths:
        if font_name == "Helvetica" and any("\u4e00" <= c <= "\u9fff" for c in path):
            # path is ascii in our repo
            pass
        desc = default_desc(path.replace("\\", "/"))
        block = f"【{path}】\n{desc}\n"
        pdf.set_font(font_name, "", 10)
        pdf.multi_cell(0, 6, f"· {path}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(font_name, "", 9)
        pdf.multi_cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_PDF))
    print(f"Wrote {OUT_PDF}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
