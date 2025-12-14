const BASE_URL = import.meta.env.VITE_API_URL || "/api";

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
    throw new Error("API error");
  }

  return res.json();
}

export const listCosts = () => request("/cost");

export const createCost = (payload) =>
  request("/cost", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCost = (id, payload) =>
  request(`/cost/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteCost = (id) =>
  request(`/cost/${id}`, {
    method: "DELETE",
  });