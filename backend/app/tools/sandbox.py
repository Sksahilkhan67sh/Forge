"""
Code execution sandbox via E2B.
Each execution runs in an isolated cloud microVM — no shared state between runs.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Literal

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
log = get_logger(__name__)

Language = Literal["python", "typescript", "javascript", "bash", "go", "rust"]

LANGUAGE_TEMPLATES = {
    "python":     "Python3",
    "typescript": "Node",
    "javascript": "Node",
    "bash":       "base",
    "go":         "Go",
    "rust":       "Rust",
}


@dataclass
class ExecutionResult:
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    error: str | None = None
    files: dict[str, str] = field(default_factory=dict)
    duration_ms: int = 0

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and self.error is None

    def to_dict(self) -> dict:
        return {
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "error": self.error,
            "files": self.files,
            "duration_ms": self.duration_ms,
            "success": self.success,
        }


async def execute_code(
    code: str,
    language: Language = "python",
    timeout: int = 30,
    files: dict[str, str] | None = None,
) -> ExecutionResult:
    """
    Execute code in an isolated E2B sandbox.
    files: optional dict of {filename: content} to write before execution.
    """
    import time

    if not settings.e2b_api_key:
        return ExecutionResult(
            error="E2B_API_KEY not configured. Set it in .env to enable code execution.",
            exit_code=1,
        )

    try:
        from e2b_code_interpreter import AsyncSandbox  # type: ignore

        start = time.monotonic()
        template = LANGUAGE_TEMPLATES.get(language, "base")

        async with AsyncSandbox(template=template) as sandbox:
            # Write pre-seeded files
            if files:
                for filename, content in files.items():
                    await sandbox.filesystem.write(f"/home/user/{filename}", content)

            # Wrap TS/JS for better execution
            if language == "typescript":
                code = f"import {{ execSync }} from 'child_process';\n{code}"

            result = await asyncio.wait_for(
                sandbox.notebook.exec_cell(code),
                timeout=timeout,
            )

            duration_ms = int((time.monotonic() - start) * 1000)

            stdout = ""
            stderr = ""
            if result.logs:
                stdout = "\n".join(result.logs.stdout or [])
                stderr = "\n".join(result.logs.stderr or [])

            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=0 if not result.error else 1,
                error=str(result.error) if result.error else None,
                duration_ms=duration_ms,
            )

    except TimeoutError:
        return ExecutionResult(error=f"Execution timed out after {timeout}s", exit_code=124)
    except Exception as e:
        log.error("sandbox_error", error=str(e))
        return ExecutionResult(error=f"Sandbox error: {str(e)}", exit_code=1)


def format_execution_result(result: ExecutionResult) -> str:
    """Format for injection into agent context."""
    parts = []
    if result.stdout:
        parts.append(f"<stdout>\n{result.stdout}\n</stdout>")
    if result.stderr:
        parts.append(f"<stderr>\n{result.stderr}\n</stderr>")
    if result.error:
        parts.append(f"<error>\n{result.error}\n</error>")
    if not parts:
        parts.append("<result>Execution completed with no output.</result>")
    return "\n".join(parts)
