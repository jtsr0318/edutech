import json
import os
import time
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, Response, current_app, g, request, send_from_directory
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from ..auth import require_auth
from ..extensions import db
from ..models import (
    Announcement,
    Assignment,
    AssignmentStudentUpload,
    Book,
    CartItem,
    ContentComment,
    Course,
    Enrollment,
    ForumPost,
    ForumReply,
    Material,
    Order,
    QuizAttempt,
    SavedAnnouncement,
    Submission,
    User,
)

student_bp = Blueprint("student", __name__)
LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug-46886c.log")


def _is_admin_user():
    return getattr(g.current_user, "role", None) == "admin"


def _enrolled_course_ids(user_id: int):
    rows = db.session.query(Enrollment.course_id).filter(Enrollment.user_id == user_id).all()
    return {int(cid) for (cid,) in rows}


def _uploads_disk_basename(file_path: str):
    p = (file_path or "").strip()
    if "/api/uploads/" not in p:
        return None
    tail = p.split("/api/uploads/", 1)[-1]
    if not tail or ".." in tail or "/" in tail:
        return None
    return tail


def _safe_download_filename(name: str) -> str:
    return (name or "download").replace('"', "'")[:200]


def _batch_forum_replies(post_ids: list):
    if not post_ids:
        return {}
    out = {pid: [] for pid in post_ids}
    rows = ForumReply.query.filter(ForumReply.post_id.in_(post_ids)).order_by(ForumReply.created_at.asc()).all()
    for r in rows:
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


def _agent_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict):
    try:
        entry = {
            "sessionId": "46886c",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=True) + "\n")
    except Exception:
        pass


def _to_float(val):
    if isinstance(val, Decimal):
        return float(val)
    return val


def _assignment_publish_blocks_student(assignment: Assignment, now: datetime) -> bool:
    """True if a student must not access submission / attachment yet (scheduled publish)."""
    if _is_admin_user():
        return False
    return bool(assignment.publish_at and assignment.publish_at > now)


def _safe_quiz_payload_json(raw):
    if not raw or not str(raw).strip():
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _forum_payload(row: ForumPost):
    return {
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
    }


@student_bp.get("/me/data")
@require_auth()
def me_data():
    enrollments = (
        db.session.query(Enrollment, Course)
        .join(Course, Enrollment.course_id == Course.id)
        .filter(Enrollment.user_id == g.current_user.id)
        .all()
    )

    progress_by_course = {}
    for enrollment, course in enrollments:
        assignments = Assignment.query.filter_by(course_id=course.id).all()
        total = len(assignments)
        submitted_ids = {
            aid
            for (aid,) in Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
            .filter(Submission.user_id == g.current_user.id, Assignment.course_id == course.id)
            .with_entities(Submission.assignment_id)
            .all()
        }
        quiz_done_ids = {
            aid
            for (aid,) in QuizAttempt.query.join(Assignment, QuizAttempt.assignment_id == Assignment.id)
            .filter(QuizAttempt.user_id == g.current_user.id, Assignment.course_id == course.id)
            .with_entities(QuizAttempt.assignment_id)
            .all()
        }
        completed = 0
        for a in assignments:
            if a.id in submitted_ids:
                completed += 1
            elif (a.type or "").lower() == "mcq" and a.id in quiz_done_ids:
                completed += 1
        progress_by_course[course.name] = round((completed / total) * 100) if total else 0

    saved = SavedAnnouncement.query.filter_by(user_id=g.current_user.id).all()
    saved_map = {item.announcement_id: True for item in saved}

    cart_rows = (
        db.session.query(CartItem, Book)
        .join(Book, CartItem.book_id == Book.id)
        .filter(CartItem.user_id == g.current_user.id)
        .all()
    )
    cart_payload = {book.title: row.qty for row, book in cart_rows}

    orders = Order.query.filter_by(user_id=g.current_user.id).order_by(Order.created_at.desc()).all()
    orders_payload = [{"id": item.id, "total": _to_float(item.total), "createdAt": item.created_at.isoformat()} for item in orders]

    return {
        "progressByCourse": progress_by_course,
        "savedAnnouncements": saved_map,
        "cart": cart_payload,
        "orders": orders_payload,
        "user": {
            "id": g.current_user.id,
            "name": g.current_user.name,
            "email": g.current_user.email,
            "role": g.current_user.role,
            "bio": g.current_user.bio or "",
            "language": g.current_user.language or "English",
            "theme": g.current_user.theme or "Light",
            "notificationPref": g.current_user.notification_pref or "All notifications",
        },
    }


