from flask import Blueprint, g
from sqlalchemy import func

from ..auth import require_auth
from ..extensions import db
from ..models import Assignment, Course, Submission

course_bp = Blueprint("course", __name__)


@course_bp.get("/course/<course_id>/progress")
@require_auth()
def course_progress(course_id):
    course = None
    if str(course_id).isdigit():
        course = Course.query.get(int(course_id))
    if not course:
        course = Course.query.filter_by(name=course_id).first()
    if not course:
        return {"message": "Course not found."}, 404

    total_assignments = Assignment.query.filter(Assignment.course_id == course.id).count()
    completed_assignments = (
        Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(Submission.user_id == g.current_user.id, Assignment.course_id == course.id)
        .with_entities(func.count(Submission.id))
        .scalar()
        or 0
    )
    progress = round((completed_assignments / total_assignments) * 100) if total_assignments else 0
    return {
        "courseId": course.id,
        "totalAssignments": total_assignments,
        "completedAssignments": int(completed_assignments),
        "progress": int(progress),
    }
