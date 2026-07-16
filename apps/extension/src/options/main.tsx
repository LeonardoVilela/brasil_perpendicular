import { createRoot } from "react-dom/client";

function Options() {
  return <h1>Brasil Perpendicular</h1>;
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Options />);
}
