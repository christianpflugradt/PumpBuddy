import type { AppState } from "./workout-types";
import { selectDefaultGymId } from "./workout-state";

type GetState = () => AppState;
type SetState = (next: AppState) => void;

type Dependencies = {
  getState: GetState;
  setState: SetState;
  render: () => void;
  minEditableMaxLoadKg: number;
  maxEditableMaxLoadKg: number;
};

export const handleSettingsAction = (
  event: Event,
  action: string,
  deps: Dependencies,
): boolean => {
  const { getState, setState, render, minEditableMaxLoadKg, maxEditableMaxLoadKg } = deps;

  switch (action) {
    case "save-display-name": {
      type SaveDisplayNameEventDetail = {
        action: "save-display-name";
        payload?: { displayName?: string };
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      };
      type AuthSessionPatchResponse = {
        authenticated?: boolean;
        user?: {
          id?: string;
          display_name?: string;
          max_load_kg?: number;
          login?: string;
          registration_date?: string;
          favorite_gym_id?: string | null;
        };
      };
      type ErrorResponsePayload = { message?: string };

      const saveEvent = event as CustomEvent<SaveDisplayNameEventDetail>;
      const nextDisplayName = saveEvent.detail?.payload?.displayName?.trim() ?? "";
      event.preventDefault();

      const state = getState();
      if (!state.sessionUser) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "You are not signed in.",
        });
        return true;
      }
      const currentSessionUser = state.sessionUser;

      if (nextDisplayName.length === 0) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "Display name cannot be empty.",
        });
        return true;
      }

      void (async () => {
        try {
          const response = await fetch("/auth/session", {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({ display_name: nextDisplayName }),
          });

          if (!response.ok) {
            let message = "Unable to save display name right now.";
            try {
              const payload = (await response.json()) as ErrorResponsePayload;
              if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                message = payload.message;
              }
            } catch {
              // keep fallback message when error body is not available
            }

            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: message,
            });
            return;
          }

          const payload = (await response.json()) as AuthSessionPatchResponse;
          const user = payload.user;
          const apiDisplayName = user?.display_name?.trim();
          const resolvedDisplayName =
            apiDisplayName && apiDisplayName.length > 0 ? apiDisplayName : nextDisplayName;

          setState({
            ...getState(),
            sessionUser: {
              id:
                typeof user?.id === "string" && user.id.length > 0
                  ? user.id
                  : currentSessionUser.id,
              displayName: resolvedDisplayName,
              maxLoadKg:
                typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
                  ? user.max_load_kg
                  : currentSessionUser.maxLoadKg,
              login:
                typeof user?.login === "string" && user.login.length > 0
                  ? user.login
                  : currentSessionUser.login,
              registrationDate:
                typeof user?.registration_date === "string" && user.registration_date.length > 0
                  ? user.registration_date
                  : currentSessionUser.registrationDate,
              favoriteGymId:
                typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
                  ? user.favorite_gym_id
                  : currentSessionUser.favoriteGymId,
            },
          });
          render();
          saveEvent.detail?.respond?.({ ok: true });
        } catch {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to save display name right now.",
          });
        }
      })();
      return true;
    }
    case "save-favorite-gym": {
      type SaveFavoriteGymEventDetail = {
        action: "save-favorite-gym";
        payload?: { favoriteGymId?: string | null };
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      };
      type AuthSessionPatchResponse = {
        authenticated?: boolean;
        user?: {
          id?: string;
          display_name?: string;
          max_load_kg?: number;
          login?: string;
          registration_date?: string;
          favorite_gym_id?: string | null;
        };
      };
      type ErrorResponsePayload = { message?: string };

      const saveEvent = event as CustomEvent<SaveFavoriteGymEventDetail>;
      const nextFavoriteGymIdRaw = saveEvent.detail?.payload?.favoriteGymId;
      const nextFavoriteGymId =
        typeof nextFavoriteGymIdRaw === "string" && nextFavoriteGymIdRaw.length > 0 ? nextFavoriteGymIdRaw : null;
      event.preventDefault();

      const state = getState();
      if (!state.sessionUser) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "You are not signed in.",
        });
        return true;
      }
      const currentSessionUser = state.sessionUser;
      const currentDisplayName = currentSessionUser.displayName.trim();

      if (currentDisplayName.length === 0) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "Unable to save favorite gym right now.",
        });
        return true;
      }

      if (nextFavoriteGymId && !state.startScreen.gyms.some((gym) => gym.id === nextFavoriteGymId)) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "Choose a valid gym from the list.",
        });
        return true;
      }

      void (async () => {
        try {
          const response = await fetch("/auth/session", {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
              display_name: currentDisplayName,
              favorite_gym_id: nextFavoriteGymId,
            }),
          });

          if (!response.ok) {
            let message = "Unable to save favorite gym right now.";
            try {
              const payload = (await response.json()) as ErrorResponsePayload;
              if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                message = payload.message;
              }
            } catch {
              // keep fallback message when error body is not available
            }

            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: message,
            });
            return;
          }

          const payload = (await response.json()) as AuthSessionPatchResponse;
          const user = payload.user;
          const resolvedFavoriteGymId =
            typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
              ? user.favorite_gym_id
              : nextFavoriteGymId;

          const nextState = getState();
          setState({
            ...nextState,
            sessionUser: {
              id:
                typeof user?.id === "string" && user.id.length > 0
                  ? user.id
                  : currentSessionUser.id,
              displayName:
                typeof user?.display_name === "string" && user.display_name.trim().length > 0
                  ? user.display_name
                  : currentSessionUser.displayName,
              maxLoadKg:
                typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
                  ? user.max_load_kg
                  : currentSessionUser.maxLoadKg,
              login:
                typeof user?.login === "string" && user.login.length > 0
                  ? user.login
                  : currentSessionUser.login,
              registrationDate:
                typeof user?.registration_date === "string" && user.registration_date.length > 0
                  ? user.registration_date
                  : currentSessionUser.registrationDate,
              favoriteGymId: resolvedFavoriteGymId,
            },
            startScreen: {
              ...nextState.startScreen,
              selectedGymId: selectDefaultGymId(nextState.startScreen.gyms, resolvedFavoriteGymId),
            },
          });
          render();
          saveEvent.detail?.respond?.({ ok: true });
        } catch {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to save favorite gym right now.",
          });
        }
      })();
      return true;
    }
    case "save-max-load": {
      type SaveMaxLoadEventDetail = {
        action: "save-max-load";
        payload?: { maxLoadKg?: number };
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      };
      type AuthSessionPatchResponse = {
        authenticated?: boolean;
        user?: {
          id?: string;
          display_name?: string;
          max_load_kg?: number;
          login?: string;
          registration_date?: string;
          favorite_gym_id?: string | null;
        };
      };
      type ErrorResponsePayload = { message?: string };

      const saveEvent = event as CustomEvent<SaveMaxLoadEventDetail>;
      const nextMaxLoadKgRaw = saveEvent.detail?.payload?.maxLoadKg;
      const nextMaxLoadKg =
        typeof nextMaxLoadKgRaw === "number" && Number.isFinite(nextMaxLoadKgRaw)
          ? Math.floor(nextMaxLoadKgRaw)
          : NaN;
      event.preventDefault();

      const state = getState();
      if (!state.sessionUser) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "You are not signed in.",
        });
        return true;
      }
      const currentSessionUser = state.sessionUser;
      const currentDisplayName = currentSessionUser.displayName.trim();

      if (currentDisplayName.length === 0) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "Unable to save max load right now.",
        });
        return true;
      }

      if (
        !Number.isFinite(nextMaxLoadKg) ||
        nextMaxLoadKg < minEditableMaxLoadKg ||
        nextMaxLoadKg > maxEditableMaxLoadKg
      ) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: `Max load must be between ${minEditableMaxLoadKg} and ${maxEditableMaxLoadKg} kg.`,
        });
        return true;
      }

      void (async () => {
        try {
          const response = await fetch("/auth/session", {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
              display_name: currentDisplayName,
              max_load_kg: nextMaxLoadKg,
            }),
          });

          if (!response.ok) {
            let message = "Unable to save max load right now.";
            try {
              const payload = (await response.json()) as ErrorResponsePayload;
              if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                message = payload.message;
              }
            } catch {
              // keep fallback message when error body is not available
            }

            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: message,
            });
            return;
          }

          const payload = (await response.json()) as AuthSessionPatchResponse;
          const user = payload.user;
          const resolvedMaxLoadKg =
            typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
              ? user.max_load_kg
              : nextMaxLoadKg;

          setState({
            ...getState(),
            sessionUser: {
              id:
                typeof user?.id === "string" && user.id.length > 0
                  ? user.id
                  : currentSessionUser.id,
              displayName:
                typeof user?.display_name === "string" && user.display_name.trim().length > 0
                  ? user.display_name
                  : currentSessionUser.displayName,
              maxLoadKg: resolvedMaxLoadKg,
              login:
                typeof user?.login === "string" && user.login.length > 0
                  ? user.login
                  : currentSessionUser.login,
              registrationDate:
                typeof user?.registration_date === "string" && user.registration_date.length > 0
                  ? user.registration_date
                  : currentSessionUser.registrationDate,
              favoriteGymId:
                typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
                  ? user.favorite_gym_id
                  : currentSessionUser.favoriteGymId,
            },
          });
          render();
          saveEvent.detail?.respond?.({ ok: true });
        } catch {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to save max load right now.",
          });
        }
      })();
      return true;
    }
    case "save-password": {
      type SavePasswordEventDetail = {
        action: "save-password";
        payload?: {
          currentPassword?: string;
          newPassword?: string;
          confirmNewPassword?: string;
        };
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      };
      type ErrorResponsePayload = { message?: string };

      const saveEvent = event as CustomEvent<SavePasswordEventDetail>;
      const currentPassword = saveEvent.detail?.payload?.currentPassword ?? "";
      const newPassword = saveEvent.detail?.payload?.newPassword ?? "";
      const confirmNewPassword = saveEvent.detail?.payload?.confirmNewPassword ?? "";
      event.preventDefault();

      if (!getState().sessionUser) {
        saveEvent.detail?.respond?.({
          ok: false,
          errorMessage: "You are not signed in.",
        });
        return true;
      }

      void (async () => {
        try {
          const response = await fetch("/auth/password", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
              confirm_new_password: confirmNewPassword,
            }),
          });

          if (!response.ok) {
            let message = "Unable to update password right now.";
            try {
              const payload = (await response.json()) as ErrorResponsePayload;
              if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                message = payload.message;
              }
            } catch {
              // keep fallback message when error body is not available
            }

            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: message,
            });
            return;
          }

          saveEvent.detail?.respond?.({ ok: true });
        } catch {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to update password right now.",
          });
        }
      })();
      return true;
    }
    default:
      return false;
  }
};
