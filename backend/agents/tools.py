import json
import logging
import os
from typing import Tuple, Optional

import sqlglot
from google import genai
from google.adk.tools import ToolContext
from google.adk.tools.bigquery.client import get_bigquery_client
from google.cloud import bigquery
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

database_settings = None

dataset_id = os.getenv("BQ_DATASET_ID")
data_project = os.getenv("GOOGLE_PROJECT_ID")
MAX_NUM_ROWS = 100

# Initialize genai client with API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is not set")
llm_client = genai.Client(api_key=api_key)


def get_database_settings():
    """Get database settings."""
    global database_settings
    if database_settings is None:
        database_settings = update_database_settings()
    return database_settings


def update_database_settings():
    """Update database settings."""
    global database_settings
    schema = get_bigquery_schema_and_samples()
    database_settings = {
        "data_project_id": os.getenv("GOOGLE_PROJECT_ID"),
        "dataset_id": os.getenv("BQ_DATASET_ID"),
        "schema": schema,
        # Include ChaseSQL-specific constants.
        # **chase_constants.chase_sql_constants_dict,
    }
    return database_settings


def get_bigquery_schema_and_samples():
    """Retrieves schema and sample values for the BigQuery dataset tables."""
    client = get_bigquery_client(
        project=os.getenv('GOOGLE_PROJECT_ID'),
        credentials=None,
        user_agent='a-dummy-agent',
    )
    dataset_ref = bigquery.DatasetReference(data_project, dataset_id)
    tables_context = {}
    for table in client.list_tables(dataset_ref):
        table_info = client.get_table(
            bigquery.TableReference(dataset_ref, table.table_id)
        )
        table_schema = [
            (schema_field.name, schema_field.field_type, schema_field.description)
            for schema_field in table_info.schema
        ]
        table_ref = dataset_ref.table(table.table_id)
        sample_values = []
        if False:
            sample_query = f"SELECT * FROM `{table_ref}` LIMIT 5"
            sample_values = (
                client.query(sample_query).to_dataframe().to_dict(orient="list")
            )
            for key in sample_values:
                sample_values[key] = [
                    _serialize_value_for_sql(v) for v in sample_values[key]
                ]

        # Get unique field names if field_name column exists
        field_names = []
        if any(field.name == 'field_name' for field in table_info.schema):
            field_names_query = f"SELECT DISTINCT field_name FROM `{table_ref}` WHERE field_name IS NOT NULL ORDER BY field_name"
            try:
                result = client.query(field_names_query).to_dataframe()
                field_names = result['field_name'].tolist()
            except Exception as e:
                logger.warning(f"Failed to query field names: {e}")

        tables_context[str(table_ref)] = {
            "table_schema": table_schema,
            "example_values": sample_values,
            "field_names": field_names,
        }

    return tables_context

def validate_bigquery_sql(
    sql: str,
    max_bytes: int = 10**9,  # 1 GB default limit
) -> Tuple[bool, str, Optional[int]]:
    """
    Validate a BigQuery SQL query using both local parsing and dry run.

    Args:
        sql: The SQL query to validate
        max_bytes: Maximum bytes allowed to process (default 1GB)

    Returns:
        Tuple of (is_valid, message, bytes_processed)
        - is_valid: Whether the query passed all validation checks
        - message: Description of validation result or error
        - bytes_processed: Estimated bytes (None if validation failed before dry run)
    """

    # Step 1: Do local SQL parsing and check for any dangerous write operations.
    try:
        parsed = sqlglot.parse_one(sql, dialect="bigquery")

        # Only allow SELECT statements
        if not isinstance(parsed, sqlglot.exp.Select):
            return False, f"Only SELECT queries allowed, got {type(parsed).__name__}", None

        # Check for write operations in the query tree
        dangerous_operations = (
            sqlglot.exp.Insert, sqlglot.exp.Update, sqlglot.exp.Delete,
            sqlglot.exp.Drop, sqlglot.exp.Create, sqlglot.exp.Alter,
            sqlglot.exp.Merge
        )

        for node in parsed.walk():
            if isinstance(node, dangerous_operations):
                return False, f"Dangerous operation detected: {type(node).__name__}", None

    except Exception as e:
        return False, f"SQL parsing failed: {str(e)}", None

    # Step 2: Do a BigQuery dry run and make sure the query will work.
    try:
        bigquery_client = get_bigquery_client(
            project=os.getenv('GOOGLE_PROJECT_ID'),
            credentials=None,
            user_agent='a-dummy-agent',
        )

        job_config = bigquery.QueryJobConfig(
            dry_run=True,
            use_query_cache=False
        )

        query_job = bigquery_client.query(sql, job_config=job_config)
        bytes_processed = query_job.total_bytes_processed

        # Check if query would process too much data
        if bytes_processed > max_bytes:
            return (
                False,
                f"Query would process {bytes_processed:,} bytes (limit: {max_bytes:,})",
                bytes_processed
            )

        return (
            True,
            f"✓ Valid query - would process {bytes_processed:,} bytes (~${bytes_processed / 10**12 * 6.25:.4f})",
            bytes_processed
        )

    except Exception as e:
        return False, f"BigQuery validation failed: {str(e)}", None