@student_bp.patch("/me/profile")
@require_auth()
def update_profile():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    bio = (body.get("bio") or "").strip()
    if not name or not email:
        return {"message": "name and email are required"}, 400
    existing = User.query.filter(User.email == email, User.id != g.current_user.id).first()
    if existing:
        return {"message": "Email already exists"}, 409
    g.current_user.name = name
    g.current_user.email = email
    g.current_user.bio = bio
    db.session.commit()
    return {"status": "success"}


@student_bp.patch("/me/settings")
@require_auth()
def update_settings():
    body = request.get_json(silent=True) or {}
    g.current_user.language = (body.get("language") or g.current_user.language or "English").strip() or "English"
    g.current_user.theme = (body.get("theme") or g.current_user.theme or "Light").strip() or "Light"
    g.current_user.notification_pref = (
        (body.get("notificationPref") or g.current_user.notification_pref or "All notifications").strip() or "All notifications"
    )
    db.session.commit()
    return {"status": "success"}


@student_bp.post("/orders/checkout")
@require_auth()
def checkout():
    cart_rows = (
        db.session.query(CartItem, Book)
        .join(Book, CartItem.book_id == Book.id)
        .filter(CartItem.user_id == g.current_user.id)
        .all()
    )
    if not cart_rows:
        return {"message": "Cart is empty."}, 400
    line_items = []
    total = Decimal("0")
    for row, book in cart_rows:
        qty = int(row.qty or 0)
        if qty <= 0:
            continue
        if int(book.stock or 0) < qty:
            return {"message": f"Insufficient stock for {book.title}"}, 400
        line_total = Decimal(str(book.price)) * Decimal(qty)
        total += line_total
        line_items.append({"bookId": book.id, "title": book.title, "qty": qty, "price": float(book.price)})
    if not line_items:
        return {"message": "Cart is empty."}, 400

    for row, book in cart_rows:
        qty = int(row.qty or 0)
        if qty > 0:
            book.stock = max(0, int(book.stock or 0) - qty)
        db.session.delete(row)

    details = json.dumps({"items": line_items})
    order = Order(user_id=g.current_user.id, total=total, details_json=details)
    db.session.add(order)
    db.session.commit()

    return {"status": "success", "orderId": order.id, "total": float(total)}


@student_bp.get("/courses")
@require_auth()
def list_courses():
    if _is_admin_user():
        rows = Course.query.order_by(Course.created_at.desc()).all()
    else:
        ids = _enrolled_course_ids(g.current_user.id)
        if not ids:
            return {"items": []}
        rows = Course.query.filter(Course.id.in_(ids)).order_by(Course.created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "name": row.name,
                "lecturerName": row.lecturer_name or "Lecturer",
                "message": row.message,
                "icon": row.icon or "",
            }
            for row in rows
        ]
    }


@student_bp.post("/courses/join")
@require_auth()
def join_course_by_code():
    if _is_admin_user():
        return {"message": "Use the admin panel to manage courses."}, 400
    body = request.get_json(silent=True) or {}
    raw = (body.get("joinCode") or body.get("code") or "").strip().upper().replace(" ", "")
    if not raw:
        return {"message": "joinCode is required"}, 400
    course = Course.query.filter_by(join_code=raw).first()
    if not course:
        return {"message": "Invalid course code."}, 404
    return _enroll_current_user_in_course(course.id)


