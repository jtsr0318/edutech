import os
import json
import secrets
import uuid
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, current_app, g, request
from werkzeug.utils import secure_filename

from ..auth import require_auth
from ..extensions import db
from ..models import Announcement, Assignment, Book, ContentComment, Course, Enrollment, ForumPost, ForumReply, Material, Order, User

admin_bp = Blueprint("admin", __name__)

_JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def parse_iso_datetime(value):
    raw = (value or "").strip()
    if not raw:
        return None
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)


def _generate_join_code():
    for _ in range(120):
        code = "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(8))
        if not Course.query.filter_by(join_code=code).first():
            return code
    return uuid.uuid4().hex[:8].upper()


def _ensure_course_join_codes():
    rows = Course.query.filter(db.or_(Course.join_code.is_(None), Course.join_code == "")).all()
    if not rows:
        return
    for c in rows:
        c.join_code = _generate_join_code()
    db.session.commit()


def _forum_replies_map(post_ids: list):
    if not post_ids:
        return {}
    out = {pid: [] for pid in post_ids}
    for r in ForumReply.query.filter(ForumReply.post_id.in_(post_ids)).order_by(ForumReply.created_at.asc()).all():
        out.setdefault(r.post_id, []).append(
            {
                "id": r.id,
                "authorRole": r.author_role,
                "authorName": r.author_name,
                "text": r.text,
                "createdAt": r.created_at.isoformat(),
            }
        )
    return out


def _course_payload(course: Course):
    return {
        "id": course.id,
        "name": course.name,
        "lecturerName": course.lecturer_name or "Lecturer",
        "joinCode": (course.join_code or "").strip(),
    }


def _book_payload(book: Book):
    return {
        "id": book.id,
        "title": book.title,
        "price": float(book.price),
        "country": book.country or "",
        "area": book.area or "",
        "type": book.type or "",
        "category": book.category or "",
        "description": book.description or "",
        "image": book.image or "",
        "stock": book.stock,
    }


@admin_bp.get("/admin/stats")
@require_auth(role="admin")
def stats():
    total_users = User.query.count()
    total_courses = Course.query.count()
    total_books = Book.query.count()
    total_orders = Order.query.count()
    total_forum = ForumPost.query.count()
    return {
        "totalUsers": total_users,
        "totalCourses": total_courses,
        "totalBooks": total_books,
        "totalOrders": total_orders,
        "totalForumPosts": total_forum,
        "users": User.query.filter_by(role="user").count(),
        "courses": total_courses,
        "books": total_books,
        "forumPosts": total_forum,
    }


@admin_bp.get("/admin/courses")
@require_auth(role="admin")
def courses():
    _ensure_course_join_codes()
    rows = Course.query.order_by(Course.created_at.desc()).all()
    return {"items": [_course_payload(row) for row in rows]}


@admin_bp.post("/admin/courses")
@require_auth(role="admin")
def create_course():
    body = request.get_json(silent=True) or {}
    row = Course(
        name=(body.get("name") or "").strip(),
        lecturer_name=(body.get("lecturerName") or "Lecturer").strip() or "Lecturer",
        join_code=_generate_join_code(),
    )
    if not row.name:
        return {"message": "name is required"}, 400
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": _course_payload(row)}


@admin_bp.put("/admin/courses/<int:course_id>")
@require_auth(role="admin")
def update_course(course_id):
    body = request.get_json(silent=True) or {}
    row = Course.query.get(course_id)
    if not row:
        return {"message": "Course not found"}, 404
    row.name = (body.get("name") or row.name).strip()
    lecturer_name = (body.get("lecturerName") if body.get("lecturerName") is not None else row.lecturer_name) or "Lecturer"
    row.lecturer_name = lecturer_name.strip() or "Lecturer"
    db.session.commit()
    return {"status": "success", "item": _course_payload(row)}


@admin_bp.get("/admin/courses/<int:course_id>/enrollments")
@require_auth(role="admin")
def list_course_enrollments(course_id):
    course = Course.query.get(course_id)
    if not course:
        return {"message": "Course not found"}, 404
    rows = (
        db.session.query(User, Enrollment)
        .join(Enrollment, User.id == Enrollment.user_id)
        .filter(Enrollment.course_id == course_id)
        .order_by(Enrollment.id.asc())
        .all()
    )
    return {"items": [{"userId": u.id, "name": u.name, "email": u.email, "role": u.role} for u, _e in rows]}


