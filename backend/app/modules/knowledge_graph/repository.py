from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .model import ConceptRelation


async def delete_relations_for_concepts(db: AsyncSession, concept_ids: list[int]) -> None:
    if not concept_ids:
        return
    await db.execute(
        delete(ConceptRelation).where(
            or_(
                ConceptRelation.from_concept_id.in_(concept_ids),
                ConceptRelation.to_concept_id.in_(concept_ids),
            )
        )
    )


async def create_relation(
    db: AsyncSession, *, from_concept_id: int, to_concept_id: int, relation_type: str, weight: float
) -> ConceptRelation:
    stmt = (
        pg_insert(ConceptRelation)
        .values(
            from_concept_id=from_concept_id, to_concept_id=to_concept_id,
            relation_type=relation_type, weight=weight,
        )
        .on_conflict_do_update(
            index_elements=[ConceptRelation.from_concept_id, ConceptRelation.to_concept_id, ConceptRelation.relation_type],
            set_={"weight": weight},
        )
        .returning(ConceptRelation)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()


async def list_relations_for_concepts(db: AsyncSession, concept_ids: list[int]) -> list[ConceptRelation]:
    if not concept_ids:
        return []
    stmt = select(ConceptRelation).where(
        ConceptRelation.from_concept_id.in_(concept_ids), ConceptRelation.to_concept_id.in_(concept_ids),
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
