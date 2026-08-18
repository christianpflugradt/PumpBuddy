import {
  getOrderedSideMenuMiddleScreens,
  normalizeSideMenuMiddleClickCounts,
  type SideMenuMiddleClickCounts,
  type SideMenuMiddleScreen,
} from "./side-menu-preferences";

export const pbSideMenuTag = "pb-side-menu";

type SideMenuMode = "workout" | "configurator";

type SideMenuScreen =
  | "workout"
  | "configurator-load-profiles"
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
  | "navigate-configurator-load-profiles"
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
};

const sideMenuScreens: SideMenuScreen[] = [
  "workout",
  "configurator-load-profiles",
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
};

const configuratorEntry: SideMenuEntry = {
  screen: "configurator-load-profiles",
  label: "Configurator",
  action: "navigate-configurator-load-profiles",
};

const middleEntryByScreen: Record<SideMenuMiddleScreen, SideMenuEntry> = {
  progress: {
    screen: "progress",
    label: "Progress",
    action: "navigate-progress",
  },
  history: { screen: "history", label: "History", action: "navigate-history" },
  exercises: {
    screen: "exercises",
    label: "Exercises",
    action: "navigate-exercises",
  },
  "training-plans": {
    screen: "training-plans",
    label: "Training Plans",
    action: "navigate-training-plans",
  },
  gyms: { screen: "gyms", label: "Gyms", action: "navigate-gyms" },
};

const configuratorPrimaryEntries: SideMenuEntry[] = [
  workoutEntry,
  {
    screen: "configurator-load-profiles",
    label: "Load Profiles",
    action: "navigate-configurator-load-profiles",
  },
];

const configuratorPlaceholderEntries: SideMenuEntry[] = [
  { label: "Exercises (Soon)", action: null },
  { label: "Gyms (Soon)", action: null },
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
  extraItemClass = "",
): string => {
  const isLogout = entry.action === "logout";
  const action = resolveAction(entry, activeScreen);
  const itemClass = `side-menu-item side-menu-item--${group}${extraItemClass}`;
  const entryClass = [
    "side-menu-entry",
    `side-menu-entry--${group}`,
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

const renderSideMenuList = (
  mode: SideMenuMode,
  activeScreen: SideMenuScreen,
  middleEntries: SideMenuEntry[],
): string => {
  const primaryEntries =
    mode === "configurator"
      ? configuratorPrimaryEntries
      : [workoutEntry, configuratorEntry];

  return `
    <ul class="side-menu-list">
      ${primaryEntries
        .map((entry) => renderEntry(entry, activeScreen, "primary"))
        .join("")}
      ${middleEntries.map((entry) => renderEntry(entry, activeScreen, "middle")).join("")}
      ${utilityEntries
        .map((entry, index) =>
          renderEntry(
            entry,
            activeScreen,
            "utility",
            index === 0 ? " side-menu-item--utility-start" : "",
          ),
        )
        .join("")}
    </ul>
  `;
};

class PbSideMenuElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["active-screen", "menu-id", "middle-click-counts", "mode"];
  }

  #isOpen = false;
  #openMiddleEntries: SideMenuEntry[] | null = null;

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

    this.#openMiddleEntries = nextOpen ? this.#resolveMiddleEntries() : null;
    this.#isOpen = nextOpen;
    this.#render();
    this.#syncOutsideClickListener();
  }

  #resolveAttributeMiddleClickCounts(): SideMenuMiddleClickCounts | null {
    const raw = this.getAttribute("middle-click-counts");
    if (raw === null) {
      return null;
    }

    try {
      return normalizeSideMenuMiddleClickCounts(JSON.parse(raw));
    } catch {
      return normalizeSideMenuMiddleClickCounts(null);
    }
  }

  #resolveMiddleClickCounts(): SideMenuMiddleClickCounts {
    const attributeCounts = this.#resolveAttributeMiddleClickCounts();
    if (attributeCounts) {
      return attributeCounts;
    }

    const root = this.closest("pb-app-root") as
      | (HTMLElement & {
          state?: {
            sessionUser?: { sideMenuMiddleClickCounts?: unknown } | null;
          } | null;
        })
      | null;
    return normalizeSideMenuMiddleClickCounts(
      root?.state?.sessionUser?.sideMenuMiddleClickCounts,
    );
  }

  #resolveMiddleEntries(): SideMenuEntry[] {
    if (resolveMode(this.getAttribute("mode")) === "configurator") {
      return configuratorPlaceholderEntries;
    }

    return getOrderedSideMenuMiddleScreens(
      this.#resolveMiddleClickCounts(),
    ).map((screen) => middleEntryByScreen[screen]);
  }

  #currentMiddleEntries(): SideMenuEntry[] {
    if (this.#isOpen) {
      return this.#openMiddleEntries ?? this.#resolveMiddleEntries();
    }

    return this.#resolveMiddleEntries();
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
          ${renderSideMenuList(mode, activeScreen, this.#currentMiddleEntries())}
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
