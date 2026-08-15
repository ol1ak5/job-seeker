import httpx

from src.config import WatchlistEntry
from src.sources.ats_boards import fetch_board

GH = {"jobs": [{"title": "ML Engineer", "absolute_url": "https://gh/1",
                "updated_at": "2026-08-10T00:00:00-04:00",
                "location": {"name": "Remote - US"},
                "content": "&lt;p&gt;Build agents&lt;/p&gt;"}]}
LEVER = [{"text": "AI Engineer", "hostedUrl": "https://lever/1",
          "createdAt": 1754870400000,
          "categories": {"location": "Remote"},
          "descriptionPlain": "LLM apps."}]
ASHBY = {"jobs": [{"title": "Founding Engineer", "jobUrl": "https://ashby/1",
                   "location": "Remote", "isRemote": True,
                   "publishedAt": "2026-08-11T09:00:00.000Z",
                   "descriptionPlain": "Agents."}]}


def client_returning(payload):
    return httpx.Client(transport=httpx.MockTransport(
        lambda req: httpx.Response(200, json=payload)))


def entry(ats):
    return WatchlistEntry(company="Acme", ats=ats, board_token="acme", tracks=["ai"])


def test_greenhouse():
    (v,) = fetch_board(entry("greenhouse"), client_returning(GH))
    assert v.title == "ML Engineer" and v.source == "greenhouse"
    assert v.company == "Acme" and "Build agents" in v.description
    assert "<p>" not in v.description
    assert v.posted.isoformat() == "2026-08-10"


def test_lever():
    (v,) = fetch_board(entry("lever"), client_returning(LEVER))
    assert v.title == "AI Engineer" and v.source == "lever"
    assert v.posted is not None


def test_ashby():
    (v,) = fetch_board(entry("ashby"), client_returning(ASHBY))
    assert v.title == "Founding Engineer" and v.remote is True
    assert v.posted.isoformat() == "2026-08-11"


def test_strip_html_removes_script_and_style_bodies():
    from src.sources.ats_boards import _strip_html
    raw = "<p>Real text</p><script>var x=1; if(a<b){go()}</script><style>.a{color:red}</style><p>More</p>"
    out = _strip_html(raw)
    assert "Real text" in out and "More" in out
    assert "var x" not in out and "color:red" not in out