def generate_SQL_query(
    question: str,
    tool_context: ToolContext,
) -> str:
    """Generates a SQL query from a natural language question.

    Args:
        question (str): Natural language question.
        tool_context (ToolContext): The tool context to use for generating the
            SQL query.

    Returns:
        str: An SQL statement to answer this question.
    """
    logger.debug("bigquery_nl2sql - question: %s", question)

    prompt_template = """
        You are a BigQuery SQL expert tasked with generating SQL in the Google SQL
        dialect based on the user's natural language question.
        Your task is to write a Bigquery SQL query that answers the following question
        while using the provided context.

        **Question Types:**

        You should be prepared to answer three main types of questions:

        1. **MAP questions** - Spatial queries that identify specific locations/areas
           - Examples: "Where is phosphorus low?", "Show me areas that need lime", "Which hexes have pH below 6?"
           - These queries return `h3_index` values for visualization on a map
           - MUST include a filter on `field_name` to specify which field to query
           - Return type: "MAP"

        2. **TABLE questions** - Statistical summaries and aggregate data
           - Examples: "What's the average pH by field?", "How much fertilizer is needed total?", "Compare nutrient levels across fields"
           - These queries use GROUP BY, aggregations (SUM, AVG, COUNT, etc.)
           - Return summary statistics, totals, or comparisons
           - Return type: "TABLE"

        3. **SCATTERPLOT questions** - Relationship analysis between variables
           - Examples: "How does pH relate to yield target?", "Plot calcium vs magnesium levels"
           - These queries return raw data points suitable for plotting x/y relationships
           - Should return the variables needed for the axes
           - Return type: "SCATTERPLOT"

        **Guidelines:**

        - **Table Referencing:** Always use the full table name with the database prefix
          in the SQL statement.  Tables should be referred to using a fully qualified
          name with enclosed in backticks (`) e.g.
          `project_name.dataset_name.table_name`.  Table names are case sensitive.
        - **Joins:** Join as few tables as possible. When joining tables, ensure all
          join columns are the same data type. Analyze the database and the table schema
          provided to understand the relationships between columns and tables.
        - **Aggregations:**  Use all non-aggregated columns from the `SELECT` statement
          in the `GROUP BY` clause.
        - **SQL Syntax:** Return syntactically and semantically correct SQL for BigQuery
          with proper relation mapping (i.e., project_id, owner, table, and column
          relation). Use SQL `AS` statement to assign a new name temporarily to a table
          column or even a table wherever needed. Always enclose subqueries and union
          queries in parentheses.
        - **Column Usage:** Use *ONLY* the column names (column_name) mentioned in the
          Table Schema. Do *NOT* use any other column names. Associate `column_name`
          mentioned in the Table Schema only to the `table_name` specified under Table
          Schema.
        - **Minimize number of columns:** Provide only the columns you think the user
          needs to answer their question. However, if you provide a query with `h3_index`,
          make sure to also provide an `area` column as well for summarization.
        - **FILTERS:** You should write query effectively  to reduce and minimize the
          total rows to be returned. For example, you can use filters (like `WHERE`,
          `HAVING`, etc. (like 'COUNT', 'SUM', etc.) in the SQL query.
        - **DON'T LIMIT ROWS:** Do not limit the total number of rows returned by the query.
        - **MAP queries require field_name filter:** If the expected_answer_type is "MAP"
          and the SQL query does NOT include a WHERE clause filtering on `field_name`,
          you MUST respond with this exact JSON format:
          {{"status": "ERROR", "error_details": "Map-based queries require a field name. Please specify which field you want to query (e.g., 'north-of-road', 'south-of-road', 'railroad-pivot')."}}
          Do NOT return sql_query, sql_summary, or expected_answer_type in this case.

        **Available Field Names:**
        When filtering on `field_name` ONLY use these options. If a the field name isn't
        exact, just take the closest one.

        {FIELD_NAMES}

        **Schema:**

        The database structure is defined by the following table schemas (possibly with
        sample rows):

        ```
        {SCHEMA}
        ```

        **Natural language question:**

        ```
        {QUESTION}
        ```

        **Output Format:**

        You must respond with a valid JSON object containing exactly three keys:
        - "sql_query": The BigQuery SQL query string
        - "sql_summary": A natural language explanation of what the query does
        - "expected_answer_type": One of "MAP", "TABLE", or "SCATTERPLOT" based on how the results should be visualized
          - Use "MAP" when the query returns h3_index values for spatial visualization
          - Use "TABLE" when the query returns aggregate statistics or summary data
          - Use "SCATTERPLOT" when the query returns data suitable for plotting relationships between variables

        Do not include any additional text outside the JSON object.

        **Think Step-by-Step:** Carefully consider the schema, question, guidelines, and
        best practices outlined above to generate the correct BigQuery SQL.
    """

    schema = tool_context.state["database_settings"]["schema"]

    # Extract field names from schema
    field_names_list = []
    for table_name, table_info in schema.items():
        if table_info.get("field_names"):
            field_names_list.extend(table_info["field_names"])

    if field_names_list:
        field_names_text = "The following field names are available in the database:\n" + "\n".join([f"  - {name}" for name in field_names_list])
    else:
        field_names_text = "No field names available in the database."

    prompt = prompt_template.format(
        MAX_NUM_ROWS=MAX_NUM_ROWS, SCHEMA=schema, QUESTION=question, FIELD_NAMES=field_names_text
    )

    # TODO(david): Be able to support CHASE SQL (some robust NL-SQL method).
    response = llm_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={"temperature": 0.1},
    )

    # Parse the JSON response
    try:
        # Remove markdown code blocks if present
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()

        result = json.loads(response_text)

        # Check if LLM returned an error (e.g., MAP query without field_name)
        if result.get("status") == "ERROR":
            return result

        # Validate required keys for success case
        required_keys = ["sql_query", "sql_summary", "expected_answer_type"]
        if not all(key in result for key in required_keys):
            return {"status": "ERROR", "error_details": f"Response missing required keys. Got: {list(result.keys())}"}

        # Validate expected_answer_type
        valid_answer_types = ["MAP", "TABLE", "SCATTERPLOT"]
        if result["expected_answer_type"] not in valid_answer_types:
            return {"status": "ERROR", "error_details": f"Invalid expected_answer_type: {result['expected_answer_type']}. Must be one of {valid_answer_types}"}

    except json.JSONDecodeError as e:
        return {"status": "ERROR", "error_details": f"Failed to parse JSON response: {str(e)}\nResponse: {response.text}"}

    sql = result["sql_query"]
    logger.debug("bigquery_nl2sql - sql:\n%s", sql)

    # Validate the SQL query
    valid_query, message, _ = validate_bigquery_sql(sql)
    if not valid_query:
        return {"status": "ERROR",
                "error_details": message}

    tool_context.state["sql_query"] = sql

    return {
        "status": "SUCCESS",
        "sql_query": sql,
        "sql_summary": result["sql_summary"],
        "expected_answer_type": result["expected_answer_type"]
    }

