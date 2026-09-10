export const pbSideMenuTag = "pb-side-menu";

type SideMenuMode = "workout" | "configurator";

type SideMenuScreen =
  | "workout"
  | "configurator-overview"
  | "configurator-load-profiles"
  | "configurator-gyms"
  | "configurator-exercises"
  | "progress"
  | "exercises"
  | "training-plans"
  | "gyms"
  | "history"
  | "settings"
  | "about";

type SideMenuAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-configurator-overview"
  | "navigate-configurator-load-profiles"
  | "navigate-configurator-gyms"
  | "navigate-configurator-exercises"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

type SideMenuEntry = {
  label: string;
  action: SideMenuAction | null;
  screen?: SideMenuScreen;
  emphasis?: "main-workout";
};

const sideMenuScreens: SideMenuScreen[] = [
  "workout",
  "configurator-overview",
  "configurator-load-profiles",
  "configurator-gyms",
  "configurator-exercises",
  "progress",
  "exercises",
  "training-plans",
  "gyms",
  "history",
  "settings",
  "about",
];

const workoutEntry: SideMenuEntry = {
  screen: "workout",
  label: "Workout",
  action: "navigate-workout",
  emphasis: "main-workout",
};

const configuratorEntry: SideMenuEntry = {
  screen: "configurator-overview",
  label: "Configurator",
  action: "navigate-configurator-overview",
};

const mainNavigationEntries: SideMenuEntry[] = [
  {
    screen: "progress",
    label: "Progress",
    action: "navigate-progress",
  },
  { screen: "history", label: "History", action: "navigate-history" },
  {
    screen: "exercises",
    label: "Exercises",
    action: "navigate-exercises",
  },
  {
    screen: "training-plans",
    label: "Training Plans",
    action: "navigate-training-plans",
  },
  { screen: "gyms", label: "Gyms", action: "navigate-gyms" },
];

const configuratorReturnEntry: SideMenuEntry = {
  screen: "workout",
  label: "Back to Workout",
  action: "navigate-workout",
};

const configuratorNavigationEntries: SideMenuEntry[] = [
  {
    screen: "configurator-load-profiles",
    label: "Load Profiles",
    action: "navigate-configurator-load-profiles",
  },
  {
    screen: "configurator-exercises",
    label: "Exercises",
    action: "navigate-configurator-exercises",
  },
  {
    screen: "configurator-gyms",
    label: "Gyms",
    action: "navigate-configurator-gyms",
  },
];

const utilityEntries: SideMenuEntry[] = [
  { screen: "settings", label: "Settings", action: "navigate-settings" },
  { screen: "about", label: "About", action: "navigate-about" },
  { screen: "workout", label: "Log out", action: "logout" },
];

const resolveActiveScreen = (value: string | null): SideMenuScreen =>
  sideMenuScreens.includes(value as SideMenuScreen)
    ? (value as SideMenuScreen)
    : "workout";

const resolveMode = (value: string | null): SideMenuMode =>
  value === "configurator" ? "configurator" : "workout";

const resolveAction = (
  entry: SideMenuEntry,
  activeScreen: SideMenuScreen,
): SideMenuAction | null =>
  entry.action === null
    ? null
    : entry.action === "logout"
      ? "logout"
      : entry.screen === activeScreen
        ? "close-side-menu"
        : entry.action;

