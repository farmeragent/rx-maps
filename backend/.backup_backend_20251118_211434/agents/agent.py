from google.adk.agents.llm_agent import Agent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types

from .tools import generate_SQL_query, execute_SQL_query, get_database_settings


def setup_before_agent_call(callback_context: CallbackContext) -> None:
    """Setup the agent."""

    if "database_settings" not in callback_context.state:
        callback_context.state["database_settings"] = (
            get_database_settings()
        )

root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description="Helps query an agricultural database.",
    instruction="You are a helpful data science assistant that specializes in querying an agricultural database. When asked a question, you should turn that question into a SQL query and then execute that SQL query and summarize the result.",
    tools=[generate_SQL_query, execute_SQL_query],
    before_agent_callback=setup_before_agent_call,
    generate_content_config=types.GenerateContentConfig(temperature=0.01),
)
