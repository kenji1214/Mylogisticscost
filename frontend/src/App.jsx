import { useEffect, useMemo, useState } from "react";
import { listCosts, createCost, updateCost, deleteCost } from "./api";
import "./App.css";

/* =======================
   Cognito config
   ======================= */
const COGNITO_DOMAIN =
  "https://eu-west-1rmy8gkhyn.auth.eu-west-1.amazoncognito.com";
const CLIENT_ID = "oj5ptoit1vb9q8b8roeotd9d3";
const REDIRECT_URI = window.location.origin;

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

  if (!res.ok) throw new Error("Token exchange failed");
  return res.json();
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("access_token")
  );

  const [costs, setCosts] = useState([]);
  const [error, setError] = useState("");

  /* Create */
  const [costId, setCostId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  /* Edit */
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");

  /* Login redirect */
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    exchangeCodeForTokens(code)
      .then(tokens => {
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("id_token", tokens.id_token);
        setIsAuthenticated(true);
        window.history.replaceState({}, "", "/");
      })
      .catch(() => setError("Login failed"));
  }, []);

  async function refresh() {
    try {
      setCosts(await listCosts());
    } catch {
      setError("Failed to load costs");
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated]);

  const REDIRECT_URI = window.location.origin;

  function login() {
    const url =
      `${COGNITO_DOMAIN}/login` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&scope=openid+email+profile` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = url;
  }
  
  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("id_token");
  
    const url =
      `${COGNITO_DOMAIN}/logout` +
      `?client_id=${CLIENT_ID}` +
      `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
    window.location.href = url;
  }
  
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

  const canSubmit = useMemo(() => costId && amount, [costId, amount]);

  return (
    <>
      <div className="header">
        <h1>Logistics Cost Management</h1>
        {isAuthenticated ? (
          <button className="button link" onClick={logout}>Logout</button>
        ) : (
          <button className="button primary" onClick={login}>Login</button>
        )}
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        {isAuthenticated && (
          <>
            {/* Create */}
            <div className="card">
              <form className="form-grid" onSubmit={submit}>
                <input placeholder="Cost ID" value={costId} onChange={e => setCostId(e.target.value)} />
                <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
                <input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
                <button className="button primary" disabled={!canSubmit}>Add</button>
              </form>
            </div>

            {/* List */}
            <div className="card list">
              {costs.map(c => (
                <div className="row" key={c.CostID}>
                  <div>{c.CostID}</div>

                  {editingId === c.CostID ? (
                    <>
                      <input value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                      <input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                      <div className="actions">
                        <button
                          className="button primary"
                          onClick={() => {
                            updateCost(c.CostID, {
                              CostID: c.CostID,
                              Amount: Number(editAmount),
                              Description: editDescription,
                            });
                            setEditingId(null);
                            refresh();
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>{c.Amount}</div>
                      <div>{c.Description}</div>
                      <div className="actions">
                        <button
                          className="button link"
                          onClick={() => {
                            setEditingId(c.CostID);
                            setEditAmount(c.Amount);
                            setEditDescription(c.Description);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="button danger"
                          onClick={() => {
                            deleteCost(c.CostID);
                            refresh();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}