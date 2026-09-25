export const pbConfiguratorStatusTag = "pb-configurator-status";

export type ConfiguratorLifecycleStatus = "new" | "active" | "inactive";

const labelByValue: Record<ConfiguratorLifecycleStatus, string> = {
  new: "Draft",
  active: "Active",
  inactive: "Inactive",
};

export const formatConfiguratorLifecycleStatus = (value: ConfiguratorLifecycleStatus): string =>
  labelByValue[value];

const isLifecycleStatus = (value: string | null): value is ConfiguratorLifecycleStatus =>
  value === "new" || value === "active" || value === "inactive";

class PbConfiguratorStatusElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["value"];
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const value = this.getAttribute("value");
    if (!isLifecycleStatus(value)) {
      this.className = "configurator-status";
      this.textContent = "";
      return;
    }

    this.className = `configurator-status configurator-status--${value}`;
    this.textContent = labelByValue[value];
  }
}

export const registerPbConfiguratorStatus = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorStatusTag)) {
    customElements.define(pbConfiguratorStatusTag, PbConfiguratorStatusElement);
  }
};

registerPbConfiguratorStatus();