@admin_bp.post("/admin/courses/<int:course_id>/materials")
@require_auth(role="admin")
def create_material(course_id):
    course = Course.query.get(course_id)
    if not course:
        return {"message": "Course not found"}, 404
    name = (request.form.get("name") or "").strip()
    upload = request.files.get("file")
    if not upload:
        return {"message": "file is required"}, 400
    safe_name = secure_filename(upload.filename or "upload.file")
    ext = (safe_name.split(".")[-1] if "." in safe_name else "FILE").upper()
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    abs_path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_name)
    upload.save(abs_path)
    file_path = f"/api/uploads/{stored_name}"
    if not name:
        name = safe_name
    file_type = ext
    publish_at = None
    try:
        publish_at = parse_iso_datetime(request.form.get("publishAt") or "")
    except Exception:
        return {"message": "Invalid publishAt datetime"}, 400
    row = Material(course_id=course_id, name=name, type=file_type, file_path=file_path, publish_at=publish_at)
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"id": row.id, "filePath": file_path}}


@admin_bp.post("/admin/uploads/image")
@require_auth(role="admin")
def upload_image():
    upload = request.files.get("file")
    if not upload:
        return {"message": "file is required"}, 400
    safe_name = secure_filename(upload.filename or "book-image.png")
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    abs_path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_name)
    upload.save(abs_path)
    file_path = f"/api/uploads/{stored_name}"
    return {"status": "success", "item": {"url": file_path}}


@admin_bp.post("/admin/courses/<int:course_id>/announcements")
@require_auth(role="admin")
def create_announcement(course_id):
    body = request.get_json(silent=True) or {}
    course = Course.query.get(course_id)
    if not course:
        return {"message": "Course not found"}, 404
    title = (body.get("title") or "").strip()
    text = (body.get("text") or "").strip()
    if not title or not text:
        return {"message": "title and text are required"}, 400
    try:
        publish_at = parse_iso_datetime(body.get("publishAt") or "")
    except Exception:
        return {"message": "Invalid publishAt datetime"}, 400
    row = Announcement(course_id=course_id, title=title, text=text, publish_at=publish_at)
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"id": row.id}}


@admin_bp.post("/admin/courses/<int:course_id>/assignments")
@require_auth(role="admin")
def create_assignment(course_id):
    course = Course.query.get(course_id)
    if not course:
        return {"message": "Course not found"}, 404

    attachment_path = None
    title = ""
    ass_type = "short"
    due_at_raw = ""
    rubric_template = ""
    timer_seconds = None
    quiz_payload = None
    publish_at = None

    ct = (request.content_type or "").lower()
    if "multipart/form-data" in ct:
        title = (request.form.get("title") or "").strip()
        ass_type = (request.form.get("type") or "short").strip().lower()
        due_at_raw = (request.form.get("dueAt") or "").strip()
        rubric_template = (request.form.get("rubricTemplate") or "").strip()
        timer_seconds = int(request.form.get("timerSeconds") or 0) or None
        quiz_raw = request.form.get("quizPayload") or ""
        if quiz_raw.strip():
            try:
                quiz_payload = json.loads(quiz_raw)
            except Exception:
                return {"message": "Invalid quizPayload JSON"}, 400
        try:
            publish_at = parse_iso_datetime(request.form.get("publishAt") or "")
        except Exception:
            return {"message": "Invalid publishAt datetime"}, 400
        upload = request.files.get("attachment")
        if upload and upload.filename:
            safe_name = secure_filename(upload.filename or "attachment")
            stored_name = f"{uuid.uuid4().hex}_{safe_name}"
            abs_path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_name)
            upload.save(abs_path)
            attachment_path = f"/api/uploads/{stored_name}"
    else:
        body = request.get_json(silent=True) or {}
        title = (body.get("title") or "").strip()
        ass_type = (body.get("type") or "short").strip().lower()
        due_at_raw = (body.get("dueAt") or "").strip()
        rubric_template = (body.get("rubricTemplate") or "").strip()
        timer_seconds = int(body.get("timerSeconds") or 0) or None
        quiz_payload = body.get("quizPayload")
        try:
            publish_at = parse_iso_datetime(body.get("publishAt") or "")
        except Exception:
            return {"message": "Invalid publishAt datetime"}, 400

    if not title:
        return {"message": "title is required"}, 400

    due_at = None
    if due_at_raw:
        try:
            due_at = datetime.fromisoformat(due_at_raw.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return {"message": "Invalid dueAt datetime"}, 400

    quiz_text = ""
    if quiz_payload is not None:
        try:
            quiz_text = json.dumps(quiz_payload)
        except Exception:
            return {"message": "Invalid quizPayload"}, 400

    row = Assignment(
        course_id=course_id,
        title=title,
        type=ass_type,
        due_at=due_at,
        publish_at=publish_at,
        rubric_template=rubric_template,
        quiz_payload=quiz_text or None,
        timer_seconds=timer_seconds,
        attachment_path=attachment_path,
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"id": row.id, "attachmentPath": attachment_path or ""}}


