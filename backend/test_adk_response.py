#!/usr/bin/env python3
"""
Test script to call the ADK /run endpoint and print the response structure
"""
import requests
import json
from pprint import pprint

# ADK server configuration
ADK_HOST = "http://localhost:8001"

def test_adk_run_endpoint():
    """Make a request to the ADK /run endpoint and print the response"""

    # Configuration - must match the appName you use in the web app
    app_name = "agents"  # This is the directory name
    user_id = "test-user-123"
    session_id = "test-session-123"

    # Endpoint URLs
    create_session_url = f"{ADK_HOST}/apps/{app_name}/users/{user_id}/sessions"
    run_url = f"{ADK_HOST}/copilot"
    session_url = f"{ADK_HOST}/apps/{app_name}/users/{user_id}/sessions/{session_id}"

    try:
        # STEP 0: Create or ensure session exists
        print("=" * 80)
        print("STEP 0: Creating/checking session...")
        print(f"URL: {create_session_url}")
        print("=" * 80)

        # Try to create a new session
        create_session_payload = {
            "sessionId": session_id,
            "state": {}  # Initial empty state
        }

        session_create_response = requests.post(
            create_session_url,
            json=create_session_payload,
            headers={"Content-Type": "application/json"}
        )

        if session_create_response.status_code in [200, 201]:
            print(f"✓ Session created/exists: {session_id}")
        elif session_create_response.status_code == 409:
            print(f"✓ Session already exists: {session_id}")
        else:
            print(f"Session creation response: {session_create_response.status_code}")
            print(f"Response: {session_create_response.text}")

        # Request payload - correct ADK format
        payload = {
            "appName": app_name,
            "userId": user_id,
            "sessionId": session_id,
            "newMessage": {
                "role": "user",
                "parts": [{"text": "Show me areas with low phosphorus in the north-of-road field"}]
            }
        }

        print("\n" + "=" * 80)
        print("STEP 1: Making request to ADK /run endpoint...")
        print(f"URL: {run_url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print("=" * 80)
        # Make the /run request
        response = requests.post(
            run_url,
            json=payload,
            headers={"Content-Type": "application/json"}
        )

        # Check if request was successful
        response.raise_for_status()

        # Parse response (array of events)
        events = response.json()

        print("\n" + "=" * 80)
        print("EVENTS FROM /run (Array of Event Objects):")
        print("=" * 80)
        pprint(events, depth=None, width=120)

        # Extract agent's text response from events
        print("\n" + "=" * 80)
        print("AGENT'S TEXT RESPONSES:")
        print("=" * 80)
        for i, event in enumerate(events):
            content = event.get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                if "text" in part:
                    print(f"\nEvent {i}: {part['text'][:200]}...")

        # Now fetch the session to get the state
        print("\n" + "=" * 80)
        print("STEP 2: Fetching session state...")
        print(f"URL: {session_url}")
        print("=" * 80)

        session_response = requests.get(session_url)
        session_response.raise_for_status()
        session_data = session_response.json()

        print("\n" + "=" * 80)
        print("FULL SESSION DATA:")
        print("=" * 80)
        pprint(session_data, depth=None, width=120)

        # Access session state
        session_state = session_data.get("state", {})
        print("\n" + "=" * 80)
        print("SESSION STATE (tool_context.state):")
        print("=" * 80)
        print(f"State Keys: {list(session_state.keys())}")
        pprint(session_state, width=120)

        # Access data if it exists
        data = session_state.get("data")
        if data:
            print(f"\n✓ Found data in state with {len(data)} columns")
            print(f"  Columns: {list(data.keys())}")
        else:
            print("\n✗ data not found in state")

        # Access SQL query if it exists
        sql_query = session_state.get("sql_query")
        if sql_query:
            print(f"\n✓ Found SQL query in state:")
            print(f"  {sql_query}")

        print("\n" + "=" * 80)

    except requests.exceptions.ConnectionError:
        print(f"\n✗ ERROR: Could not connect to ADK server at {ADK_HOST}")
        print("Make sure the ADK server is running!")
        print("\nTo start the ADK server, run:")
        print("  cd backend/agents")
        print("  adk start")

    except requests.exceptions.HTTPError as e:
        print(f"\n✗ HTTP Error: {e}")
        print(f"Response: {e.response.text}")

    except Exception as e:
        print(f"\n✗ Error: {e}")

if __name__ == "__main__":
    test_adk_run_endpoint()
