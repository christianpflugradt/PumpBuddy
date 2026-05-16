import type { AppState } from "./workout-types";
import {
  mergeSessionUser,
  parseErrorResponsePayload,
  parseSessionUserResponse,
  serializeAuthSessionUpdateRequest,
  serializeAuthUpdatePasswordRequest,
} from "./openapi-contract";
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

const resolveErrorMessage = async (
  response: { json?: () => Promise<unknown> },
  fallbackMessage: string,
): Promise<string> => {
  if (typeof response.json !== "function") {
    return fallbackMessage;
  }

  try {
    const payload = parseErrorResponsePayload(await response.json());
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    // keep fallback message when error body is not available
  }

  return fallbackMessage;
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
            body: JSON.stringify(
              serializeAuthSessionUpdateRequest({ display_name: nextDisplayName }),
            ),
          });

          if (!response.ok) {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: await resolveErrorMessage(
                response,
                "Unable to save display name right now.",
              ),
            });
            return;
          }

          const nextSessionUser = parseSessionUserResponse(await response.json());
          const mergedSessionUser = mergeSessionUser(currentSessionUser, nextSessionUser);

          setState({
            ...getState(),
            sessionUser: {
              ...mergedSessionUser,
              displayName:
                nextSessionUser?.displayName.trim().length
                  ? nextSessionUser.displayName
                  : nextDisplayName,
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
            body: JSON.stringify(
              serializeAuthSessionUpdateRequest({
                display_name: currentDisplayName,
                favorite_gym_id: nextFavoriteGymId,
              }),
            ),
          });

          if (!response.ok) {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: await resolveErrorMessage(
                response,
                "Unable to save favorite gym right now.",
              ),
            });
            return;
          }

          const nextSessionUser = parseSessionUserResponse(await response.json());
          const mergedSessionUser = mergeSessionUser(currentSessionUser, nextSessionUser);
          const resolvedFavoriteGymId =
            nextSessionUser?.favoriteGymId === undefined
              ? nextFavoriteGymId
              : nextSessionUser.favoriteGymId;

          const resolvedDisplayName =
            nextSessionUser?.displayName.trim().length
              ? nextSessionUser.displayName
              : currentSessionUser.displayName;

          const resolvedMaxLoadKg =
            nextSessionUser?.maxLoadKg === undefined
              ? currentSessionUser.maxLoadKg
              : nextSessionUser.maxLoadKg;

          const resolvedLogin =
            nextSessionUser?.login === undefined ? currentSessionUser.login : nextSessionUser.login;

          const resolvedRegistrationDate =
            nextSessionUser?.registrationDate === undefined
              ? currentSessionUser.registrationDate
              : nextSessionUser.registrationDate;

          const nextState = getState();
          setState({
            ...nextState,
            sessionUser: {
              ...mergedSessionUser,
              displayName: resolvedDisplayName,
              maxLoadKg: resolvedMaxLoadKg,
              login: resolvedLogin,
              registrationDate: resolvedRegistrationDate,
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
            body: JSON.stringify(
              serializeAuthSessionUpdateRequest({
                display_name: currentDisplayName,
                max_load_kg: nextMaxLoadKg,
              }),
            ),
          });

          if (!response.ok) {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: await resolveErrorMessage(
                response,
                "Unable to save max load right now.",
              ),
            });
            return;
          }

          const nextSessionUser = parseSessionUserResponse(await response.json());
          const mergedSessionUser = mergeSessionUser(currentSessionUser, nextSessionUser);
          const resolvedMaxLoadKg =
            nextSessionUser?.maxLoadKg === undefined
              ? nextMaxLoadKg
              : nextSessionUser.maxLoadKg;

          setState({
            ...getState(),
            sessionUser: {
              ...mergedSessionUser,
              maxLoadKg: resolvedMaxLoadKg,
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
            body: JSON.stringify(
              serializeAuthUpdatePasswordRequest({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_new_password: confirmNewPassword,
              }),
            ),
          });

          if (!response.ok) {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: await resolveErrorMessage(
                response,
                "Unable to update password right now.",
              ),
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
