"""
RAG pipeline: ingest code → chunk → embed → store → retrieve.
Uses hybrid search (dense vector + BM25-style trigram) with RRF fusion.
"""
import asyncio
import hashlib
import re
from pathlib import Path
from uuid import UUID

import openai
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import CodeChunk, Project

settings = get_settings()
log = get_logger(__name__)

_oai = openai.AsyncOpenAI(api_key=settings.openai_api_key)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_MAX_TOKENS = 400
CHUNK_OVERLAP_LINES = 5

# File extensions to index
INDEXABLE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java",
    ".cpp", ".c", ".h", ".cs", ".rb", ".php", ".swift", ".kt",
    ".md", ".mdx", ".json", ".yaml", ".yml", ".toml", ".sql",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", "dist",
    "build", ".venv", "venv", ".mypy_cache", ".pytest_cache",
}


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed texts. Handles API rate limits via chunking."""
    if not texts:
        return []
    BATCH_SIZE = 100
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        resp = await _oai.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        all_embeddings.extend([r.embedding for r in resp.data])
        if i + BATCH_SIZE < len(texts):
            await asyncio.sleep(0.1)  # gentle rate-limit backoff
    return all_embeddings


def chunk_file(file_path: str, content: str, language: str) -> list[dict]:
    """Split file into overlapping chunks. Returns list of chunk dicts."""
    lines = content.splitlines()
    chunks = []
    chunk_size = 60   # lines per chunk
    overlap = CHUNK_OVERLAP_LINES

    for i in range(0, len(lines), chunk_size - overlap):
        chunk_lines = lines[i : i + chunk_size]
        chunk_content = "\n".join(chunk_lines)
        if len(chunk_content.strip()) < 20:
            continue
        chunks.append({
            "file_path": file_path,
            "language": language,
            "content": chunk_content,
            "start_line": i + 1,
            "end_line": i + len(chunk_lines),
            "symbol_name": _extract_symbol(chunk_lines, language),
            "symbol_type": _detect_symbol_type(chunk_lines, language),
            "content_hash": hashlib.sha256(chunk_content.encode()).hexdigest()[:16],
        })
    return chunks


def _extract_symbol(lines: list[str], language: str) -> str | None:
    patterns = {
        "python": r"^(?:async )?def (\w+)|^class (\w+)",
        "typescript": r"(?:function |const |class )(\w+)|(?:export default )(\w+)",
        "javascript": r"(?:function |const |class )(\w+)",
        "go": r"^func (?:\(\w+ \*?\w+\) )?(\w+)",
        "rust": r"^(?:pub )?fn (\w+)|^(?:pub )?struct (\w+)",
    }
    pattern = patterns.get(language, r"(?:function |class |def )(\w+)")
    for line in lines[:5]:
        m = re.search(pattern, line)
        if m:
            return next((g for g in m.groups() if g), None)
    return None


def _detect_symbol_type(lines: list[str], language: str) -> str | None:
    first = "\n".join(lines[:3])
    if re.search(r"\bclass\b", first):
        return "class"
    if re.search(r"\bdef\b|\bfn\b|\bfunc\b|\bfunction\b", first):
        return "function"
    return "module"


def _detect_language(path: str) -> str:
    ext_map = {
        ".py": "python", ".ts": "typescript", ".tsx": "typescript",
        ".js": "javascript", ".jsx": "javascript", ".go": "go",
        ".rs": "rust", ".java": "java", ".cpp": "cpp", ".c": "c",
        ".cs": "csharp", ".rb": "ruby", ".php": "php",
        ".md": "markdown", ".sql": "sql",
    }
    return ext_map.get(Path(path).suffix.lower(), "text")


async def index_directory(
    db: AsyncSession,
    project: Project,
    directory: str,
    force_reindex: bool = False,
) -> dict:
    """Walk directory, chunk, embed, and upsert into DB."""
    root = Path(directory)
    if not root.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    # Collect all indexable files
    all_files: list[Path] = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in INDEXABLE_EXTENSIONS:
            if not any(skip in path.parts for skip in SKIP_DIRS):
                all_files.append(path)

    log.info("indexing_start", project=str(project.id), files=len(all_files))

    if force_reindex:
        await db.execute(delete(CodeChunk).where(CodeChunk.project_id == project.id))

    total_chunks = 0
    for file_path in all_files:
        try:
            content = file_path.read_text(errors="replace")
            rel_path = str(file_path.relative_to(root))
            language = _detect_language(str(file_path))
            chunks = chunk_file(rel_path, content, language)
            if not chunks:
                continue

            texts = [c["content"] for c in chunks]
            embeddings = await embed_texts(texts)

            for chunk_dict, embedding in zip(chunks, embeddings):
                chunk = CodeChunk(
                    project_id=project.id,
                    embedding=embedding,
                    **{k: v for k, v in chunk_dict.items()},
                )
                db.add(chunk)
            total_chunks += len(chunks)
        except Exception as e:
            log.warning("file_index_error", path=str(file_path), error=str(e))

    project.indexed = True
    await db.commit()
    log.info("indexing_complete", project=str(project.id), chunks=total_chunks)
    return {"files": len(all_files), "chunks": total_chunks}


async def retrieve(
    db: AsyncSession,
    project_id: UUID,
    query: str,
    k: int = 8,
) -> list[dict]:
    """Hybrid retrieval: dense vector + trigram text search, fused with RRF."""
    query_embedding = (await embed_texts([query]))[0]

    # Dense vector search
    dense_sql = text("""
        SELECT id, file_path, language, symbol_name, content, start_line, end_line,
               1 - (embedding <=> cast(:embedding as vector)) AS score
        FROM code_chunks
        WHERE project_id = :project_id
        ORDER BY embedding <=> cast(:embedding as vector)
        LIMIT :limit
    """)
    dense_result = await db.execute(
        dense_sql,
        {"embedding": str(query_embedding), "project_id": str(project_id), "limit": k * 2},
    )
    dense_rows = dense_result.fetchall()

    # Sparse text search (trigram similarity via pg_trgm)
    sparse_sql = text("""
        SELECT id, file_path, language, symbol_name, content, start_line, end_line,
               similarity(content, :query) AS score
        FROM code_chunks
        WHERE project_id = :project_id
          AND content % :query
        ORDER BY similarity(content, :query) DESC
        LIMIT :limit
    """)
    try:
        sparse_result = await db.execute(
            sparse_sql,
            {"query": query, "project_id": str(project_id), "limit": k * 2},
        )
        sparse_rows = sparse_result.fetchall()
    except Exception:
        sparse_rows = []  # pg_trgm extension may not be enabled

    # RRF fusion
    scores: dict[str, float] = {}
    rows_by_id: dict[str, any] = {}

    for rank, row in enumerate(dense_rows):
        rid = str(row.id)
        scores[rid] = scores.get(rid, 0) + 1 / (60 + rank + 1)
        rows_by_id[rid] = row

    for rank, row in enumerate(sparse_rows):
        rid = str(row.id)
        scores[rid] = scores.get(rid, 0) + 1 / (60 + rank + 1)
        rows_by_id[rid] = row

    top_ids = sorted(scores, key=lambda x: scores[x], reverse=True)[:k]

    results = []
    for rid in top_ids:
        row = rows_by_id[rid]
        results.append({
            "id": rid,
            "file_path": row.file_path,
            "language": row.language,
            "symbol_name": row.symbol_name,
            "content": row.content,
            "start_line": row.start_line,
            "end_line": row.end_line,
            "score": scores[rid],
        })
    return results


def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks for injection into system prompt."""
    if not chunks:
        return ""
    parts = ["<retrieved_context>"]
    for chunk in chunks:
        header = f"// {chunk['file_path']}"
        if chunk.get("symbol_name"):
            header += f" — {chunk['symbol_name']}"
        if chunk.get("start_line"):
            header += f" (lines {chunk['start_line']}–{chunk['end_line']})"
        parts.append(f"{header}\n```{chunk.get('language', '')}\n{chunk['content']}\n```")
    parts.append("</retrieved_context>")
    return "\n\n".join(parts)