def execute_SQL_query(
    sql: str,
    tool_context: ToolContext,
) -> str:
    """Executes a SQL query from a SQL query string.
    Args:
        sql_query: A string of the SQL query you want to do.

    Returns:
        A dictionary with the following keys:
        `status`: "SUCCESS" (query was successful) or "ERROR" (query failed)
        `row_count`: The number of rows returned from this query.
        `acres`(optional): The number of acres returned from this query.
        `error_details`(optional): If there's an error, what caused the error.
    """
    # First, let's validate the provied query is good and safe.
    valid_query, message, _ = validate_bigquery_sql(sql)
    if not valid_query:
        return {"status": "ERROR",
                "error_details": message}

    bigquery_client = get_bigquery_client(
        project=os.getenv('GOOGLE_PROJECT_ID'),
        credentials=None,
        user_agent='a-dummy-agent',
    )
    # Finally execute the query, fetch the result, and return it
    # TODO(david): I don't know what config params we should put in here.
    job_config = bigquery.QueryJobConfig()

    row_iterator = bigquery_client.query_and_wait(
        sql,
        job_config=job_config,
        project=os.getenv('GOOGLE_PROJECT_ID')
    )
    columns = {}
    for field in row_iterator.schema:
        columns[field.name] = []

    # Populate data in column order
    for row in row_iterator:
        for key, val in row.items():
            columns[key].append(val)

    # Store the data in tool_context.state for access in response.
    tool_context.state["data"] = columns

    # Calculate row count
    first_column = next(iter(columns.values())) if columns else []
    row_count = len(first_column)

    # Summarize the results for the natural language model
    # result = {
    #     "status": "SUCCESS",
    #     "random": "TESTING",
    #     "data": columns,  # Include the actual data in the response
    #     "row_count": row_count
    # }

    result = {
        "status": "SUCCESS",
        "random": "TESTING",
    }
    if 'area' in columns.keys():
        result['acres'] = sum(columns['area'])

    return result



