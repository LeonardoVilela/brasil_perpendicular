import { createRoot } from "react-dom/client";

function Popup() {
  return <h1>Brasil Perpendicular</h1>;
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Popup />);
}
