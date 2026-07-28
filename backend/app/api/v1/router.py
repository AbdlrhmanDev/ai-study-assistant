from fastapi import APIRouter

from ...modules.agents.router import router as agents_router
from ...modules.ai.router import router as ai_router
from ...modules.analytics.router import router as analytics_router
from ...modules.auth.router import router as auth_router
from ...modules.coach.router import router as coach_router
from ...modules.exams.router import router as exams_router
from ...modules.export.router import router as export_router
from ...modules.flashcards.router import router as flashcards_router
from ...modules.gamification.router import router as gamification_router
from ...modules.goal_prediction.router import router as goal_prediction_router
from ...modules.knowledge_graph.router import router as knowledge_graph_router
from ...modules.learning_style.router import router as learning_style_router
from ...modules.mastery.router import router as mastery_router
from ...modules.memory.router import router as memory_router
from ...modules.mind_map.router import router as mind_map_router
from ...modules.notes.router import router as notes_router
from ...modules.quizzes.router import router as quizzes_router
from ...modules.study_history.router import router as study_history_router
from ...modules.topics.router import router as topics_router

# modules.users.router is intentionally NOT mounted: the Express app never had
# a dedicated /users resource, and the frontend calls profile endpoints at
# /auth/me. auth.router owns that path and delegates persistence to
# modules.users.service/repository.

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(agents_router)
api_router.include_router(analytics_router)
api_router.include_router(auth_router)
api_router.include_router(topics_router)
api_router.include_router(notes_router)
api_router.include_router(ai_router)
api_router.include_router(coach_router)
api_router.include_router(exams_router)
api_router.include_router(export_router)
api_router.include_router(flashcards_router)
api_router.include_router(gamification_router)
api_router.include_router(goal_prediction_router)
api_router.include_router(knowledge_graph_router)
api_router.include_router(learning_style_router)
api_router.include_router(mastery_router)
api_router.include_router(memory_router)
api_router.include_router(mind_map_router)
api_router.include_router(quizzes_router)
api_router.include_router(study_history_router)