def _enroll_current_user_in_course(course_id: int):
    _agent_log("post-fix", "H12", "student.py:enroll:entry", "enroll request", {"courseId": int(course_id), "userId": int(g.current_user.id)})
    course = Course.query.get(course_id)
    if not course:
        return ({"message": "Course not found."}, 404)
    existing = Enrollment.query.filter_by(user_id=g.current_user.id, course_id=course_id).first()
    if not existing:
        db.session.add(Enrollment(user_id=g.current_user.id, course_id=course_id))
        try:
            db.session.commit()
            _agent_log("post-fix", "H12", "student.py:enroll:inserted", "enrollment inserted", {"courseId": int(course_id), "userId": int(g.current_user.id)})
        except IntegrityError:
            db.session.rollback()
            _agent_log("post-fix", "H12", "student.py:enroll:duplicate", "duplicate enrollment ignored", {"courseId": int(course_id), "userId": int(g.current_user.id)})
    else:
        _agent_log("post-fix", "H12", "student.py:enroll:exists", "already enrolled", {"courseId": int(course_id), "userId": int(g.current_user.id)})
    return {"status": "success", "courseId": course_id}, 200


@student_bp.post("/courses/<int:course_id>/enroll")
@require_auth()
def enroll_course(course_id):
    if not _is_admin_user():
        return {"message": "Join a class using a join code from My Courses."}, 403
    return _enroll_current_user_in_course(course_id)


@student_bp.get("/assignments")
@require_auth()
def list_assignments():
    now = datetime.utcnow()
    eids = None if _is_admin_user() else _enrolled_course_ids(g.current_user.id)
    if eids is not None and not eids:
        return {"items": []}
    q = (
        db.session.query(Assignment, Course, Submission)
        .join(Course, Assignment.course_id == Course.id)
        .outerjoin(
            Submission,
            db.and_(Submission.assignment_id == Assignment.id, Submission.user_id == g.current_user.id),
        )
    )
    # Do not hide scheduled assignments from the list (matches materials UX; avoids TZ / bad publish_at data).
    # Enforce publish_at on submit, quiz submit, and attachment download only.
    if eids is not None:
        q = q.filter(Assignment.course_id.in_(eids))
    rows = q.order_by(Assignment.created_at.asc()).all()
    attempts = (
        QuizAttempt.query.filter_by(user_id=g.current_user.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
    latest_attempt_by_assignment = {}
    for item in attempts:
        key = int(item.assignment_id)
        if key not in latest_attempt_by_assignment:
            latest_attempt_by_assignment[key] = item

    upload_by_assignment = {}
    if not _is_admin_user() and rows:
        aid_list = [int(r.id) for r, _, _ in rows]
        if aid_list:
            for upl in AssignmentStudentUpload.query.filter(
                AssignmentStudentUpload.user_id == g.current_user.id,
                AssignmentStudentUpload.assignment_id.in_(aid_list),
            ).all():
                upload_by_assignment[int(upl.assignment_id)] = upl

    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "courseName": course.name,
                "title": row.title,
                "type": row.type,
                "dueAt": row.due_at.isoformat() if row.due_at else None,
                "publishAt": row.publish_at.isoformat() if row.publish_at else None,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
                "due": row.due_at.strftime("%d %b, %I.%M%p") if row.due_at else "No due date",
                "instructions": (row.instructions or "").strip(),
                "timerSeconds": int(row.timer_seconds or 0),
                "quizPayload": _safe_quiz_payload_json(row.quiz_payload),
                "isPublished": bool(row.publish_at is None or row.publish_at <= now),
                "quizHistory": (
                    {
                        "score": int(latest_attempt_by_assignment[row.id].score or 0),
                        "total": int(latest_attempt_by_assignment[row.id].total or 0),
                        "createdAt": latest_attempt_by_assignment[row.id].created_at.isoformat(),
                    }
                    if row.id in latest_attempt_by_assignment
                    else None
                ),
                "submission": (
                    {
                        "submittedAt": submission.submitted_at.isoformat(),
                        "isLate": submission.status == "late",
                        "sourceLabel": submission.source_label or "",
                    }
                    if submission
                    else None
                ),
                "attachmentPath": row.attachment_path or "",
                "studentUpload": (
                    {
                        "fileName": upload_by_assignment[row.id].file_name or "",
                        "updatedAt": upload_by_assignment[row.id].updated_at.isoformat(),
                    }
                    if upload_by_assignment.get(int(row.id))
                    else None
                ),
            }
            for row, course, submission in rows
        ]
    }


