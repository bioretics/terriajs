import { act, screen } from "@testing-library/react";
import Terria from "../../lib/Models/Terria";
import ViewState from "../../lib/ReactViewModels/ViewState";
import BadgeBar from "../../lib/ReactViews/BadgeBar";
import { TextSpan } from "../../lib/Styled/Text";
import { renderWithContexts } from "./withContext";

describe("BadgeBar", function () {
  const nextFrames = () =>
    act(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );

  it("shows only icons when the button labels do not fit", async function () {
    const viewState = new ViewState({ terria: new Terria() });
    const { container } = renderWithContexts(
      <div style={{ width: "800px" }}>
        <BadgeBar label="Data">
          <button>
            <TextSpan>A fairly long first label</TextSpan>
          </button>
          <button>
            <TextSpan>A fairly long second label</TextSpan>
          </button>
        </BadgeBar>
      </div>,
      viewState
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const label = screen.getByText("A fairly long first label");

    await nextFrames();
    expect(label).toBeVisible();

    wrapper.style.width = "120px";
    await nextFrames();
    expect(label).not.toBeVisible();

    wrapper.style.width = "800px";
    await nextFrames();
    expect(label).toBeVisible();
  });
});
