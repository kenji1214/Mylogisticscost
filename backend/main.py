from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import boto3
import os
import requests
from jose import jwt, JWTError

# =============================================================================
# Cognito configuration
# =============================================================================
COGNITO_REGION = "eu-west-1"
USER_POOL_ID = "eu-west-1_RMy8gKhyN"
APP_CLIENT_ID = "oj5ptoit1vb9q8b8roeotd9d3"

COGNITO_ISSUER = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}"
)
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

security = HTTPBearer()

# =============================================================================
# JWKS cache
# =============================================================================
_JWKS = None

def get_jwks():
    global _JWKS
    if _JWKS is None:
        resp = requests.get(JWKS_URL, timeout=5)
        resp.raise_for_status()
        _JWKS = resp.json()["keys"]
    return _JWKS

# =============================================================================
# JWT verification (ACCESS TOKEN)
# =============================================================================
def verify_jwt(
    creds: HTTPAuthorizationCredentials = Depends(security),
):
    token = creds.credentials

    try:
        header = jwt.get_unverified_header(token)
        jwks = get_jwks()
        key = next(k for k in jwks if k["kid"] == header["kid"])

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=COGNITO_ISSUER,
            options={"verify_aud": False},
        )

        if payload.get("token_use") != "access":
            raise HTTPException(status_code=401, detail="Not an access token")

        if payload.get("client_id") != APP_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Invalid client_id")

        return payload

    except StopIteration:
        raise HTTPException(status_code=401, detail="Invalid token key")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# =============================================================================
# DynamoDB (AWS – App Runner)
# =============================================================================
AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")
TABLE_NAME = os.getenv("TABLE_NAME", "LogisticsCost")

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION,
)

table = dynamodb.Table(TABLE_NAME)

# =============================================================================
# FastAPI app
# =============================================================================
app = FastAPI(title="Logistics Cost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)

# =============================================================================
# Models
# =============================================================================
class Cost(BaseModel):
    CostID: str
    Amount: float
    Description: Optional[str] = ""
    CreatedAt: Optional[str] = None
    UpdatedAt: Optional[str] = None

# =============================================================================
# Helpers
# =============================================================================
def now_iso() -> str:
    return datetime.utcnow().isoformat()

# =============================================================================
# Health
# =============================================================================
@app.get("/health")
def health():
    return {"health": "green"}

# =============================================================================
# API
# =============================================================================
@app.get("/api/cost", response_model=List[Cost])
def list_costs(user=Depends(verify_jwt)):
    items = table.scan().get("Items", [])
    return [
        {
            "CostID": i["CostID"],
            "Amount": float(i["Amount"]),
            "Description": i.get("Description", ""),
            "CreatedAt": i.get("CreatedAt"),
            "UpdatedAt": i.get("UpdatedAt"),
        }
        for i in items
    ]

@app.post("/api/cost", response_model=Cost)
def create_cost(cost: Cost, user=Depends(verify_jwt)):
    ts = now_iso()

    table.put_item(
        Item={
            "CostID": cost.CostID,
            "Amount": Decimal(str(cost.Amount)),
            "Description": cost.Description or "",
            "CreatedAt": ts,
            "UpdatedAt": ts,
        }
    )

    return {
        "CostID": cost.CostID,
        "Amount": cost.Amount,
        "Description": cost.Description or "",
        "CreatedAt": ts,
        "UpdatedAt": ts,
    }

@app.put("/api/cost/{cost_id}", response_model=Cost)
def update_cost(cost_id: str, cost: Cost, user=Depends(verify_jwt)):
    ts = now_iso()

    table.update_item(
        Key={"CostID": cost_id},
        UpdateExpression="SET Amount=:a, Description=:d, UpdatedAt=:u",
        ExpressionAttributeValues={
            ":a": Decimal(str(cost.Amount)),
            ":d": cost.Description or "",
            ":u": ts,
        },
    )

    return {
        "CostID": cost_id,
        "Amount": cost.Amount,
        "Description": cost.Description or "",
        "UpdatedAt": ts,
    }

@app.delete("/api/cost/{cost_id}")
def delete_cost(cost_id: str, user=Depends(verify_jwt)):
    table.delete_item(Key={"CostID": cost_id})
    return {"deleted": cost_id}