@student_bp.get("/announcements")
@require_auth()
def list_announcements():
    now = datetime.utcnow()
    eids = None if _is_admin_user() else _enrolled_course_ids(g.current_user.id)
    if eids is not None and not eids:
        return {"items": []}
    q = db.session.query(Announcement, Course).join(Course, Announcement.course_id == Course.id)
    if not _is_admin_user():
        q = q.filter(db.or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now))
    if eids is not None:
        q = q.filter(Announcement.course_id.in_(eids))
    rows = q.order_by(Announcement.created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "courseName": course.name,
                "title": row.title,
                "text": row.text,
                "publishAt": row.publish_at.isoformat() if row.publish_at else None,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
                "meta": f"posted at {row.created_at.strftime('%d %b, %I.%M%p')}",
            }
            for row, course in rows
        ]
    }


@student_bp.get("/materials")
@require_auth()
def list_materials():
    eids = None if _is_admin_user() else _enrolled_course_ids(g.current_user.id)
    if eids is not None and not eids:
        return {"items": []}
    # List all materials for enrolled courses; publish time is enforced on download only
    # so students always see rows and scheduled items are not "missing" from the UI.
    mq = Material.query
    if eids is not None:
        mq = mq.filter(Material.course_id.in_(eids))
    rows = mq.order_by(Material.created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "name": row.name,
                "type": row.type,
                "filePath": row.file_path,
                "publishAt": row.publish_at.isoformat() if row.publish_at else None,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
    }


@student_bp.get("/materials/<int:material_id>/file")
@require_auth()
def download_material_file(material_id):
    row = Material.query.get(material_id)
    if not row:
        return {"message": "Not found"}, 404
    if not _is_admin_user() and row.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Forbidden"}, 403
    blob = row.file_blob
    if blob:
        return Response(
            blob,
            mimetype=row.file_mime or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{_safe_download_filename(row.name)}"'},
        )
    disk_name = _uploads_disk_basename(row.file_path or "")
    if disk_name:
        folder = current_app.config["UPLOAD_FOLDER"]
        abs_path = os.path.join(folder, disk_name)
        if os.path.isfile(abs_path):
            return send_from_directory(folder, disk_name)
    return {"message": "File unavailable"}, 404


@student_bp.get("/assignments/<int:assignment_id>/attachment")
@require_auth()
def download_assignment_attachment(assignment_id):
    row = Assignment.query.get(assignment_id)
    if not row:
        return {"message": "Not found"}, 404
    if not _is_admin_user() and row.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Forbidden"}, 403
    now = datetime.utcnow()
    if _assignment_publish_blocks_student(row, now):
        return {"message": "Assignment is not published yet."}, 403
    blob = row.attachment_blob
    if blob:
        name = f"{row.title or 'assignment'}-attachment"
        return Response(
            blob,
            mimetype=row.attachment_mime or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{_safe_download_filename(name)}"'},
        )
    disk_name = _uploads_disk_basename(row.attachment_path or "")
    if disk_name:
        folder = current_app.config["UPLOAD_FOLDER"]
        abs_path = os.path.join(folder, disk_name)
        if os.path.isfile(abs_path):
            return send_from_directory(folder, disk_name)
    return {"message": "File unavailable"}, 404


