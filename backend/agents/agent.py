
from google.adk.agents import Agent
from google.adk.apps.app import App
from google.adk.agents.callback_context import CallbackContext
# from google.adk.tools.bigquery import BigQueryCredentialsConfig
# from google.adk.tools.bigquery import BigQueryToolset
# from google.adk.tools.bigquery.config import BigQueryToolConfig
# from google.adk.tools.bigquery.config import WriteMode
from google.genai import types
# import google.auth

from pydantic import BaseModel
from typing import Optional

from .tools import generate_sql_and_query_database, get_database_settings
from .prompts import return_instructions

# Define a tool configuration to block any write operations
# tool_config = BigQueryToolConfig(write_mode=WriteMode.BLOCKED)
# credentials, _ = google.auth.default()
# credentials_config = BigQueryCredentialsConfig(credentials=credentials)

# bigquery_toolset = BigQueryToolset(
#     credentials_config=credentials_config, bigquery_tool_config=tool_config
# )

class QueryContent(BaseModel):
    status: str
    sql_query: str
    expected_answer_type: str
    row_count: int
    total_rows: int
    sampled: bool
    acres: float
    error_details: Optional[str] = None

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
    instruction=return_instructions(),
    tools=[generate_sql_and_query_database],
    before_agent_callback=setup_before_agent_call,
    generate_content_config=types.GenerateContentConfig(temperature=0.01),
    # output_schema=QueryContent,
    # output_key="query_content"
)

app = App(root_agent=root_agent, name="agents")

