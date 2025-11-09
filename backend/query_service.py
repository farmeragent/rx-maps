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
- Use EXACT field names from the Valid Field Names list above - do not modify or guess field names
- Return ONLY the SQL query, no explanations or markdown code blocks
- Use proper DuckDB SQL syntax
- Use ROUND() for decimal values in aggregations
- When comparing fields, use GROUP BY field_name

Example Queries:
- "Show hexes with low phosphorus" → SELECT h3_index, field_name, P_in_soil FROM agricultural_hexes WHERE P_in_soil < 60
- "Which field has the lowest phosphorus?" → SELECT field_name, ROUND(AVG(P_in_soil), 2) as avg_P FROM agricultural_hexes GROUP BY field_name ORDER BY avg_P ASC LIMIT 1
- "Compare fields by average phosphorus" → SELECT field_name, ROUND(AVG(P_in_soil), 2) as avg_P FROM agricultural_hexes GROUP BY field_name ORDER BY avg_P

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
        intent_prompt = """You are analyzing user requests to determine their intent.

Classify the user's request into one of these categories:

1. "prescription_map" - User wants to create a prescription map, variable rate application map, or rx map
   Examples: "create a prescription map", "generate rx map", "make me a prescription", "variable rate application"

2. "query" - User wants to query/search/analyze data
   Examples: "show me hexes with low P", "what's the average yield", "find areas that need fertilizer"

Respond in this exact format:
INTENT: <prescription_map or query>
FIELD: <field name if mentioned, otherwise "all">

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

        return {
            "question": question,
            "intent": "query",
            "sql": sql,
            "results": results,
            "hex_ids": hex_ids,
            "count": len(results),
            "summary": summary,
            "view_type": view_type
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
        Generate a personable, natural language summary using Claude

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

        # Build context for Claude
        context = f"""User asked: "{question}"

SQL query executed: {sql}

Results: {hex_count} hexes found"""

        if acreage > 0:
            context += f"\nAcreage: {acreage:.2f} acres"

        # Add sample results if available
        if results and len(results) > 0:
            sample_result = results[0]
            context += f"\nSample result: {sample_result}"

        prompt = f"""{context}

Generate a friendly, conversational summary of these query results.

Requirements:
- Start with "I found" (first person, personable tone)
- Include the acreage when relevant
- Explain what conditions were checked in plain English
- Be specific about threshold values that were used
- Keep it concise (1-2 sentences max)
- Use natural, conversational language

Example style: "I found 2.34 acres where we should apply lime (pH was below 6.0 and calcium was below 1800 lbs per acre)."

Your summary:"""

        try:
            response = self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=256,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            summary = response.content[0].text.strip()
            # Remove quotes if Claude wrapped the response
            if summary.startswith('"') and summary.endswith('"'):
                summary = summary[1:-1]

            return summary

        except Exception as e:
            # Fallback to simple summary if API call fails
            print(f"Failed to generate natural language summary: {str(e)}")
            return f"Found {hex_count:,} hexes matching your query."

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