@admin_bp.post("/admin/comments")
@require_auth(role="admin")
def admin_create_comment():
    body = request.get_json(silent=True) or {}
    course_id = body.get("courseId")
    content_type = (body.get("contentType") or "").strip().lower()
    content_id = body.get("contentId")
    text = (body.get("text") or "").strip()
    if not course_id or not content_id or content_type not in {"announcement", "material", "assignment"} or not text:
        return {"message": "courseId, contentType, contentId and text are required."}, 400
    row = ContentComment(
        course_id=int(course_id),
        content_type=content_type,
        content_id=int(content_id),
        author_role="admin",
        author_name="Admin",
        text=text,
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"id": row.id}}


@admin_bp.delete("/admin/courses/<int:course_id>")
@require_auth(role="admin")
def delete_course(course_id):
    row = Course.query.get(course_id)
    if not row:
        return {"message": "Course not found"}, 404
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.get("/admin/books")
@require_auth(role="admin")
def books():
    rows = Book.query.order_by(Book.created_at.desc()).all()
    return {"items": [_book_payload(row) for row in rows]}


@admin_bp.post("/admin/books")
@require_auth(role="admin")
def create_book():
    body = request.get_json(silent=True) or {}
    row = Book(
        title=(body.get("title") or "").strip(),
        price=Decimal(str(body.get("price") or 0)),
        country=(body.get("country") or "").strip(),
        area=(body.get("area") or "").strip(),
        type=(body.get("type") or "").strip(),
        category=(body.get("category") or "").strip(),
        description=(body.get("description") or "").strip(),
        image=(body.get("image") or "").strip(),
        stock=int(body.get("stock") or 0),
    )
    if not row.title:
        return {"message": "title is required"}, 400
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": _book_payload(row)}


@admin_bp.put("/admin/books/<int:book_id>")
@require_auth(role="admin")
def update_book(book_id):
    body = request.get_json(silent=True) or {}
    row = Book.query.get(book_id)
    if not row:
        return {"message": "Book not found"}, 404
    row.title = (body.get("title") or row.title).strip()
    row.price = Decimal(str(body.get("price") if body.get("price") is not None else row.price))
    row.country = (body.get("country") if body.get("country") is not None else row.country) or ""
    row.area = (body.get("area") if body.get("area") is not None else row.area) or ""
    row.type = (body.get("type") if body.get("type") is not None else row.type) or ""
    row.category = (body.get("category") if body.get("category") is not None else row.category) or ""
    row.description = (body.get("description") if body.get("description") is not None else row.description) or ""
    row.image = (body.get("image") if body.get("image") is not None else row.image) or ""
    row.stock = int(body.get("stock") if body.get("stock") is not None else row.stock)
    db.session.commit()
    return {"status": "success", "item": _book_payload(row)}


@admin_bp.delete("/admin/books/<int:book_id>")
@require_auth(role="admin")
def delete_book(book_id):
    row = Book.query.get(book_id)
    if not row:
        return {"message": "Book not found"}, 404
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.get("/admin/forum-posts")
@require_auth(role="admin")
def forum_posts():
    rows = ForumPost.query.order_by(ForumPost.created_at.desc()).all()
    rmap = _forum_replies_map([r.id for r in rows])
    return {
        "items": [
            {
                "id": row.id,
                "title": row.title,
                "author": row.author_name,
                "avatar": row.avatar or "",
                "replies": row.replies,
                "tag": row.tag or "Tips",
                "pinned": bool(row.pinned),
                "likes": row.likes,
                "last": row.last_activity_text,
                "content": row.content or "",
                "image": row.image or "",
                "replyList": rmap.get(row.id, []),
            }
            for row in rows
        ]
    }


