export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#FAF8F4",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        color: "#0D1F3C",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>ONEiD</h1>
      <p style={{ color: "#0B7B8A" }}>One identity. More possibilities.</p>
      <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>
        Scaffold — full UI arrives in Phase 3.
      </p>
    </main>
  );
}
