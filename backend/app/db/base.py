from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    # CheckConstraint names below are always passed explicitly and already
    # include the table name (matching the original schema.sql names
    # verbatim), so this convention is a pass-through rather than a template.
    "ck": "%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model in the app."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
