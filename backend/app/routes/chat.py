from flask import Blueprint, g, request

from ..auth import require_auth
from ..extensions import db
from ..models import ChatMessage, User

chat_bp = Blueprint("chat", __name__)


def _msg_payload(msg: ChatMessage):
    return {
        "id": msg.id,
        "senderRole": "admin" if msg.sender_role == "admin" else "student",
        "senderName": msg.sender_name,
        "message": msg.message,
        "createdAt": msg.created_at.isoformat(),
    }


@chat_bp.get("/chat/me")
@require_auth()
def student_messages():
    rows = (
        ChatMessage.query.filter_by(student_id=g.current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return {"items": [_msg_payload(row) for row in rows]}


@chat_bp.post("/chat/me")
@require_auth()
def send_student_message():
    body = request.get_json(silent=True) or {}
    text = (body.get("message") or "").strip()
    if not text:
        return {"message": "message is required"}, 400

    row = ChatMessage(
        student_id=g.current_user.id,
        sender_role="student",
        sender_name=g.current_user.name,
        message=text,
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": _msg_payload(row)}


@chat_bp.get("/chat/history")
@require_auth()
def student_history_alias():
    return student_messages()


@chat_bp.post("/chat/send")
@require_auth()
def student_send_alias():
    return send_student_message()


@chat_bp.get("/admin/chats/users")
@require_auth(role="admin")
def chat_users():
    users = User.query.filter_by(role="user").order_by(User.name.asc()).all()
    return {"items": [{"id": user.id, "name": user.name, "email": user.email} for user in users]}


@chat_bp.get("/admin/chats/users/<int:user_id>/messages")
@require_auth(role="admin")
def admin_get_messages(user_id):
    rows = ChatMessage.query.filter_by(student_id=user_id).order_by(ChatMessage.created_at.asc()).all()
    return {"items": [_msg_payload(row) for row in rows]}


@chat_bp.post("/admin/chats/users/<int:user_id>/messages")
@require_auth(role="admin")
def admin_send_message(user_id):
    body = request.get_json(silent=True) or {}
    text = (body.get("message") or "").strip()
    student = User.query.filter_by(id=user_id, role="user").first()
    if not student:
        return {"message": "Student not found."}, 404
    if not text:
        return {"message": "message is required"}, 400

    row = ChatMessage(
        student_id=user_id,
        sender_role="admin",
        sender_name=g.current_user.name,
        message=text,
    )
    db.session.add(row)
    db.session.commit()
    return {"status": "success", "item": _msg_payload(row)}
