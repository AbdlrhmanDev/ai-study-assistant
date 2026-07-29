from httpx import AsyncClient


def _allow_all_hosts(monkeypatch, service) -> None:
    """The success-path tests below exercise URL parsing/HTML-scraping
    logic, not the DNS-resolving SSRF guard -- stub host resolution so
    they don't depend on real network/DNS access in the test environment."""
    async def _fake_resolve_public_host(hostname: str) -> bool:
        return True

    monkeypatch.setattr(service, "_resolve_public_host", _fake_resolve_public_host)


async def test_link_preview_extracts_youtube_id(authed_client: AsyncClient, monkeypatch):
    import app.modules.link_preview.service as service

    _allow_all_hosts(monkeypatch, service)

    async def _fake_fetch_html(url: str) -> str | None:
        return "<html><head><title>Cool Video</title></head></html>"

    monkeypatch.setattr(service, "_fetch_html", _fake_fetch_html)

    response = await authed_client.get(
        "/api/v1/link-preview", params={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 200
    preview = response.json()["preview"]
    assert preview["kind"] == "youtube"
    assert preview["youtubeId"] == "dQw4w9WgXcQ"
    assert preview["title"] == "Cool Video"


async def test_link_preview_extracts_og_tags(authed_client: AsyncClient, monkeypatch):
    import app.modules.link_preview.service as service

    _allow_all_hosts(monkeypatch, service)

    html = """
    <html><head>
      <meta property="og:title" content="Great Article">
      <meta property="og:description" content="A description">
      <meta property="og:image" content="https://example.com/img.png">
      <meta property="og:site_name" content="Example Site">
    </head></html>
    """

    async def _fake_fetch_html(url: str) -> str | None:
        return html

    monkeypatch.setattr(service, "_fetch_html", _fake_fetch_html)

    response = await authed_client.get("/api/v1/link-preview", params={"url": "https://example.com/article"})

    assert response.status_code == 200
    preview = response.json()["preview"]
    assert preview["kind"] == "website"
    assert preview["title"] == "Great Article"
    assert preview["description"] == "A description"
    assert preview["imageUrl"] == "https://example.com/img.png"
    assert preview["siteName"] == "Example Site"


async def test_link_preview_falls_back_gracefully_when_fetch_fails(authed_client: AsyncClient, monkeypatch):
    import app.modules.link_preview.service as service

    _allow_all_hosts(monkeypatch, service)

    async def _fake_fetch_html(url: str) -> str | None:
        return None

    monkeypatch.setattr(service, "_fetch_html", _fake_fetch_html)

    response = await authed_client.get("/api/v1/link-preview", params={"url": "https://example.com/unreachable"})

    assert response.status_code == 200
    preview = response.json()["preview"]
    assert preview["title"] is None
    assert preview["url"] == "https://example.com/unreachable"


async def test_link_preview_rejects_non_http_scheme(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/link-preview", params={"url": "javascript:alert(1)"})

    assert response.status_code == 422


async def test_link_preview_rejects_localhost(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/link-preview", params={"url": "http://localhost:5000/secret"})

    assert response.status_code == 422


async def test_link_preview_rejects_private_ip(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/link-preview", params={"url": "http://192.168.1.1/admin"})

    assert response.status_code == 422


async def test_link_preview_rejects_domain_resolving_to_private_ip(authed_client: AsyncClient, monkeypatch):
    """A DNS-based SSRF attempt: the hostname string itself looks like an
    ordinary domain, but resolves to an internal address. This is exactly
    what the DNS-resolving check (as opposed to a pure string check) is
    for."""
    import app.modules.link_preview.service as service

    def _fake_getaddrinfo(host, port):
        return [(2, 1, 6, "", ("169.254.169.254", 0))]

    monkeypatch.setattr(service.socket, "getaddrinfo", _fake_getaddrinfo)

    response = await authed_client.get(
        "/api/v1/link-preview", params={"url": "http://attacker-controlled.example/steal"}
    )

    assert response.status_code == 422


async def test_link_preview_rejects_redirect_to_private_ip(authed_client: AsyncClient, monkeypatch):
    """A malicious server can 302 an initially-allowed URL straight to an
    internal address; each redirect hop must be re-validated, not just the
    starting URL."""
    import app.modules.link_preview.service as service

    _allow_all_hosts(monkeypatch, service)

    async def _fake_resolve(hostname: str) -> bool:
        return hostname != "internal.example"

    monkeypatch.setattr(service, "_resolve_public_host", _fake_resolve)

    class _FakeResponse:
        status_code = 302
        headers = {"location": "http://internal.example/secret"}

        async def aiter_bytes(self):
            return
            yield b""  # pragma: no cover -- unreachable, keeps this an async generator

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def stream(self, method, url):
            return _FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(service.httpx, "AsyncClient", _FakeClient)

    response = await authed_client.get(
        "/api/v1/link-preview", params={"url": "https://example.com/redirects-away"}
    )

    assert response.status_code == 200
    assert response.json()["preview"]["title"] is None
