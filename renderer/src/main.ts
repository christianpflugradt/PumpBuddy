import "./styles.css";
import { createApp } from "./app";

const app = document.querySelector<HTMLElement>(".app");

if (!app) {
  throw new Error("Missing .app container");
}
createApp(app);