@admin_bp.delete("/admin/forum-posts/<int:post_id>")
@require_auth(role="admin")
def delete_forum_post(post_id):
    row = ForumPost.query.get(post_id)
    if not row:
        return {"message": "Post not found"}, 404
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.post("/admin/forum-posts/<int:post_id>/replies")
@require_auth(role="admin")
def admin_reply_forum_post(post_id):
    body = request.get_json(silent=True) or {}
    text = (body.get("message") or body.get("text") or "").strip()
    if not text:
        return {"message": "message is required"}, 400
    post = ForumPost.query.get(post_id)
    if not post:
        return {"message": "Post not found"}, 404
    rep = ForumReply(
        post_id=post_id,
        author_role="admin",
        author_name=(g.current_user.name if g.current_user else None) or "Admin",
        text=text,
    )
    db.session.add(rep)
    post.last_activity_text = "Just now"
    db.session.flush()
    post.replies = ForumReply.query.filter_by(post_id=post_id).count()
    db.session.commit()
    return {"status": "success", "item": {"id": rep.id}}


@admin_bp.delete("/admin/forum-replies/<int:reply_id>")
@require_auth(role="admin")
def delete_forum_reply(reply_id):
    rep = ForumReply.query.get(reply_id)
    if not rep:
        return {"message": "Reply not found"}, 404
    pid = rep.post_id
    db.session.delete(rep)
    post = ForumPost.query.get(pid)
    if post:
        db.session.flush()
        post.replies = ForumReply.query.filter_by(post_id=pid).count()
    db.session.commit()
    return {"status": "success"}


@admin_bp.get("/admin/users")
@require_auth(role="admin")
def users():
    rows = User.query.order_by(User.created_at.desc()).all()
    return {"items": [{"id": row.id, "name": row.name, "email": row.email, "role": row.role} for row in rows]}


@admin_bp.patch("/admin/users/<int:user_id>/role")
@require_auth(role="admin")
def update_role(user_id):
    body = request.get_json(silent=True) or {}
    role = (body.get("role") or "").strip().lower()
    if role not in {"admin", "user", "student"}:
        return {"message": "role must be admin or user"}, 400
    mapped_role = "user" if role == "student" else role
    row = User.query.get(user_id)
    if not row:
        return {"message": "User not found"}, 404
    row.role = mapped_role
    db.session.commit()
    return {"status": "success", "item": {"id": row.id, "role": row.role}}


@admin_bp.patch("/admin/users/<int:user_id>")
@require_auth(role="admin")
def update_user(user_id):
    body = request.get_json(silent=True) or {}
    row = User.query.get(user_id)
    if not row:
        return {"message": "User not found"}, 404
    name = (body.get("name") or row.name).strip()
    email = (body.get("email") or row.email).strip().lower()
    role = (body.get("role") or row.role).strip().lower()
    if role == "student":
        role = "user"
    if role not in {"admin", "user"}:
        return {"message": "role must be admin or user"}, 400
    email_exists = User.query.filter(User.email == email, User.id != user_id).first()
    if email_exists:
        return {"message": "Email already exists"}, 409
    row.name = name
    row.email = email
    row.role = role
    db.session.commit()
    return {"status": "success", "item": {"id": row.id, "name": row.name, "email": row.email, "role": row.role}}


@admin_bp.delete("/admin/users/<int:user_id>")
@require_auth(role="admin")
def delete_user(user_id):
    row = User.query.get(user_id)
    if not row:
        return {"message": "User not found"}, 404
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.delete("/admin/materials/<int:material_id>")
@require_auth(role="admin")
def delete_material(material_id):
    row = Material.query.get(material_id)
    if not row:
        return {"message": "Material not found"}, 404
    ContentComment.query.filter_by(content_type="material", content_id=material_id).delete()
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.delete("/admin/announcements/<int:announcement_id>")
@require_auth(role="admin")
def delete_announcement(announcement_id):
    row = Announcement.query.get(announcement_id)
    if not row:
        return {"message": "Announcement not found"}, 404
    ContentComment.query.filter_by(content_type="announcement", content_id=announcement_id).delete()
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}


@admin_bp.delete("/admin/assignments/<int:assignment_id>")
@require_auth(role="admin")
def delete_assignment(assignment_id):
    row = Assignment.query.get(assignment_id)
    if not row:
        return {"message": "Assignment not found"}, 404
    ContentComment.query.filter_by(content_type="assignment", content_id=assignment_id).delete()
    db.session.delete(row)
    db.session.commit()
    return {"status": "success"}
