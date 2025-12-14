import { useEffect, useMemo, useState } from "react";
import { listCosts, createCost, deleteCost } from "./api";

/* =======================
   Cognito configuration
======================= */
const COGNITO_DOMAIN =
  "https://eu-west-1rmy8gkhyn.auth.eu-west-1.amazoncognito.com";
const CLIENT_ID = "oj5ptoit1vb9q8b8roeotd9d3";
const REDIRECT_URI = "http://localhost:5173";

/* =======================
   Token exchange
======================= */
async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token")
  );
  const [costs, setCosts] = useState([]);
  const [costId, setCostId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  /* =======================
     Handle Cognito redirect
  ======================= */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
  
    // 🚨 prevent double execution
    if (!code || localStorage.getItem("access_token")) return;
  
    async function loginFlow() {
      try {
        const tokens = await exchangeCodeForTokens(code);
  
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("id_token", tokens.id_token);
  
        window.history.replaceState({}, document.title, "/");
        setIsAuthenticated(true);
      } catch (e) {
        console.error("OAuth failed", e);
        setError("Login failed");
      }
    }
  
    loginFlow();
  }, []);

  /* =======================
     API
  ======================= */
  async function refresh() {
    try {
      setError("");
      setCosts(await listCosts());
    } catch (e) {
      console.error(e);
      setError("Failed to load costs");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh();
  }, [isAuthenticated]);

  async function submit(e) {
    e.preventDefault();
    await createCost({
      CostID: costId,
      Amount: Number(amount),
      Description: description,
    });
    setCostId("");
    setAmount("");
    setDescription("");
    refresh();
  }

  function login() {
    window.location.href =
      `${COGNITO_DOMAIN}/login` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&scope=openid+email+profile` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  }

  function logout() {
    localStorage.clear();
    setIsAuthenticated(false);
    window.location.href =
      `${COGNITO_DOMAIN}/logout` +
      `?client_id=${CLIENT_ID}` +
      `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
  }

  const canSubmit = useMemo(
    () => costId && amount !== "",
    [costId, amount]
  );

  return (
    <div style={{ padding: 40 }}>
      <h1>Logistics Cost</h1>

      {isAuthenticated ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={login}>Login</button>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {isAuthenticated && (
        <>
          <form onSubmit={submit}>
            <input
              placeholder="CostID"
              value={costId}
              onChange={(e) => setCostId(e.target.value)}
            />
            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button disabled={!canSubmit}>Add</button>
          </form>

          <ul>
            {costs.map((c) => (
              <li key={c.CostID}>
                {c.CostID} — {c.Amount} — {c.Description}
                <button onClick={() => deleteCost(c.CostID).then(refresh)}>
                  ❌
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}