import { ImageResponse } from "next/og";

// Ícono: fondo tinta y las dos barras de colores (una por persona).
export function renderIcon(size: number, padded = false) {
  const inset = padded ? size * 0.12 : 0;
  const bar = { height: size * 0.11, borderRadius: size * 0.06 };
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", background: "#18201d", padding: inset }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: size * 0.07,
            padding: size * 0.2,
          }}
        >
          <div style={{ ...bar, width: "78%", background: "#5b7cff" }} />
          <div style={{ ...bar, width: "100%", background: "#f08a3a" }} />
          <div style={{ ...bar, width: "52%", background: "#eef0ec" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
