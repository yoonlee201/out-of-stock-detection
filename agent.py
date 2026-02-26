import json
import openai
import psycopg2
from psycopg2 import sql

# Set your OpenAI API key
openai.api_key = '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'

# DB connection (update with db credentials)
DB_PARAMS = {
    'dbname': 'shelf_monitor_db',
    'user': 'your_db_user',
    'password': 'your_db_password',
    'host': 'localhost'
}

def query_db(query, params=None):
    """Run a SQL query and return results."""
    conn = psycopg2.connect(**DB_PARAMS)
    cur = conn.cursor()
    cur.execute(query, params or ())
    results = cur.fetchall()
    cur.close()
    conn.close()
    return results

# Define tools the agent can call (SQL queries)
tools = [
    {
        "type": "function",
        "function": {
            "name": "query_stock",
            "description": "Query product stock levels and details from the DB.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "Name of the product to check."}
                },
                "required": ["product_name"]
            }
        }
    },
    # Add more tools, like "send_alert" or "create_reorder"
]

def handle_tool_call(tool_call):
    """Execute the tool based on agent's request."""
    if tool_call.function.name == "query_stock":
        args = json.loads(tool_call.function.arguments)
        product_name = args['product_name']
        query = sql.SQL("SELECT product_id, quantity_in_store, shelf, aisle FROM products WHERE name = %s")
        results = query_db(query, (product_name,))
        return str(results)  # Return as string for the model
    return "Tool not found."

# Main AI Agent function
def run_ai_agent(input_data):
    """Input: dict like {'missing_product': 'Milk', 'detected_gap': 'large', 'shelf': 'Shelf 1'}
    Output: decision like alert or reorder."""
    messages = [
        {"role": "system", "content": "You are an inventory agent for a grocery store. Analyze shelf detections, query DB if needed, and decide: if stock > 0, send restock alert; if 0, create reorder. Output JSON with action, user_id (assume 1 for now), details."},
        {"role": "user", "content": f"Process this: {input_data}"}
    ]
    
    response = openai.chat.completions.create(
        model="gpt-4o",  # Or gpt-3.5-turbo for cheaper
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )
    
    # If the model wants to call a tool
    if response.choices[0].message.tool_calls:
        tool_call = response.choices[0].message.tool_calls[0]
        tool_result = handle_tool_call(tool_call)
        
        # Send back to model for final decision
        messages.append(response.choices[0].message)
        messages.append({"role": "tool", "content": tool_result, "tool_call_id": tool_call.id})
        
        final_response = openai.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        return final_response.choices[0].message.content
    
    return response.choices[0].message.content

# Example usage (integrate your Flask/YOLO output)
if __name__ == "__main__":
    detection = {'missing_product': 'Milk', 'detected_gap': 'large', 'shelf': 'Shelf 1'}
    decision = run_ai_agent(detection)
    print(decision)  # e.g., '{"action": "reorder", "user_id": 1, "quantity": 20, "product": "Milk"}'