@student_bp.post("/assignments/<int:assignment_id>/student-upload")
@require_auth()
def upload_assignment_student_file(assignment_id):
    if _is_admin_user():
        return {"message": "Students only."}, 403
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return {"message": "Assignment not found."}, 404
    if assignment.type != "upload":
        return {"message": "This assignment does not accept file uploads."}, 400
    if assignment.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    now = datetime.utcnow()
    if _assignment_publish_blocks_student(assignment, now):
        return {"message": "Assignment is not published yet."}, 403

    upload = request.files.get("file")
    if not upload or not (upload.filename or "").strip():
        return {"message": "file is required."}, 400
    raw = upload.read()
    max_bytes = int(current_app.config.get("MAX_UPLOAD_BYTES") or 32 * 1024 * 1024)
    if len(raw) > max_bytes:
        return {"message": "File too large."}, 413

    safe_name = secure_filename(upload.filename) or "upload"
    mime = upload.mimetype or "application/octet-stream"

    row = AssignmentStudentUpload.query.filter_by(assignment_id=assignment_id, user_id=g.current_user.id).first()
    if row:
        row.file_blob = raw
        row.file_mime = mime
        row.file_name = safe_name[:255]
        row.updated_at = datetime.utcnow()
    else:
        row = AssignmentStudentUpload(
            assignment_id=assignment_id,
            user_id=g.current_user.id,
            file_blob=raw,
            file_mime=mime,
            file_name=safe_name[:255],
            updated_at=datetime.utcnow(),
        )
        db.session.add(row)
    db.session.commit()
    return {
        "status": "success",
        "item": {"fileName": row.file_name, "updatedAt": row.updated_at.isoformat()},
    }


@student_bp.get("/assignments/<int:assignment_id>/student-upload")
@require_auth()
def download_assignment_student_upload(assignment_id):
    if _is_admin_user():
        return {"message": "Students only."}, 403
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return {"message": "Assignment not found."}, 404
    if assignment.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    now = datetime.utcnow()
    if _assignment_publish_blocks_student(assignment, now):
        return {"message": "Assignment is not published yet."}, 403

    row = AssignmentStudentUpload.query.filter_by(assignment_id=assignment_id, user_id=g.current_user.id).first()
    if not row:
        return {"message": "No file uploaded yet."}, 404
    blob = row.file_blob
    if not blob:
        return {"message": "File unavailable"}, 404
    return Response(
        blob,
        mimetype=row.file_mime or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{_safe_download_filename(row.file_name)}"'},
    )


@student_bp.get("/comments")
@require_auth()
def list_comments():
    cq = ContentComment.query
    if not _is_admin_user():
        eids = _enrolled_course_ids(g.current_user.id)
        if not eids:
            return {"items": []}
        cq = cq.filter(ContentComment.course_id.in_(eids))
    rows = cq.order_by(ContentComment.created_at.asc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "contentType": row.content_type,
                "contentId": row.content_id,
                "authorRole": row.author_role,
                "authorName": row.author_name,
                "text": row.text,
                "createdAt": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }


@student_bp.post("/comments")
@require_auth()
def create_comment():
    body = request.get_json(silent=True) or {}
    course_id = body.get("courseId")
    content_type = (body.get("contentType") or "").strip().lower()
    content_id = body.get("contentId")
    text = (body.get("text") or "").strip()
    if not course_id or not content_id or content_type not in {"announcement", "material", "assignment"} or not text:
        return {"message": "courseId, contentType, contentId and text are required."}, 400
    if not _is_admin_user():
        cid = int(course_id)
        if cid not in _enrolled_course_ids(g.current_user.id):
            return {"message": "Not enrolled in this course."}, 403
    row = ContentComment(
        course_id=int(course_id),
        content_type=content_type,
        content_id=int(content_id),
        author_role="admin" if g.current_user.role == "admin" else "student",
        author_name=g.current_user.name,
        text=text,
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"id": row.id}}


