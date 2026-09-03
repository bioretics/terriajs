import { runInAction } from "mobx";
import Terria, { LoginProfileServiceType } from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";

export function usernameFromAuthToken(token?: string): string | undefined {
  if (!token?.startsWith("Basic ")) return undefined;
  try {
    const decoded = atob(token.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    return separator >= 0 ? decoded.slice(0, separator) : decoded;
  } catch {
    return undefined;
  }
}

export function useLogin(terria: Terria, viewState: ViewState) {
  const isLoggedIn = terria.isAuthenticated;
  const username =
    usernameFromAuthToken(terria.userAuthToken) ?? terria.userProfile;

  const executeAuthAction = () => {
    if (
      terria.configParameters.userProfileLoginServiceType ===
      LoginProfileServiceType.Cohesion
    ) {
      const a = document.createElement("a");
      a.href = !terria.userProfile
        ? terria.configParameters.userProfileLoginServiceUrl + document.baseURI
        : document.baseURI;
      a.click();
    } else if (
      terria.configParameters.userProfileLoginServiceType ===
      LoginProfileServiceType.Geoserver
    ) {
      runInAction(() => {
        if (terria.userAuthToken) {
          terria.userAuthToken = undefined;
          terria.userProfile = undefined;
        } else {
          viewState.isLoginPanelVisible = true;
        }
      });
    }
  };

  return { isLoggedIn, username, executeAuthAction };
}
