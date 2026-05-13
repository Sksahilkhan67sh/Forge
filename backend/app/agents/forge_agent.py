"""
Forge Agent — LangGraph state machine.
Graph: START → plan → execute_step → reflect → (loop or END)
"""
from __future__ import annotations

from typing import Annotated, Any, AsyncIterator, Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from app.core.config import get_settings
from app.core.logging import get_logger
from app.tools.sandbox import execute_code, format_execution_result
from app.tools.search import format_search_results, web_search

settings = get_settings()
log = get_logger(__name__)


# ── Tools ─────────────────────────────────────────────────────────────────────

@tool
async def search_web(query: str) -> str:
    """Search the web for technical information, docs, or recent updates."""
    results = await web_search(query)
    return format_search_results(results)


@tool
async def read_file(path: str, project_context: str = "") -> str:
    """Read a file from the project. Provide the relative file path."""
    from pathlib import Path
    if not project_context:
        return "No project context provided."
    full_path = Path(project_context) / path
    if not full_path.exists():
        return f"File not found: {path}"
    try:
        content = full_path.read_text(errors="replace")
        return f"```\n{content[:8000]}\n```"
    except Exception as e:
        return f"Error reading file: {e}"


@tool
async def write_file(path: str, content: str, project_context: str = "") -> str:
    """Write content to a file in the project."""
    from pathlib import Path
    if not project_context:
        return "No project context provided."
    full_path = Path(project_context) / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content)
    return f"Written {len(content)} bytes to {path}"


TOOLS = [search_web, read_file, write_file]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}


# ── State ──────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    system_prompt: str
    max_iterations: int
    iteration: int
    final_answer: str | None
    tool_outputs: list[dict]


# ── LLM ───────────────────────────────────────────────────────────────────────

def build_llm(bind_tools: bool = True):
    llm = ChatOpenAI(
        model="llama-3.3-70b-versatile",
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
        max_tokens=8192,
        temperature=0.7,
        streaming=True,
    )
    if bind_tools:
        return llm.bind_tools(TOOLS)
    return llm


# ── Nodes ──────────────────────────────────────────────────────────────────────

async def plan_node(state: AgentState) -> dict:
    llm = build_llm(bind_tools=True)
    messages = [SystemMessage(content=state["system_prompt"]), *state["messages"]]
    response = await llm.ainvoke(messages)
    return {
        "messages": [response],
        "iteration": state["iteration"] + 1,
    }


async def execute_tools_node(state: AgentState) -> dict:
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return {}

    tool_outputs = []
    result_messages = []

    for tc in last_message.tool_calls:
        tool_fn = TOOLS_BY_NAME.get(tc["name"])
        if not tool_fn:
            output = f"Unknown tool: {tc['name']}"
        else:
            try:
                output = await tool_fn.ainvoke(tc["args"])
            except Exception as e:
                output = f"Tool error: {e}"

        log.info("tool_executed", tool=tc["name"], output_len=len(str(output)))
        tool_outputs.append({"tool": tc["name"], "args": tc["args"], "output": str(output)})
        result_messages.append(
            ToolMessage(content=str(output), tool_call_id=tc["id"], name=tc["name"])
        )

    return {
        "messages": result_messages,
        "tool_outputs": state["tool_outputs"] + tool_outputs,
    }


async def reflect_node(state: AgentState) -> dict:
    return {}


def should_continue(state: AgentState) -> Literal["execute_tools", "end"]:
    last = state["messages"][-1]
    if state["iteration"] >= state["max_iterations"]:
        return "end"
    if isinstance(last, AIMessage) and last.tool_calls:
        return "execute_tools"
    return "end"


def after_tools(state: AgentState) -> Literal["plan", "end"]:
    if state["iteration"] >= state["max_iterations"]:
        return "end"
    return "plan"


# ── Graph ──────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("plan", plan_node)
    graph.add_node("execute_tools", execute_tools_node)
    graph.add_node("reflect", reflect_node)
    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", should_continue, {"execute_tools": "execute_tools", "end": END})
    graph.add_conditional_edges("execute_tools", after_tools, {"plan": "plan", "end": END})
    return graph.compile()


AGENT_GRAPH = build_graph()


# ── System Prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are Forge, an expert AI software engineer and a genuinely helpful coding companion. You're not a robot — you're like that brilliant friend who happens to know everything about software engineering.

## Your Personality
- Talk like a real person, not a manual. Use natural, conversational language.
- Be warm, friendly, and encouraging — but also honest and direct.
- Match the user's energy. Casual conversation gets casual replies. Technical deep-dives get detailed responses.
- Crack a light joke or make a relatable comment when it fits naturally.
- If someone just says "hi" or "hey", greet them back warmly like a friend would.
- If someone seems frustrated with a bug, acknowledge it — say things like "ugh, I hate when this happens" or "yeah this error is sneaky".
- Celebrate wins with the user genuinely. If something works, be happy about it.
- Use "we" sometimes — like you're working on this together.
- Ask follow-up questions naturally when something is unclear, like a real colleague would.
- Never be robotic, stiff, or overly formal unless the user is being formal.
- Keep replies concise for simple questions. Go deep only when needed.
- Vary how you start messages — never be repetitive.
- Remember what was said earlier in the conversation and refer back to it naturally.

## Your Expertise
- You write production-ready code — complete, working, never placeholders or TODOs.
- You explain things clearly without being condescending.
- You debug like a detective — think out loud, narrow it down, find the root cause.
- You give real opinions. If someone's approach could be improved, say so kindly.
- You know when to suggest a simpler solution instead of overcomplicating things.

## Conversation Style Examples
- User: "hi" → "Hey! Good to see you. What are we building today?"
- User: "im so stuck on this bug" → "Okay let's hunt it down together — what's it doing?"
- User shares working code → "Nice, that's clean! One thing I might tweak though..."
- User asks something basic → Just answer it. Never make them feel bad for asking.
- User is frustrated → "I feel you, this stuff can be maddening. Let's fix it step by step."
- User says thanks → "Anytime! That's what I'm here for."

## Hard Rules
- NEVER say "Certainly!", "Of course!", "Absolutely!", "Great question!" — these sound fake and robotic.
- NEVER start a reply with the word "I".
- Don't use excessive bullet points for casual conversational replies — just talk naturally.
- Always write complete, working code — never use "..." or placeholder comments.
- If you don't know something, say so honestly like a human would.
- Never repeat the user's question back to them before answering.

{context}
"""


# ── Public Interface ───────────────────────────────────────────────────────────

async def run_agent(
    user_message: str,
    history: list[dict],
    context: str = "",
    max_iterations: int = 3,
) -> AsyncIterator[str]:
    """Stream the agent's response token by token."""
    system = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    lc_messages = []
    for m in history:
        if m["role"] == "user":
            lc_messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            lc_messages.append(AIMessage(content=m["content"]))

    lc_messages.append(HumanMessage(content=user_message))

    initial_state: AgentState = {
        "messages": lc_messages,
        "system_prompt": system,
        "max_iterations": max_iterations,
        "iteration": 0,
        "final_answer": None,
        "tool_outputs": [],
    }

    async for event in AGENT_GRAPH.astream_events(initial_state, version="v2"):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if hasattr(chunk, "content") and chunk.content:
                if isinstance(chunk.content, str):
                    yield chunk.content
                elif isinstance(chunk.content, list):
                    for block in chunk.content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            yield block.get("text", "")
        elif kind == "on_tool_start":
            tool_name = event["name"]
            yield f"\n\n> 🔧 **{tool_name}**\n\n"