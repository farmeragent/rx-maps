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
"""

        if hints_text:
            prompt += f"\nQuery Guidelines:\n{hints_text}\n"

        if domain_text:
            prompt += f"\nDomain Knowledge:\n{domain_text}\n"

        prompt += """
Important Rules:
- ALWAYS include h3_index in SELECT when showing/finding specific hexes (needed for map highlighting)
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

    def execute_natural_language_query(self, question: str) -> Dict[str, Any]:
        """
        Execute a natural language query end-to-end

        Args:
            question: User's natural language question

        Returns:
            Dictionary with query results and metadata
        """
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

        return {
            "question": question,
            "sql": sql,
            "results": results,
            "hex_ids": hex_ids,
            "count": len(results),
            "summary": summary
        }

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

        # Check if query returns hex_ids (for highlighting)
        if 'h3_index' in results[0]:
            return f"Found {count:,} hexes matching your query."

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
