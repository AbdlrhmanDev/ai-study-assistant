from httpx import AsyncClient

from app.modules.learning_style.scoring import AXES


async def test_get_learning_style_defaults_to_balanced_with_low_activity(authed_client: AsyncClient):
    # Fewer than MIN_EVENTS_FOR_SIGNAL activities recorded (none, here) --
    # falls back to balanced weights without calling the AI provider.
    response = await authed_client.get("/api/v1/learning-style")

    assert response.status_code == 200
    body = response.json()
    assert set(body["weights"].keys()) == set(AXES)
    assert all(abs(weight - 1 / len(AXES)) < 1e-9 for weight in body["weights"].values())
    assert body["overridden"] is False


async def test_update_learning_style_normalizes_weights(authed_client: AsyncClient):
    weights = {axis: 1.0 for axis in AXES}
    weights["visual"] = 5.0  # unnormalized -- service should normalize to sum 1.0

    response = await authed_client.patch("/api/v1/learning-style", json=weights)

    assert response.status_code == 200
    body = response.json()
    assert body["overridden"] is True
    assert abs(sum(body["weights"].values()) - 1.0) < 1e-9
    assert body["weights"]["visual"] > body["weights"]["reading"]


async def test_update_learning_style_rejects_negative_weight(authed_client: AsyncClient):
    weights = {axis: 1.0 for axis in AXES}
    weights["visual"] = -1.0

    response = await authed_client.patch("/api/v1/learning-style", json=weights)

    assert response.status_code == 422


async def test_update_learning_style_rejects_missing_axis(authed_client: AsyncClient):
    incomplete = {axis: 1.0 for axis in AXES if axis != "visual"}

    response = await authed_client.patch("/api/v1/learning-style", json=incomplete)

    assert response.status_code == 422


async def test_reset_learning_style_clears_override(authed_client: AsyncClient):
    weights = {axis: 1.0 for axis in AXES}
    await authed_client.patch("/api/v1/learning-style", json=weights)

    response = await authed_client.post("/api/v1/learning-style/reset")

    assert response.status_code == 200
    assert response.json()["overridden"] is False
