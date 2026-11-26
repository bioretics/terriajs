import { runInAction } from "mobx";
import Terria from "../../lib/Models/Terria";
import { ConfigStrata } from "../../lib/Models/Config/ConfigStrata";
import ViewState from "../../lib/ReactViewModels/ViewState";
import WelcomeMessage from "../../lib/ReactViews/WelcomeMessage/WelcomeMessage";
import { renderWithContexts } from "./withContext";
import { screen, within } from "@testing-library/react";

describe("WelcomeMessage", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({
      baseUrl: "./"
    });
    viewState = new ViewState({
      terria: terria
    });
  });

  it("renders when showWelcomeMessage is set to true in config file", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageVideo",
        {
          videoTitle: "Getting started with the map",
          videoUrl: "",
          placeholderImage: ""
        }
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);

    expect(viewState.showWelcomeMessage).toEqual(true);
    expect(localScreen.getByText("welcomeMessage.title")).toBeVisible();
    expect(
      localScreen.getByText("welcomeMessage.welcomeMessage")
    ).toBeVisible();

    expect(
      localScreen.getByRole("button", { name: "welcomeMessage.tourBtnText" })
    ).toBeVisible();
    expect(
      localScreen.getByRole("button", { name: "welcomeMessage.helpBtnText" })
    ).toBeVisible();
    expect(
      localScreen.getByRole("button", {
        name: "welcomeMessage.exploreDataBtnText"
      })
    ).toBeVisible();
    expect(
      localScreen.getByRole("button", { name: "welcomeMessage.dismissText" })
    ).toBeVisible();
  });

  it("hides the video area when hideWelcomeMessageVideo is true", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "hideWelcomeMessageVideo",
        true
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);

    expect(
      localScreen.queryByTestId("welcome-message-media")
    ).not.toBeInTheDocument();
    expect(
      localScreen.queryByText("Getting started with the map")
    ).not.toBeInTheDocument();
  });

  it("shows welcomeMessageImageUrl in the video column when insteadOfVideo", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "hideWelcomeMessageVideo",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageImageUrl",
        "https://example.com/welcome-art.png"
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageImagePlacement",
        "insteadOfVideo"
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);
    const image = localScreen
      .getByTestId("welcome-message-image")
      .querySelector("img");

    expect(image).toHaveAttribute("src", "https://example.com/welcome-art.png");
  });

  it("shows welcomeMessageImageUrl below the action row when underVideo", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageImageUrl",
        "https://example.com/welcome-under.png"
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageImagePlacement",
        "underVideo"
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);
    const image = localScreen
      .getByTestId("welcome-message-image-under")
      .querySelector("img");

    expect(image).toHaveAttribute(
      "src",
      "https://example.com/welcome-under.png"
    );
    expect(localScreen.getByTestId("welcome-message-media")).toBeVisible();
  });

  it("shows a static image when placeholderImage is set without a video", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageVideo",
        {
          videoUrl: "",
          videoTitle: "",
          placeholderImage: "https://example.com/welcome.png"
        }
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);

    expect(localScreen.getByTestId("welcome-message-media")).toBeVisible();
  });

  it("shows a configurable logo and can hide the title", function () {
    runInAction(() => {
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        true
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "welcomeMessageLogoUrl",
        "https://example.com/logo.png"
      );
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "hideWelcomeMessageTitle",
        true
      );
    });
    const { container } = renderWithContexts(<WelcomeMessage />, viewState);
    const localScreen = within(container);

    expect(localScreen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/logo.png"
    );
    expect(
      localScreen.queryByText("welcomeMessage.title")
    ).not.toBeInTheDocument();
  });

  it("doesn't render when showWelcomeMessage is set to false in config file", function () {
    runInAction(() =>
      terria.configParameters.setValue(
        ConfigStrata.definition,
        "showWelcomeMessage",
        false
      )
    );
    renderWithContexts(<WelcomeMessage />, viewState);

    expect(viewState.showWelcomeMessage).toEqual(false);
    expect(screen.queryByText("welcomeMessage.title")).not.toBeInTheDocument();
  });
});
