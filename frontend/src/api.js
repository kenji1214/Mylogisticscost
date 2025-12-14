const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  throw new Error("VITE_API_URL is not defined");
}

async function request(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", text);
    throw new Error(text || "API error");
  }

  return res.json();
}

// ✅ FULL paths — no proxy, no fallback
export const listCosts = () => request("/api/cost");

export const createCost = (payload) =>
  request("/api/cost", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCost = (id, payload) =>
  request(`/api/cost/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteCost = (id) =>
  request(`/api/cost/${id}`, {
    method: "DELETE",
  });