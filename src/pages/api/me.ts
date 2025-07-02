export default function handler(req, res) {
  // Simulação. Substitua por lógica real de sessão (Entra ID, JWT, etc.)
  const fakeUser = {
    userId: "u123",
    email: "rh@empresa.pt",
    groups: ["0062979c-c927-4f32-876a-0a2bd0f28328"], // grupo RH
  };
  res.status(200).json(fakeUser);
} 