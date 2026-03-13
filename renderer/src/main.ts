import "./styles.scss";
import { registerAppShell, pumpbuddyAppTag } from "./pumpbuddy-app";

registerAppShell();

const ensureAppShell = (): HTMLElement => {
  const existing = document.querySelector<HTMLElement>(pumpbuddyAppTag);
  if (existing) {
    return existing;
  }

  const created = document.createElement(pumpbuddyAppTag);
  document.body.append(created);
  return created;
};

ensureAppShell();