@student_bp.post("/assignments/<int:assignment_id>/submit")
@require_auth()
def submit_assignment(assignment_id):
    body = request.get_json(silent=True) or {}
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return {"message": "Assignment not found."}, 404
    if not _is_admin_user() and assignment.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    submitted_at = datetime.utcnow()
    if _assignment_publish_blocks_student(assignment, submitted_at):
        return {"message": "Assignment is not published yet."}, 403
    is_late = bool(assignment.due_at and submitted_at > assignment.due_at)
    status = "late" if is_late else "submitted"
    source_label = (body.get("sourceLabel") or "").strip()[:100]

    row = Submission.query.filter_by(assignment_id=assignment_id, user_id=g.current_user.id).first()
    if row:
        row.submitted_at = submitted_at
        row.status = status
        row.source_label = source_label
    else:
        row = Submission(
            assignment_id=assignment_id,
            user_id=g.current_user.id,
            submitted_at=submitted_at,
            status=status,
            source_label=source_label,
        )
        db.session.add(row)
    db.session.commit()
    return {
        "status": "success",
        "item": {
            "assignmentId": assignment_id,
            "submittedAt": row.submitted_at.isoformat(),
            "isLate": row.status == "late",
            "sourceLabel": row.source_label or "",
        },
    }


@student_bp.post("/assignments/<int:assignment_id>/quiz/submit")
@require_auth()
def submit_quiz(assignment_id):
    body = request.get_json(silent=True) or {}
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return {"message": "Assignment not found."}, 404
    if not _is_admin_user() and assignment.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    now = datetime.utcnow()
    if _assignment_publish_blocks_student(assignment, now):
        return {"message": "Assignment is not published yet."}, 403
    if assignment.type != "mcq":
        return {"message": "Quiz submission only supports mcq assignments."}, 400
    payload = _safe_quiz_payload_json(assignment.quiz_payload) or {}
    questions = payload.get("questions") if isinstance(payload, dict) else []
    if not questions:
        return {"message": "No quiz questions configured."}, 400
    answers = body.get("answers") or {}
    score = 0
    for idx, q in enumerate(questions):
        qid = str(q.get("id") or f"q{idx+1}")
        if str(answers.get(qid) or "").strip() == str(q.get("answer") or "").strip():
            score += 1
    total = len(questions)
    row = QuizAttempt(
        assignment_id=assignment_id,
        user_id=g.current_user.id,
        score=score,
        total=total,
        answers_json=json.dumps(answers),
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {"score": score, "total": total, "createdAt": row.created_at.isoformat()}}


@student_bp.get("/forum/posts")
@require_auth()
def list_forum_posts():
    rows = ForumPost.query.order_by(ForumPost.created_at.desc()).all()
    rmap = _batch_forum_replies([r.id for r in rows])
    return {"items": [{**_forum_payload(row), "replyList": rmap.get(row.id, [])} for row in rows]}


@student_bp.post("/forum/posts")
@require_auth()
def create_forum_post():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()
    tag = (body.get("tag") or "Tips").strip()
    image = (body.get("image") or "").strip()
    if not title:
        return {"message": "title is required"}, 400
    row = ForumPost(
        title=title,
        author_name=g.current_user.name,
        avatar=(g.current_user.name[:1] or "U").upper(),
        content=content or title,
        tag=tag,
        pinned=False,
        likes=0,
        replies=0,
        image=image,
        last_activity_text="Just now",
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": {**_forum_payload(row), "replyList": []}}


@student_bp.post("/forum/posts/<int:post_id>/reply")
@require_auth()
def reply_forum_post(post_id):
    body = request.get_json(silent=True) or {}
    text = (body.get("message") or "").strip()
    if not text:
        return {"message": "message is required"}, 400
    row = ForumPost.query.get(post_id)
    if not row:
        return {"message": "Post not found"}, 404
    role = "admin" if _is_admin_user() else "student"
    rep = ForumReply(
        post_id=post_id,
        author_role=role,
        author_name=g.current_user.name or ("Admin" if role == "admin" else "Student"),
        text=text,
    )
    db.session.add(rep)
    row.last_activity_text = "Just now"
    db.session.flush()
    row.replies = ForumReply.query.filter_by(post_id=post_id).count()
    db.session.commit()
    rmap = _batch_forum_replies([post_id])
    return {"status": "success", "item": {**_forum_payload(row), "replyList": rmap.get(post_id, [])}}


@student_bp.get("/books")
@require_auth()
def list_books():
    rows = Book.query.order_by(Book.created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "title": row.title,
                "price": float(row.price),
                "country": row.country or "",
                "area": row.area or "",
                "type": row.type or "",
                "category": row.category or "",
                "description": row.description or "",
                "image": row.image or "",
            }
            for row in rows
        ]
    }


