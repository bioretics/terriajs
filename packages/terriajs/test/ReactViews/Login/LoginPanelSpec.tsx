import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { runInAction } from "mobx";
import Terria from "../../../lib/Models/Terria";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import LoginPanel from "../../../lib/ReactViews/Login/LoginPanel";
import { worker } from "../../mocks/browser";
import { renderWithContexts } from "../withContext";

const LOGIN_URL = "https://example.com/auth/login";

const EXPECTED_HEADER = `Basic ${btoa("user:password")}`;

const GROUPS_XML =
  "<groups><group>regione</group><group>partner</group></groups>";

function waitUntil(condition: () => boolean, message: string) {
  return waitFor(() => {
    if (!condition()) throw new Error(message);
  });
}

describe("LoginPanel", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
    terria.configParameters.userProfileLoginServiceUrl = LOGIN_URL;
    spyOn(terria.corsProxy, "getURL").and.returnValue(LOGIN_URL);
    runInAction(() => {
      viewState.isLoginPanelVisible = true;
    });
  });

  function render() {
    const user = userEvent.setup({ delay: null });
    renderWithContexts(
      <LoginPanel terria={terria} viewState={viewState} />,
      viewState
    );
    return user;
  }

  function fields() {
    const username = screen.getByRole("textbox", {
      name: "login.loginPanelUsernameTitle"
    }) as HTMLInputElement;
    const password = document.querySelector<HTMLInputElement>(
      'input[type="password"]'
    )!;
    return { username, password };
  }

  function okButton() {
    return screen.getByRole("button", { name: "login.loginPanelOk" });
  }

  async function signIn(user: ReturnType<typeof render>) {
    const { username, password } = fields();
    await user.type(username, "user");
    await user.type(password, "password");
    await user.click(okButton());
  }

  it("shows the header and both credential fields", function () {
    render();
    expect(screen.getByText("login.loginPanelHeader")).toBeVisible();
    expect(screen.getByText("login.loginPanelUsername")).toBeVisible();
    expect(screen.getByText("login.loginPanelPassword")).toBeVisible();
  });

  it("masks the password field", function () {
    render();
    expect(fields().password.type).toEqual("password");
  });

  it("hides the panel from assistive tech when it is not showing", function () {
    runInAction(() => {
      viewState.isLoginPanelVisible = false;
    });
    render();
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  describe("validation", function () {
    it("complains when both fields are empty", async function () {
      const user = render();
      await user.click(okButton());

      expect(
        await screen.findByText("login.loginPanelMissingFields")
      ).toBeVisible();
    });

    it("complains when only the username was given", async function () {
      const user = render();
      await user.type(fields().username, "user");
      await user.click(okButton());

      expect(
        await screen.findByText("login.loginPanelMissingFields")
      ).toBeVisible();
    });

    it("treats whitespace as empty", async function () {
      const user = render();
      await user.type(fields().username, "   ");
      await user.type(fields().password, "   ");
      await user.click(okButton());

      expect(
        await screen.findByText("login.loginPanelMissingFields")
      ).toBeVisible();
    });

    it("clears the message as soon as the user types again", async function () {
      const user = render();
      await user.click(okButton());
      await screen.findByText("login.loginPanelMissingFields");

      await user.type(fields().username, "u");

      expect(
        screen.queryByText("login.loginPanelMissingFields")
      ).not.toBeInTheDocument();
    });
  });

  describe("signing in", function () {
    it("sends the credentials as a Basic authorization header", async function () {
      let authorization: string | null | undefined;
      worker.use(
        http.get(LOGIN_URL, ({ request }) => {
          authorization = request.headers.get("Authorization");
          return HttpResponse.json({ ok: true });
        })
      );

      const user = render();
      await signIn(user);

      await waitUntil(
        () => authorization !== undefined,
        "the login service was never called"
      );
      expect(authorization).toEqual(EXPECTED_HEADER);
    });

    it("remembers the token and closes the panel on success", async function () {
      worker.use(http.get(LOGIN_URL, () => HttpResponse.json({ ok: true })));

      const user = render();
      await signIn(user);

      await waitUntil(
        () => terria.userAuthToken !== undefined,
        "the token was never stored"
      );
      expect(terria.userAuthToken).toEqual(EXPECTED_HEADER);
      expect(viewState.isLoginPanelVisible).toBe(false);
    });

    it("reports bad credentials when the service rejects them", async function () {
      worker.use(
        http.get(LOGIN_URL, () => new HttpResponse(null, { status: 401 }))
      );

      const user = render();
      await signIn(user);

      expect(
        await screen.findByText("login.loginPanelInvalidCredentials")
      ).toBeVisible();
      expect(terria.userAuthToken).toBeUndefined();
    });

    it("reports a generic error for other failures", async function () {
      worker.use(
        http.get(LOGIN_URL, () => new HttpResponse(null, { status: 500 }))
      );

      const user = render();
      await signIn(user);

      expect(
        await screen.findByText("login.loginPanelGenericError")
      ).toBeVisible();
      expect(terria.userAuthToken).toBeUndefined();
    });

    it("does not call the service when no login url is configured", async function () {
      terria.configParameters.userProfileLoginServiceUrl = undefined;
      let called = false;
      worker.use(
        http.get(LOGIN_URL, () => {
          called = true;
          return HttpResponse.json({ ok: true });
        })
      );

      const user = render();
      await signIn(user);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(called).toBe(false);
      expect(terria.userAuthToken).toBeUndefined();
    });

    it("signs in when Enter is pressed in the password field", async function () {
      worker.use(http.get(LOGIN_URL, () => HttpResponse.json({ ok: true })));

      const user = render();
      const { username, password } = fields();
      await user.type(username, "user");
      await user.type(password, "password{Enter}");

      await waitUntil(
        () => terria.userAuthToken !== undefined,
        "the token was never stored"
      );
      expect(terria.userAuthToken).toEqual(EXPECTED_HEADER);
    });
  });

  describe("the user's group", function () {
    it("remembers the first group the service reports", async function () {
      worker.use(http.get(LOGIN_URL, () => HttpResponse.text(GROUPS_XML)));

      const user = render();
      await signIn(user);

      await waitUntil(
        () => terria.userAuthToken !== undefined,
        "the token was never stored"
      );
      expect(terria.userProfile).toEqual("regione");
      expect(terria.isAuthenticated).toBe(true);
    });

    it("leaves the group unset when the service reports none", async function () {
      worker.use(
        http.get(LOGIN_URL, () => HttpResponse.text("<groups></groups>"))
      );

      const user = render();
      await signIn(user);

      await waitUntil(
        () => terria.userAuthToken !== undefined,
        "the token was never stored"
      );
      expect(terria.userProfile).toBeUndefined();
    });

    it("leaves the group unset when the answer is not XML", async function () {
      worker.use(
        http.get(LOGIN_URL, () => HttpResponse.text("not xml at all"))
      );

      const user = render();
      await signIn(user);

      await waitUntil(
        () => terria.userAuthToken !== undefined,
        "the token was never stored"
      );
      expect(terria.userProfile).toBeUndefined();
    });

    it("asks the service about the user it is signing in", async function () {
      terria.configParameters.userProfileLoginServiceUrl =
        "https://example.com/auth/<username>/groups";
      let requestedUrl: string | undefined;
      (terria.corsProxy.getURL as jasmine.Spy).and.callFake((url: string) => {
        requestedUrl = url;
        return LOGIN_URL;
      });
      worker.use(http.get(LOGIN_URL, () => HttpResponse.text(GROUPS_XML)));

      const user = render();
      await signIn(user);

      // Wait for the whole exchange, so no request is still in flight after
      // this spec finishes.
      await waitUntil(
        () => terria.userProfile !== undefined,
        "the login service was never called"
      );
      expect(requestedUrl).toEqual("https://example.com/auth/user/groups");
    });
  });

  describe("signing out", function () {
    it("drops the token without calling the service", async function () {
      runInAction(() => {
        terria.userAuthToken = EXPECTED_HEADER;
      });
      let called = false;
      worker.use(
        http.get(LOGIN_URL, () => {
          called = true;
          return HttpResponse.json({ ok: true });
        })
      );

      const user = render();
      await user.click(okButton());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(terria.userAuthToken).toBeUndefined();
      expect(called).toBe(false);
    });

    it("forgets the user's group as well", async function () {
      runInAction(() => {
        terria.userAuthToken = EXPECTED_HEADER;
        terria.userProfile = "regione";
      });

      const user = render();
      await user.click(okButton());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(terria.userProfile).toBeUndefined();
      expect(terria.isAuthenticated).toBe(false);
    });
  });

  describe("cancelling", function () {
    it("closes the panel", async function () {
      const user = render();
      await user.click(
        screen.getByRole("button", { name: "login.loginPanelCancel" })
      );

      expect(viewState.isLoginPanelVisible).toBe(false);
    });

    it("leaves any existing token alone", async function () {
      runInAction(() => {
        terria.userAuthToken = EXPECTED_HEADER;
      });

      const user = render();
      await user.click(
        screen.getByRole("button", { name: "login.loginPanelCancel" })
      );

      expect(terria.userAuthToken).toEqual(EXPECTED_HEADER);
    });
  });
});
