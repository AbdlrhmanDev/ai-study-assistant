from typing import Any, Literal

ActivityType = Literal[
    "topic_created", "topic_updated", "note_created", "note_updated",
    "note_moved", "ai_chat", "flashcard_created", "flashcards_generated",
    "quiz_generated", "quiz_completed", "flashcard_reviewed", "diagnosis_viewed",
    "knowledge_graph_viewed", "mind_map_viewed",
]

UserId = int
TopicId = int
NoteId = int
JSONDict = dict[str, Any]
