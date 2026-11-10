import { fireEvent, render, screen } from "@testing-library/react";
import MapIconButton from "../../../lib/ReactViews/MapIconButton/MapIconButton";
import { withThemeContext } from "../withContext";

describe("MapIconButton", function () {
  it("reports how much the label widens it while expanded", function () {
    const widths: number[] = [];
    render(
      withThemeContext(
        <MapIconButton
          title="Locate"
          iconElement={() => <span />}
          onExpandedChange={(width) => widths.push(width)}
        >
          Mappa centrata nella tua posizione
        </MapIconButton>
      )
    );
    const button = screen.getByRole("button");

    fireEvent.focus(button);
    expect(widths[widths.length - 1]).toBeGreaterThan(10);
    expect(widths[widths.length - 1]).toBeLessThanOrEqual(160);

    fireEvent.blur(button);
    expect(widths[widths.length - 1]).toBe(0);
  });

  it("reports no width when expansion is disabled", function () {
    const widths: number[] = [];
    render(
      withThemeContext(
        <MapIconButton
          title="Locate"
          iconElement={() => <span />}
          noExpand
          onExpandedChange={(width) => widths.push(width)}
        >
          Mappa centrata nella tua posizione
        </MapIconButton>
      )
    );

    fireEvent.focus(screen.getByRole("button"));

    expect(widths.filter((width) => width > 0)).toEqual([]);
  });
});
