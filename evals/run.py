"""
Forge eval harness.
Run: python -m evals.run --dataset code_gen --model claude-sonnet-4-5

Three eval types:
  functional  — does generated code run and pass tests?
  retrieval   — did RAG return the right chunks (hit@k)?
  preference  — LLM-as-judge: which output is better?
"""
import asyncio
import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable

import anthropic

client = anthropic.AsyncAnthropic()

DATASETS_DIR = Path(__file__).parent / "datasets"
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)


@dataclass
class EvalCase:
    id: str
    input: str
    expected: str | None = None        # for functional evals
    context: list[str] | None = None   # for retrieval evals
    tags: list[str] = field(default_factory=list)


@dataclass
class EvalResult:
    case_id: str
    score: float           # 0.0 – 1.0
    passed: bool
    model_output: str
    reason: str = ""
    latency_ms: int = 0


# ── Functional eval ──────────────────────────────────────────────────────────

async def run_functional_eval(case: EvalCase, model: str) -> EvalResult:
    """Generate code, execute it, check against expected output."""
    import subprocess, tempfile, textwrap

    start = time.monotonic()
    response = await client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": case.input}],
    )
    output = response.content[0].text
    latency = int((time.monotonic() - start) * 1000)

    # Extract code block
    import re
    code_match = re.search(r"```(?:python)?\n(.*?)```", output, re.DOTALL)
    code = code_match.group(1) if code_match else output

    # Execute in subprocess (safe for evals — no untrusted user code here)
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = subprocess.run(
            ["python", tmp_path],
            capture_output=True, text=True, timeout=15
        )
        actual_output = proc.stdout.strip()
        passed = (case.expected is None or actual_output == case.expected.strip()) and proc.returncode == 0
        score = 1.0 if passed else 0.0
        reason = "OK" if passed else f"Expected: {case.expected!r}, Got: {actual_output!r}"
        if proc.returncode != 0:
            reason = f"Exit {proc.returncode}: {proc.stderr[:200]}"
    except subprocess.TimeoutExpired:
        passed, score, reason = False, 0.0, "Timeout"
    except Exception as e:
        passed, score, reason = False, 0.0, str(e)

    return EvalResult(
        case_id=case.id, score=score, passed=passed,
        model_output=output, reason=reason, latency_ms=latency,
    )


# ── Retrieval eval ───────────────────────────────────────────────────────────

async def run_retrieval_eval(case: EvalCase, retrieve_fn: Callable) -> EvalResult:
    """Check hit@k: did retrieval return at least one expected chunk?"""
    start = time.monotonic()
    results = await retrieve_fn(case.input)
    latency = int((time.monotonic() - start) * 1000)

    retrieved_paths = {r.get("file_path", "") for r in results}
    expected_paths = set(case.context or [])

    hits = retrieved_paths & expected_paths
    score = len(hits) / max(len(expected_paths), 1)
    passed = score > 0

    return EvalResult(
        case_id=case.id, score=score, passed=passed,
        model_output=str(retrieved_paths),
        reason=f"Hit {len(hits)}/{len(expected_paths)} expected chunks",
        latency_ms=latency,
    )


# ── Preference eval (LLM-as-judge) ───────────────────────────────────────────

JUDGE_PROMPT = """You are an expert software engineer evaluating AI-generated code.

Score the following response on a scale of 0.0 to 1.0 based on:
- Correctness: Does it solve the stated problem?
- Production quality: Is it complete, not a demo or placeholder?
- Code quality: Is it readable, maintainable, idiomatic?
- Safety: Does it handle errors and edge cases?

Respond with JSON only: {{"score": 0.0-1.0, "reason": "brief explanation"}}

Task: {task}

Response to evaluate:
{response}
"""

async def run_preference_eval(case: EvalCase, model_output: str, judge_model: str = "claude-haiku-4-5") -> EvalResult:
    response = await client.messages.create(
        model=judge_model,
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": JUDGE_PROMPT.format(task=case.input, response=model_output[:3000]),
        }],
    )
    text = response.content[0].text
    try:
        data = json.loads(text)
        score = float(data["score"])
        reason = data.get("reason", "")
    except Exception:
        score, reason = 0.5, "Failed to parse judge response"

    return EvalResult(
        case_id=case.id, score=score, passed=score >= 0.7,
        model_output=model_output, reason=reason,
    )


# ── Runner ───────────────────────────────────────────────────────────────────

async def run_dataset(
    dataset_name: str,
    model: str = "claude-sonnet-4-5",
    eval_type: str = "functional",
) -> dict:
    dataset_path = DATASETS_DIR / f"{dataset_name}.json"
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    cases = [EvalCase(**c) for c in json.loads(dataset_path.read_text())]
    print(f"Running {len(cases)} cases — dataset={dataset_name} model={model} type={eval_type}")

    results: list[EvalResult] = []
    for case in cases:
        print(f"  [{case.id}] ", end="", flush=True)
        if eval_type == "functional":
            result = await run_functional_eval(case, model)
        elif eval_type == "preference":
            raw = await client.messages.create(
                model=model, max_tokens=2048,
                messages=[{"role": "user", "content": case.input}],
            )
            output = raw.content[0].text
            result = await run_preference_eval(case, output)
        else:
            raise ValueError(f"Unknown eval type: {eval_type}")

        results.append(result)
        status = "✓" if result.passed else "✗"
        print(f"{status} score={result.score:.2f} ({result.latency_ms}ms)")

    avg_score = sum(r.score for r in results) / len(results)
    pass_rate = sum(1 for r in results if r.passed) / len(results)

    summary = {
        "dataset": dataset_name,
        "model": model,
        "eval_type": eval_type,
        "n_cases": len(cases),
        "avg_score": round(avg_score, 4),
        "pass_rate": round(pass_rate, 4),
        "results": [asdict(r) for r in results],
    }

    # Save results
    out_path = RESULTS_DIR / f"{dataset_name}_{model.replace('/', '_')}_{int(time.time())}.json"
    out_path.write_text(json.dumps(summary, indent=2))
    print(f"\n✓ avg_score={avg_score:.3f} pass_rate={pass_rate:.1%}")
    print(f"  Results saved: {out_path}")
    return summary


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="code_gen")
    parser.add_argument("--model", default="claude-sonnet-4-5")
    parser.add_argument("--type", default="functional", dest="eval_type")
    args = parser.parse_args()
    asyncio.run(run_dataset(args.dataset, args.model, args.eval_type))
