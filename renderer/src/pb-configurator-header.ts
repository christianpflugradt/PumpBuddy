export const pbConfiguratorHeaderTag = "pb-configurator-header";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class PbConfiguratorHeaderElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["title", "context", "banner"];
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const title = this.getAttribute("title") ?? "";
    const context = this.getAttribute("context");
    const banner = this.hasAttribute("banner")
      ? '<img class="configurator-header-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />'
      : "";

    this.innerHTML = `<header class="configurator-header">${banner}<h1 class="configurator-header-title">${escapeHtml(title)}</h1>${context ? `<p class="configurator-header-context">${escapeHtml(context)}</p>` : ""}</header>`;
  }
}

export const registerPbConfiguratorHeader = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorHeaderTag)) {
    customElements.define(pbConfiguratorHeaderTag, PbConfiguratorHeaderElement);
  }
};

registerPbConfiguratorHeader();
