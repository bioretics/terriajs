import { renderHook } from "@testing-library/react";
import { runInAction } from "mobx";
import Terria, {
  LoginProfileServiceType
} from "../../../../../lib/Models/Terria";
import ViewState from "../../../../../lib/ReactViewModels/ViewState";
import {
  useLogin,
  usernameFromAuthToken
} from "../../../../../lib/ReactViews/Map/MenuBar/LoginButton/useLogin";

function basicToken(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

describe("usernameFromAuthToken", function () {
  it("reads the username out of a basic auth token", function () {
    expect(usernameFromAuthToken(basicToken("mario", "segreta"))).toEqual(
      "mario"
    );
  });

  it("keeps a password that itself contains a colon out of the username", function () {
    expect(usernameFromAuthToken(basicToken("mario", "a:b:c"))).toEqual(
      "mario"
    );
  });

  it("takes the whole payload when there is no password at all", function () {
    expect(usernameFromAuthToken(`Basic ${btoa("mario")}`)).toEqual("mario");
  });

  it("reads an empty username as empty rather than as nothing", function () {
    expect(usernameFromAuthToken(basicToken("", "segreta"))).toEqual("");
  });

  it("has no username to offer without a token", function () {
    expect(usernameFromAuthToken(undefined)).toBeUndefined();
    expect(usernameFromAuthToken("")).toBeUndefined();
  });

  it("ignores a token that is not basic auth", function () {
    expect(usernameFromAuthToken("Bearer abc.def.ghi")).toBeUndefined();
    expect(usernameFromAuthToken("basic lowercase")).toBeUndefined();
  });

  it("copes with a token whose payload is not valid base64", function () {
    expect(usernameFromAuthToken("Basic !!!not-base64!!!")).toBeUndefined();
  });
});

describe("useLogin", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
  });

  function render() {
    return renderHook(() => useLogin(terria, viewState));
  }

  describe("who is signed in", function () {
    it("reports nobody to start with", function () {
      const { result } = render();

      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.username).toBeUndefined();
    });

    it("names the user behind the auth token", function () {
      runInAction(() => {
        terria.userAuthToken = basicToken("mario", "segreta");
      });

      const { result } = render();
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.username).toEqual("mario");
    });

    it("falls back on the profile when there is no token to read", function () {
      runInAction(() => {
        terria.userProfile = "regione";
      });

      const { result } = render();
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.username).toEqual("regione");
    });

    it("prefers the token over the profile", function () {
      runInAction(() => {
        terria.userAuthToken = basicToken("mario", "segreta");
        terria.userProfile = "regione";
      });

      const { result } = render();
      expect(result.current.username).toEqual("mario");
    });
  });

  describe("the Geoserver service", function () {
    beforeEach(function () {
      runInAction(() => {
        terria.configParameters.userProfileLoginServiceType =
          LoginProfileServiceType.Geoserver;
      });
    });

    it("opens the login panel when nobody is signed in", function () {
      const { result } = render();

      result.current.executeAuthAction();

      expect(viewState.isLoginPanelVisible).toBe(true);
    });

    it("signs the user out when there is a token", function () {
      runInAction(() => {
        terria.userAuthToken = basicToken("mario", "segreta");
        terria.userProfile = "regione";
      });
      const { result } = render();

      result.current.executeAuthAction();

      expect(terria.userAuthToken).toBeUndefined();
      expect(terria.userProfile).toBeUndefined();
      expect(viewState.isLoginPanelVisible).toBe(false);
    });
  });

  describe("the Cohesion service", function () {
    let clicked: HTMLAnchorElement[];
    let createElement: (tag: string) => HTMLElement;

    beforeEach(function () {
      clicked = [];
      runInAction(() => {
        terria.configParameters.userProfileLoginServiceType =
          LoginProfileServiceType.Cohesion;
        terria.configParameters.userProfileLoginServiceUrl =
          "https://example.com/login?next=";
      });

      // The hook navigates by clicking a link it builds itself, so the click
      // is caught here rather than letting it take the specs off the page.
      createElement = document.createElement.bind(document);
      spyOn(document, "createElement").and.callFake((tag: string) => {
        const element = createElement(tag);
        if (tag === "a") {
          const anchor = element as HTMLAnchorElement;
          anchor.click = () => clicked.push(anchor);
        }
        return element;
      });
    });

    it("sends a signed out user to the login service", function () {
      const { result } = render();

      result.current.executeAuthAction();

      expect(clicked.length).toEqual(1);
      expect(clicked[0].href).toEqual(
        `https://example.com/login?next=${document.baseURI}`
      );
    });

    it("sends a signed in user back to the application", function () {
      runInAction(() => {
        terria.userProfile = "regione";
      });
      const { result } = render();

      result.current.executeAuthAction();

      expect(clicked.length).toEqual(1);
      expect(clicked[0].href).toEqual(document.baseURI);
    });
  });

  it("does nothing when no login service is configured", function () {
    const { result } = render();

    expect(() => result.current.executeAuthAction()).not.toThrow();
    expect(viewState.isLoginPanelVisible).toBe(false);
  });
});
