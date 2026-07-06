import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Button from "../../../../../Styled/Button";
import Terria from "../../../../../Models/Terria";
import { composeMapScreenshot } from "./composeMapScreenshot";
import { downloadImg } from "./PrintView";

interface Props {
  window: Window;
  screenshot: Promise<string> | null;
  terria: Terria;
  includeScaleBar: boolean;
  includeCompass: boolean;
}

const ButtonBar = styled.section`
  display: flex;
  justify-content: flex-end;
`;

const PrintViewButtons = (props: Props) => {
  const [isDisabled, setDisabled] = useState(true);

  useEffect(() => {
    props.screenshot?.then(() => setDisabled(false));
  }, [props.screenshot]);

  return (
    <ButtonBar>
      <Button
        primary
        disabled={isDisabled}
        onClick={(evt: MouseEvent) => {
          evt.preventDefault();
          props.screenshot
            ?.then((dataString) =>
              composeMapScreenshot(dataString, props.terria, {
                includeScaleBar: props.includeScaleBar,
                includeCompass: props.includeCompass
              })
            )
            .then(downloadImg)
            .catch((error) => {
              console.error("Failed to download map screenshot:", error);
            });
        }}
      >
        Download map
      </Button>
      <Button
        primary
        disabled={isDisabled}
        marginLeft={1}
        onClick={(evt: MouseEvent) => {
          evt.preventDefault();
          props.window.print();
        }}
      >
        Print
      </Button>
    </ButtonBar>
  );
};

export default PrintViewButtons;
