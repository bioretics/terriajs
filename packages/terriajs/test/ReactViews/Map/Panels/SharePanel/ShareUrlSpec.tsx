import { createRef } from "react";
import { runInAction } from "mobx";
import { waitFor } from "@testing-library/react";
import TerriaError from "../../../../../lib/Core/TerriaError";
import ShareDataService from "../../../../../lib/Models/ShareDataService";
import Terria from "../../../../../lib/Models/Terria";
import ViewState from "../../../../../lib/ReactViewModels/ViewState";
import {
  IShareUrlRef,
  ShareUrl
} from "../../../../../lib/ReactViews/Map/Panels/SharePanel/ShareUrl/ShareUrl";
import { renderWithContexts } from "../../../withContext";

describe("ShareUrl", function () {
  let terria: Terria;
  let viewState: ViewState;
  let shareDataService: ShareDataService;

  beforeEach(function () {
    terria = new Terria({
      baseUrl: "./"
    });
    viewState = new ViewState({
      terria
    });
    shareDataService = new ShareDataService({ terria });
    shareDataService.init({ newShareUrlPrefix: "g" });
    spyOn(shareDataService, "getShareToken").and.callFake(() =>
      Promise.reject(
        TerriaError.from(
          Object.assign(new Error("fail"), { statusCode: 500 }),
          {
            title: "Error",
            message: "Something went wrong (500)",
            importance: 1
          }
        )
      )
    );
    runInAction(() => {
      terria.shareDataService = shareDataService;
    });
  });

  it("renders a long share link when shortening is disabled", async function () {
    const shareUrlRef = createRef<IShareUrlRef>();

    renderWithContexts(
      <ShareUrl
        ref={shareUrlRef}
        terria={terria}
        viewState={viewState}
        includeStories={false}
        shouldShorten={false}
      />,
      viewState
    );

    await waitFor(() => {
      expect(shareUrlRef.current?.url).toContain("start=");
    });
  });

  it("falls back to a long share link when getShareToken fails", async function () {
    const shareUrlRef = createRef<IShareUrlRef>();
    const raiseErrorToUser = spyOn(terria, "raiseErrorToUser");

    renderWithContexts(
      <ShareUrl
        ref={shareUrlRef}
        terria={terria}
        viewState={viewState}
        includeStories={false}
        shouldShorten
      />,
      viewState
    );

    await waitFor(
      () => {
        expect(shareUrlRef.current?.url).toContain("start=");
        expect(shareUrlRef.current?.url).not.toContain("Something went wrong");
        expect(raiseErrorToUser).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });
});
