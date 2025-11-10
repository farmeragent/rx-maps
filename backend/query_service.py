"""
Natural Language to SQL query service using Claude
"""
import os
import re
from typing import Dict, List, Any, Optional
from anthropic import Anthropic
from database import get_db


class QueryService:
    def __init__(self):
        """Initialize Claude client and database"""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=api_key)
        self.db = get_db()
        self.conversation_history = []

    def _build_system_prompt(self) -> str:
        """Build system prompt with database schema"""
        schema_info = self.db.get_schema_info()
        stats = schema_info['stats']

        # Build column descriptions from rich metadata
        columns_desc = []
        for col in schema_info.get('columns', []):
            col_info = f"  - {col['name']} ({col.get('type', 'VARCHAR')})"
            if 'description' in col:
                col_info += f": {col['description']}"
            if 'unit' in col:
                col_info += f" [{col['unit']}]"
            if 'thresholds' in col:
                thresholds = col['thresholds']
                col_info += f"\n    Thresholds: Low {thresholds.get('low', '')}, Medium {thresholds.get('medium', '')}, High {thresholds.get('high', '')}"
            if 'notes' in col:
                col_info += f"\n    Note: {col['notes']}"
            columns_desc.append(col_info)

        columns_text = "\n".join(columns_desc)

        # Build query hints section
        query_hints = schema_info.get('query_hints', [])
        hints_text = "\n".join([f"{i+1}. {hint}" for i, hint in enumerate(query_hints)])

        # Build domain knowledge section
        domain_knowledge = schema_info.get('domain_knowledge', [])
        domain_text = "\n".join([f"- {fact}" for fact in domain_knowledge])

        # Get field names
        field_names = schema_info.get('field_names', [])
        field_names_text = ", ".join([f"'{name}'" for name in field_names]) if field_names else "No fields defined"

        # Build the prompt
        prompt = f"""You are a SQL query generator for an agricultural database. Your job is to convert user questions into valid DuckDB SQL queries.

Database: {schema_info.get('description', 'Agricultural hex data')}

Table: {schema_info['table_name']}

Columns:
{columns_text}

Database Statistics:
- Total hexes: {stats['total_hexes']:,}
- Yield range: {stats['min_yield']} - {stats['max_yield']} bu/ac
- Average P in soil: {stats['avg_P']} ppm
- Average K in soil: {stats['avg_K']} ppm
- Average N in soil: {stats['avg_N']} ppm

Valid Field Names (use EXACTLY as shown):
{field_names_text}
"""

        if hints_text:
            prompt += f"\nQuery Guidelines:\n{hints_text}\n"

        if domain_text:
            prompt += f"\nDomain Knowledge:\n{domain_text}\n"

        prompt += """
Important Rules:
- ALWAYS include h3_index in SELECT when showing/finding specific hexes (needed for map highlighting)
- ALWAYS include field_name in SELECT when showing/finding specific hexes (needed for field identification)
- Use EXACT field names from the Valid Field Names list above - do not modify or guess field names
- When using aggregations with aliases, preserve the base column name in the alias (e.g., SUM(N_to_apply) as total_N_to_apply, AVG(P_in_soil) as avg_P_in_soil)
- Return ONLY the SQL query, no explanations or markdown code blocks
- Use proper DuckDB SQL syntax
- Use ROUND() for decimal values in aggregations
- When comparing fields, use GROUP BY field_name

Understanding Rates vs Totals:
- Columns with "per acre" units (N_to_apply, P_to_apply, K_to_apply, P_in_soil, K_in_soil, N_in_soil) are APPLICATION RATES or CONCENTRATIONS
- Farmers think in RATES (lbs per acre) by default - this is how they apply fertilizer
- When a farmer asks "how much nitrogen do I need?" they mean the application RATE (lbs/acre): use AVG(rate)
- Only calculate TOTALS when the user explicitly asks for "total pounds", "total lbs", "how many pounds total", etc.: use SUM(rate * area)
- To calculate AVERAGES of rates, just average directly: AVG(rate) - do NOT multiply by area
- Each hex has an 'area' column representing its size in acres

Example Queries:
- "Show hexes with low phosphorus" → SELECT h3_index, field_name, P_in_soil FROM agricultural_hexes WHERE P_in_soil < 60
- "Which field has the lowest phosphorus?" → SELECT field_name, ROUND(AVG(P_in_soil), 2) as avg_P_in_soil FROM agricultural_hexes GROUP BY field_name ORDER BY avg_P_in_soil ASC LIMIT 1
- "Compare fields by average phosphorus" → SELECT field_name, ROUND(AVG(P_in_soil), 2) as avg_P_in_soil FROM agricultural_hexes GROUP BY field_name ORDER BY avg_P_in_soil
- "How much nitrogen do I need?" → SELECT ROUND(AVG(N_to_apply), 2) as avg_N_to_apply FROM agricultural_hexes (returns rate in lbs/acre)
- "How much nitrogen per field?" → SELECT field_name, ROUND(AVG(N_to_apply), 2) as avg_N_to_apply FROM agricultural_hexes GROUP BY field_name (returns rate in lbs/acre)
- "How many total pounds of nitrogen?" → SELECT ROUND(SUM(N_to_apply * area), 2) as total_N_lbs FROM agricultural_hexes (returns total lbs)
- "Total fertilizer needed per field?" → SELECT field_name, ROUND(SUM(N_to_apply * area), 2) as total_N_lbs, ROUND(SUM(P_to_apply * area), 2) as total_P_lbs, ROUND(SUM(K_to_apply * area), 2) as total_K_lbs FROM agricultural_hexes GROUP BY field_name

Return only valid SQL. Do not include markdown code blocks or explanations."""

        return prompt

    def _extract_sql(self, response: str) -> str:
        """Extract SQL from Claude's response, handling markdown code blocks"""
        # Remove markdown code blocks if present
        sql = response.strip()

        # Check for SQL code block
        if "```sql" in sql:
            match = re.search(r"```sql\s*(.*?)\s*```", sql, re.DOTALL)
            if match:
                sql = match.group(1)
        elif "```" in sql:
            match = re.search(r"```\s*(.*?)\s*```", sql, re.DOTALL)
            if match:
                sql = match.group(1)

        return sql.strip()

    def natural_language_to_sql(self, question: str, conversation_context: bool = False) -> str:
        """
        Convert natural language question to SQL using Claude

        Args:
            question: User's natural language question
            conversation_context: Whether to include conversation history

        Returns:
            SQL query string
        """
        messages = []

        # Add conversation history if requested
        if conversation_context and self.conversation_history:
            messages.extend(self.conversation_history[-6:])  # Last 3 exchanges

        # Add current question
        messages.append({
            "role": "user",
            "content": question
        })

        try:
            response = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=1024,
                system=self._build_system_prompt(),
                messages=messages
            )

            sql = self._extract_sql(response.content[0].text)

            # Update conversation history
            self.conversation_history.append({
                "role": "user",
                "content": question
            })
            self.conversation_history.append({
                "role": "assistant",
                "content": sql
            })

            return sql

        except Exception as e:
            raise Exception(f"Failed to generate SQL: {str(e)}")

    def _detect_intent(self, question: str) -> Dict[str, Any]:
        """
        Detect user intent - whether they want a query or a prescription map

        Args:
            question: User's natural language question

        Returns:
            Dictionary with intent and extracted parameters
        """
        # Get valid field names from schema
        schema_info = self.db.get_schema_info()
        field_names = schema_info.get('field_names', [])
        field_names_text = ", ".join([f"'{name}'" for name in field_names]) if field_names else "No fields defined"

        intent_prompt = f"""You are analyzing user requests to determine their intent.

Classify the user's request into one of these categories:

1. "prescription_map" - User wants to create a prescription map, variable rate application map, or rx map
   Examples: "create a prescription map", "generate rx map", "make me a prescription", "variable rate application"

2. "query" - User wants to query/search/analyze data
   Examples: "show me hexes with low P", "what's the average yield", "find areas that need fertilizer"

Valid Field Names (use EXACTLY as shown if mentioned):
{field_names_text}

Respond in this exact format:
INTENT: <prescription_map or query>
FIELD: <exact field name if mentioned, otherwise "all">

Important: If the user mentions a field, use the EXACT field name from the valid list above. Match it case-insensitively but return the exact capitalization.

User request: """

        try:
            response = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=256,
                messages=[{
                    "role": "user",
                    "content": intent_prompt + question
                }]
            )

            response_text = response.content[0].text.strip()

            # Parse response
            intent = "query"  # default
            field_name = None

            for line in response_text.split('\n'):
                if line.startswith('INTENT:'):
                    intent = line.split(':', 1)[1].strip()
                elif line.startswith('FIELD:'):
                    field_value = line.split(':', 1)[1].strip()
                    # Accept any field value that's not 'all', 'none', or empty
                    if field_value.lower() not in ['all', 'none', '']:
                        field_name = field_value

            return {
                "intent": intent,
                "field_name": field_name
            }

        except Exception as e:
            # Default to query on error
            return {
                "intent": "query",
                "field_name": None
            }

    def execute_natural_language_query(self, question: str) -> Dict[str, Any]:
        """
        Execute a natural language query end-to-end

        Args:
            question: User's natural language question

        Returns:
            Dictionary with query results and metadata
        """
        # First, detect the intent
        intent_info = self._detect_intent(question)

        # If user wants a prescription map, return that intent
        if intent_info["intent"] == "prescription_map":
            return {
                "question": question,
                "intent": "prescription_map",
                "field_name": intent_info["field_name"] or "North of Road",
                "sql": None,
                "results": [],
                "hex_ids": [],
                "count": 0,
                "summary": "I'll create a prescription map for you. This will generate variable rate application maps for nitrogen, phosphorus, and potassium."
            }

        # Otherwise, continue with normal SQL query flow
        # Generate SQL from natural language
        sql = self.natural_language_to_sql(question)

        # Validate SQL
        self.db.validate_sql(sql)

        # Execute query
        results = self.db.execute_query(sql)

        # Extract h3_indexes if present (for map highlighting)
        hex_ids = []
        if results and 'h3_index' in results[0]:
            hex_ids = [row['h3_index'] for row in results]

        # Generate summary
        summary = self._generate_summary(question, results, sql)

        # Determine which view to use
        view_type = self._determine_view_type(results)

        # Get column metadata for display
        column_metadata = {}
        if results and len(results) > 0:
            column_names = list(results[0].keys())
            column_metadata = self._get_column_metadata(column_names)

        # Extract field name if query is focused on a single field
        field_name = None
        if results and len(results) > 0 and 'field_name' in results[0]:
            # Check if all results have the same field_name
            unique_fields = set(row['field_name'] for row in results if 'field_name' in row)
            if len(unique_fields) == 1:
                field_name = list(unique_fields)[0]

        return {
            "question": question,
            "intent": "query",
            "field_name": field_name,
            "sql": sql,
            "results": results,
            "hex_ids": hex_ids,
            "count": len(results),
            "summary": summary,
            "view_type": view_type,
            "column_metadata": column_metadata
        }

    def _calculate_acreage(self, hex_count: int) -> float:
        """
        Calculate acreage from hex count
        H3 resolution 10 hexagons are approximately 0.015 km² each
        1 km² = 247.105 acres
        """
        km_per_hex = 0.015
        acres_per_km = 247.105
        return hex_count * km_per_hex * acres_per_km

    def _generate_natural_language_summary(self, question: str, sql: str, results: List[Dict], hex_count: int) -> str:
        """
        Generate a simple summary for hex query results

        Args:
            question: User's original question
            sql: Generated SQL query
            results: Query results (may be empty for hex queries)
            hex_count: Number of hexes returned

        Returns:
            Natural language summary string
        """
        # Calculate acreage if we have hexes
        acreage = self._calculate_acreage(hex_count) if hex_count > 0 else 0

        # Simple summary without Claude API call
        if acreage > 0:
            return f"I found {hex_count:,} hexes covering {acreage:,.2f} acres matching your query."
        else:
            return f"I found {hex_count:,} hexes matching your query."

    def _get_column_metadata(self, column_names: List[str]) -> Dict[str, Dict[str, str]]:
        """
        Get display metadata for columns based on schema config

        Args:
            column_names: List of column names from query results

        Returns:
            Dictionary mapping column names to their metadata (display_name, unit)
        """
        schema_info = self.db.get_schema_info()
        columns_config = schema_info.get('columns', [])

        metadata = {}
        for col_name in column_names:
            # First try exact match
            col_config = next((c for c in columns_config if c['name'] == col_name), None)

            # If no exact match, try stripping common aggregation prefixes
            prefix_used = None
            if not col_config:
                # Common SQL aggregation/calculation prefixes
                prefixes = ['total_', 'avg_', 'average_', 'sum_', 'min_', 'max_', 'count_']
                base_name = col_name
                for prefix in prefixes:
                    if col_name.startswith(prefix):
                        base_name = col_name[len(prefix):]
                        prefix_used = prefix.rstrip('_').title()  # "total_" -> "Total"
                        break

                # Try to find base column after stripping prefix
                if base_name != col_name:
                    col_config = next((c for c in columns_config if c['name'] == base_name), None)

            if col_config:
                base_display_name = col_config.get('display_name', col_name.replace('_', ' ').title())
                # If we stripped a prefix, add it back to the display name
                display_name = f"{prefix_used} {base_display_name}" if prefix_used else base_display_name

                col_metadata = {
                    'display_name': display_name
                }
                if 'unit' in col_config:
                    col_metadata['unit'] = col_config['unit']
                metadata[col_name] = col_metadata
            else:
                # Fallback: convert snake_case to Title Case
                metadata[col_name] = {
                    'display_name': col_name.replace('_', ' ').title()
                }

        return metadata

    def _determine_view_type(self, results: List[Dict]) -> Optional[str]:
        """
        Determine the best view based on result structure

        Rules:
        1. If results contain h3_index → spatial data → map
        2. If multiple rows → comparison/list → table
        3. Otherwise → None (display in chat only)

        Returns:
            'map', 'table', or None
        """
        if not results:
            return None

        # Check for spatial data
        if 'h3_index' in results[0]:
            return 'map'

        # Check for multiple rows (comparison/list/aggregation)
        if len(results) > 1:
            return 'table'

        # Single value → no special view needed
        return None

    def _generate_summary(self, question: str, results: List[Dict], sql: str) -> str:
        """Generate a human-readable summary of query results"""
        if not results:
            return "No results found for your query."

        count = len(results)

        # Check if it's a simple count query
        if len(results) == 1 and len(results[0]) == 1:
            key = list(results[0].keys())[0]
            value = results[0][key]
            return f"Result: {value:,}" if isinstance(value, (int, float)) else f"Result: {value}"

        # Check if query returns hex_ids (for highlighting) - use natural language
        if 'h3_index' in results[0]:
            return self._generate_natural_language_summary(question, sql, results, count)

        # For aggregation queries
        if count == 1:
            parts = []
            for key, value in results[0].items():
                if isinstance(value, (int, float)):
                    parts.append(f"{key}: {value:,.2f}")
                else:
                    parts.append(f"{key}: {value}")
            return " | ".join(parts)

        # Default
        return f"Query returned {count:,} results."

    def clear_history(self):
        """Clear conversation history"""
        self.conversation_history = []
