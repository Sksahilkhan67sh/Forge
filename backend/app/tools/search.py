"""Web search tool backed by Tavily — optimized for technical/code queries."""
from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
log = get_logger(__name__)


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Search the web and return structured results."""
    if not settings.tavily_api_key:
        return [{"error": "TAVILY_API_KEY not configured"}]
    try:
        from tavily import AsyncTavilyClient  # type: ignore

        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        response = await client.search(
            query=query,
            search_depth="advanced",
            max_results=max_results,
            include_answer=True,
        )
        results = []
        if response.get("answer"):
            results.append({"type": "answer", "content": response["answer"]})
        for r in response.get("results", []):
            results.append({
                "type": "result",
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:800],  # truncate for context budget
            })
        return results
    except Exception as e:
        log.error("search_error", query=query, error=str(e))
        return [{"error": str(e)}]


def format_search_results(results: list[dict]) -> str:
    parts = ["<search_results>"]
    for r in results:
        if r.get("type") == "answer":
            parts.append(f"<answer>{r['content']}</answer>")
        elif r.get("type") == "result":
            parts.append(
                f"<result>\n"
                f"  <title>{r['title']}</title>\n"
                f"  <url>{r['url']}</url>\n"
                f"  <content>{r['content']}</content>\n"
                f"</result>"
            )
    parts.append("</search_results>")
    return "\n".join(parts)
