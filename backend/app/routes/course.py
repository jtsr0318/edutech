from flask import Blueprint, g
from ..auth import require_auth
from ..extensions import db
from ..models import Assignment, Course, QuizAttempt, Submission

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

    assignments = Assignment.query.filter(Assignment.course_id == course.id).all()
    total_assignments = len(assignments)
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
    completed_assignments = 0
    for a in assignments:
        if a.id in submitted_ids:
            completed_assignments += 1
        elif (a.type or "").lower() == "mcq" and a.id in quiz_done_ids:
            completed_assignments += 1
    progress = round((completed_assignments / total_assignments) * 100) if total_assignments else 0
    return {
        "courseId": course.id,
        "totalAssignments": total_assignments,
        "completedAssignments": int(completed_assignments),
        "progress": int(progress),
    }
