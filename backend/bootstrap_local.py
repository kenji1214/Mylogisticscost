import boto3

dynamodb = boto3.client(
    "dynamodb",
    endpoint_url="http://localhost:4566",
    region_name="us-east-1",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

TABLE_NAME = "LogisticsCost"

try:
    dynamodb.create_table(
        TableName=TABLE_NAME,
        AttributeDefinitions=[
            {"AttributeName": "CostID", "AttributeType": "S"}
        ],
        KeySchema=[
            {"AttributeName": "CostID", "KeyType": "HASH"}
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    print(f"✅ Table {TABLE_NAME} created")
except dynamodb.exceptions.ResourceInUseException:
    print(f"ℹ️ Table {TABLE_NAME} already exists")