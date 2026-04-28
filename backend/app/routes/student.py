import json
import os
import time
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, g, request
from sqlalchemy.exc import IntegrityError

from ..auth import require_auth
from ..extensions import db
from ..models import Announcement, Assignment, Book, CartItem, ContentComment, Course, Enrollment, ForumPost, Material, Order, QuizAttempt, SavedAnnouncement, Submission, User

student_bp = Blueprint("student", __name__)
LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "debug-46886c.log")


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
        total = Assignment.query.filter_by(course_id=course.id).count()
        completed = (
            Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
            .filter(Submission.user_id == g.current_user.id, Assignment.course_id == course.id)
            .count()
        )
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
    rows = Course.query.order_by(Course.created_at.desc()).all()
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


@student_bp.post("/courses/<int:course_id>/enroll")
@require_auth()
def enroll_course(course_id):
    # #region agent log
    _agent_log("post-fix", "H12", "student.py:enroll:entry", "enroll request", {"courseId": int(course_id), "userId": int(g.current_user.id)})
    # #endregion
    course = Course.query.get(course_id)
    if not course:
        return {"message": "Course not found."}, 404
    existing = Enrollment.query.filter_by(user_id=g.current_user.id, course_id=course_id).first()
    if not existing:
        db.session.add(Enrollment(user_id=g.current_user.id, course_id=course_id))
        try:
            db.session.commit()
            # #region agent log
            _agent_log("post-fix", "H12", "student.py:enroll:inserted", "enrollment inserted", {"courseId": int(course_id), "userId": int(g.current_user.id)})
            # #endregion
        except IntegrityError:
            db.session.rollback()
            # #region agent log
            _agent_log("post-fix", "H12", "student.py:enroll:duplicate", "duplicate enrollment ignored", {"courseId": int(course_id), "userId": int(g.current_user.id)})
            # #endregion
    else:
        # #region agent log
        _agent_log("post-fix", "H12", "student.py:enroll:exists", "already enrolled", {"courseId": int(course_id), "userId": int(g.current_user.id)})
        # #endregion
    return {"status": "success", "courseId": course_id}


@student_bp.get("/assignments")
@require_auth()
def list_assignments():
    now = datetime.utcnow()
    rows = (
        db.session.query(Assignment, Course, Submission)
        .join(Course, Assignment.course_id == Course.id)
        .outerjoin(
            Submission,
            db.and_(Submission.assignment_id == Assignment.id, Submission.user_id == g.current_user.id),
        )
        .filter(db.or_(Assignment.publish_at.is_(None), Assignment.publish_at <= now))
        .order_by(Assignment.created_at.asc())
        .all()
    )
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
                "due": row.due_at.strftime("%d %b, %I.%M%p") if row.due_at else "No due date",
                "rubricTemplate": row.rubric_template or "",
                "timerSeconds": int(row.timer_seconds or 0),
                "quizPayload": (json.loads(row.quiz_payload) if row.quiz_payload else None),
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
            }
            for row, course, submission in rows
        ]
    }


@student_bp.get("/announcements")
@require_auth()
def list_announcements():
    now = datetime.utcnow()
    rows = (
        db.session.query(Announcement, Course)
        .join(Course, Announcement.course_id == Course.id)
        .filter(db.or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "courseName": course.name,
                "title": row.title,
                "text": row.text,
                "publishAt": row.publish_at.isoformat() if row.publish_at else None,
                "meta": f"posted at {row.created_at.strftime('%d %b, %I.%M%p')}",
            }
            for row, course in rows
        ]
    }


@student_bp.get("/materials")
@require_auth()
def list_materials():
    now = datetime.utcnow()
    rows = Material.query.filter(db.or_(Material.publish_at.is_(None), Material.publish_at <= now)).order_by(Material.created_at.desc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "courseId": row.course_id,
                "name": row.name,
                "type": row.type,
                "filePath": row.file_path,
                "publishAt": row.publish_at.isoformat() if row.publish_at else None,
            }
            for row in rows
        ]
    }


@student_bp.get("/comments")
@require_auth()
def list_comments():
    rows = ContentComment.query.order_by(ContentComment.created_at.asc()).all()
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
    submitted_at = datetime.utcnow()
    is_late = bool(assignment.due_at and submitted_at > assignment.due_at)
    status = "late" if is_late else "submitted"
    source_label = (body.get("sourceLabel") or "").strip()

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
    if assignment.type != "mcq":
        return {"message": "Quiz submission only supports mcq assignments."}, 400
    payload = json.loads(assignment.quiz_payload) if assignment.quiz_payload else {}
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
    return {"items": [_forum_payload(row) for row in rows]}


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
    return {"status": "success", "item": _forum_payload(row)}


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
    row.replies = int(row.replies or 0) + 1
    row.last_activity_text = "Just now"
    db.session.commit()
    return {"status": "success", "item": _forum_payload(row)}


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
    row = SavedAnnouncement.query.filter_by(user_id=g.current_user.id, announcement_id=str(announcement_id)).first()
    if not row:
        db.session.add(SavedAnnouncement(user_id=g.current_user.id, announcement_id=str(announcement_id)))
        db.session.commit()
    return {"status": "success"}


@student_bp.delete("/announcements/<announcement_id>/save")
@require_auth()
def unsave_announcement(announcement_id):
    row = SavedAnnouncement.query.filter_by(user_id=g.current_user.id, announcement_id=str(announcement_id)).first()
    if row:
        db.session.delete(row)
        db.session.commit()
    return {"status": "success"}