const renderEntry = (
  entry: SideMenuEntry,
  activeScreen: SideMenuScreen,
  group: "primary" | "middle" | "utility",
): string => {
  const isLogout = entry.action === "logout";
  const action = resolveAction(entry, activeScreen);
  const itemClass = `side-menu-item side-menu-item--${group}`;
  const entryClass = [
    "side-menu-entry",
    `side-menu-entry--${group}`,
    entry.emphasis === "main-workout"
      ? "side-menu-entry--main-workout"
      : "",
    action === null ? "side-menu-entry--placeholder" : "",
    isLogout ? "side-menu-entry--logout" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const actionAttribute = action ? ` data-ui-action="${action}"` : "";
  const disabledAttribute = action ? "" : " disabled";

  return `
    <li class="${itemClass}" data-menu-group="${group}">
      <button type="button" class="${entryClass}"${actionAttribute}${disabledAttribute}>
        ${entry.label}
      </button>
    </li>
  `;
};

const renderEntries = (
  entries: SideMenuEntry[],
  activeScreen: SideMenuScreen,
  group: "primary" | "middle" | "utility",
): string => entries.map((entry) => renderEntry(entry, activeScreen, group)).join("");

const renderDivider = (): string =>
  '<li class="side-menu-divider" role="presentation"></li>';

const renderSideMenuList = (
  mode: SideMenuMode,
  activeScreen: SideMenuScreen,
): string => {
  const entries =
    mode === "configurator"
      ? [
          renderEntries([configuratorReturnEntry], activeScreen, "primary"),
          renderDivider(),
          renderEntries(configuratorNavigationEntries, activeScreen, "middle"),
        ]
      : [
          renderEntries([workoutEntry], activeScreen, "primary"),
          renderEntries(mainNavigationEntries, activeScreen, "middle"),
          renderDivider(),
          renderEntries([configuratorEntry], activeScreen, "middle"),
          renderDivider(),
          renderEntries(utilityEntries, activeScreen, "utility"),
        ];

  return `
    <ul class="side-menu-list">
      ${entries.join("")}
    </ul>
  `;
};

class PbSideMenuElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["active-screen", "menu-id", "mode"];
  }

  #isOpen = false;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.#render();
    }
  }

  #setOpen(nextOpen: boolean): void {
    if (this.#isOpen === nextOpen) {
      return;
    }

    this.#isOpen = nextOpen;
    this.#render();
    this.#syncOutsideClickListener();
  }

  #onGlobalPointerDown = (event: Event): void => {
    if (!this.#isOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-ui-action="toggle-side-menu"]')) {
      return;
    }

    if (target.closest(".side-menu-panel")) {
      return;
    }

    this.#setOpen(false);
  };

  #syncOutsideClickListener(): void {
    if (this.#isOpen && this.isConnected) {
      window.addEventListener("pointerdown", this.#onGlobalPointerDown, true);
      return;
    }

    window.removeEventListener("pointerdown", this.#onGlobalPointerDown, true);
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    event.stopPropagation();

    const action = actionElement.dataset.uiAction as SideMenuAction | undefined;
    if (!action) {
      return;
    }

    if (action === "toggle-side-menu") {
      this.#setOpen(!this.#isOpen);
      return;
    }

    this.#setOpen(false);
    if (action === "close-side-menu") {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.#isOpen) {
      return;
    }

    event.preventDefault();
    this.#setOpen(false);
  };

  #render(): void {
    const mode = resolveMode(this.getAttribute("mode"));
    const activeScreen = resolveActiveScreen(
      this.getAttribute("active-screen"),
    );
    const menuId = this.getAttribute("menu-id")?.trim() || "app-side-menu";
    const sideMenuOpenClass = this.#isOpen ? " is-open" : "";
    const toggleLabel = this.#isOpen
      ? "Close navigation menu"
      : "Open navigation menu";

    this.innerHTML = `
      <button
        type="button"
        class="side-menu-toggle"
        data-ui-action="toggle-side-menu"
        aria-label="${toggleLabel}"
        aria-expanded="${this.#isOpen ? "true" : "false"}"
        aria-controls="${menuId}"
      >
        <span class="side-menu-toggle-lines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      <div class="side-menu-shell${sideMenuOpenClass}" aria-hidden="${this.#isOpen ? "false" : "true"}">
        <div class="side-menu-backdrop" role="presentation"></div>
        <nav class="side-menu-panel" id="${menuId}" aria-label="Main navigation">
          <p class="side-menu-title">${mode === "configurator" ? "Configurator" : "Navigation"}</p>
          ${renderSideMenuList(mode, activeScreen)}
        </nav>
      </div>
    `;
  }
}

export const registerPbSideMenu = (): void => {
  if (
    typeof customElements !== "undefined" &&
    !customElements.get(pbSideMenuTag)
  ) {
    customElements.define(pbSideMenuTag, PbSideMenuElement);
  }
};

registerPbSideMenu();