@student_bp.post("/cart/items")
@require_auth()
def add_cart_item():
    body = request.get_json(silent=True) or {}
    book_id = body.get("bookId")
    qty = int(body.get("qty") or 1)
    if not book_id:
        return {"message": "bookId is required"}, 400
    if qty <= 0:
        return {"message": "qty must be > 0"}, 400
    book = Book.query.get(int(book_id))
    if not book:
        return {"message": "Book not found"}, 404
    row = CartItem.query.filter_by(user_id=g.current_user.id, book_id=book.id).first()
    if row:
        row.qty = int(row.qty or 0) + qty
    else:
        row = CartItem(user_id=g.current_user.id, book_id=book.id, qty=qty)
        db.session.add(row)
    db.session.commit()
    return {"status": "success"}


@student_bp.patch("/cart/items/<int:book_id>")
@require_auth()
def update_cart_item(book_id):
    body = request.get_json(silent=True) or {}
    qty = int(body.get("qty") or 0)
    row = CartItem.query.filter_by(user_id=g.current_user.id, book_id=book_id).first()
    if qty <= 0:
        if row:
            db.session.delete(row)
            db.session.commit()
        return {"status": "success"}
    if row:
        row.qty = qty
    else:
        row = CartItem(user_id=g.current_user.id, book_id=book_id, qty=qty)
        db.session.add(row)
    db.session.commit()
    return {"status": "success"}


@student_bp.delete("/cart/items/<int:book_id>")
@require_auth()
def remove_cart_item(book_id):
    row = CartItem.query.filter_by(user_id=g.current_user.id, book_id=book_id).first()
    if row:
        db.session.delete(row)
        db.session.commit()
    return {"status": "success"}


@student_bp.delete("/cart/items")
@require_auth()
def clear_cart_items():
    CartItem.query.filter_by(user_id=g.current_user.id).delete()
    db.session.commit()
    return {"status": "success"}


@student_bp.post("/announcements/<announcement_id>/save")
@require_auth()
def save_announcement(announcement_id):
    try:
        aid = int(announcement_id)
    except (TypeError, ValueError):
        return {"message": "Invalid announcement id"}, 400
    ann = Announcement.query.get(aid)
    if not ann:
        return {"message": "Announcement not found"}, 404
    if not _is_admin_user() and ann.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    row = SavedAnnouncement.query.filter_by(user_id=g.current_user.id, announcement_id=str(announcement_id)).first()
    if not row:
        db.session.add(SavedAnnouncement(user_id=g.current_user.id, announcement_id=str(announcement_id)))
        db.session.commit()
    return {"status": "success"}


@student_bp.delete("/announcements/<announcement_id>/save")
@require_auth()
def unsave_announcement(announcement_id):
    try:
        aid = int(announcement_id)
    except (TypeError, ValueError):
        return {"message": "Invalid announcement id"}, 400
    ann = Announcement.query.get(aid)
    if ann and not _is_admin_user() and ann.course_id not in _enrolled_course_ids(g.current_user.id):
        return {"message": "Not enrolled in this course."}, 403
    row = SavedAnnouncement.query.filter_by(user_id=g.current_user.id, announcement_id=str(announcement_id)).first()
    if row:
        db.session.delete(row)
        db.session.commit()
    return {"status": "success"}
