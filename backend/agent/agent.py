import json
import os
import openai
from uuid import UUID

from db_ops import (
    get_product_by_name,
    get_products_by_location,
    get_supplier_by_id,
    get_employee_by_user_id,
    insert_reorder,
    insert_alert,
    update_product_quantity,
    log_inventory_change,
)

# OpenAI API key
openai.api_key = os.getenv('OPENAI_API_KEY', '')


tools = [
    {
        "type": "function",
        "function": {
            "name": "query_stock",
            "description": "Return product information and stock status by product_name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "Name of the product to check."}
                },
                "required": ["product_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_supplier",
            "description": "Return supplier data by supplier_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier_id": {"type": "integer", "description": "Supplier ID"}
                },
                "required": ["supplier_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_employee",
            "description": "Return employee details by user_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "description": "User ID"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_reorder",
            "description": "Create a reorder entry in reorders table.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"},
                    "product_id": {"type": "integer"},
                    "quantity": {"type": "integer"}
                },
                "required": ["user_id", "product_id", "quantity"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_alert",
            "description": "Log an alert when stock is low.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"},
                    "product_id": {"type": "integer"},
                    "alert_type": {"type": "string"}
                },
                "required": ["user_id", "product_id", "alert_type"]
            }
        }
    }
]


def handle_tool_call(tool_call):
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    if name == 'query_stock':
        product = get_product_by_name(args['product_name'])
        return json.dumps(product or {})

    if name == 'query_supplier':
        supplier = get_supplier_by_id(args['supplier_id'])
        return json.dumps(supplier or {})

    if name == 'query_employee':
        employee = get_employee_by_user_id(args['user_id'])
        return json.dumps(employee or {})

    if name == 'create_reorder':
        reorder_id = insert_reorder(args['user_id'], args['product_id'], args['quantity'])
        return json.dumps({'reorder_id': reorder_id})

    if name == 'create_alert':
        alert_id = insert_alert(args['user_id'], args['product_id'], args['alert_type'])
        return json.dumps({'alert_id': alert_id})

    return 'Tool not found.'


def run_ai_agent(input_data):
    """Process incoming detection and generate action using DB and OpenAI."""
    messages = [
        {
            'role': 'system',
            'content': (
                'You are an inventory agent for a grocery store. ' 
                'You may call tools to read inventory, create low-stock alerts, and create reorder tasks. '
                'Products are in table products, suppliers in suppliers, employees in employee/users, ' 
                'and you can write to reorders/alerts.'
            )
        },
        {
            'role': 'user',
            'content': f"Received detection: {json.dumps(input_data)}"
        }
    ]

    response = openai.chat.completions.create(
        model='gpt-4o',
        messages=messages,
        tools=tools,
        tool_choice='auto'
    )

    if response.choices and hasattr(response.choices[0].message, 'tool_calls') and response.choices[0].message.tool_calls:
        tool_call = response.choices[0].message.tool_calls[0]
        tool_result = handle_tool_call(tool_call)

        messages.append(response.choices[0].message)
        messages.append({'role': 'tool', 'content': tool_result, 'tool_call_id': tool_call.id})

        final = openai.chat.completions.create(
            model='gpt-4o',
            messages=messages,
        )
        return final.choices[0].message.content

    return response.choices[0].message.content


if __name__ == '__main__':
    detection = {'missing_product': 'Milk', 'detected_gap': 'large', 'shelf': 'Shelf 1', 'aisle': 'A1'}
    decision = run_ai_agent(detection)
    print(decision)
