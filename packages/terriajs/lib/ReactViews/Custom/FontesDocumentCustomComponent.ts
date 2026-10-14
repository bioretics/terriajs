import i18next from "i18next";
import { action } from "mobx";
import { createElement, ReactElement } from "react";
import ViewState from "../../ReactViewModels/ViewState";
import FeatureLink from "../Generic/FeatureLink";
import CustomComponent, {
  DomElement,
  ProcessNodeContext
} from "./CustomComponent";

export default class FontesDocumentCustomComponent extends CustomComponent {
  get name(): string {
    return "fontes-document";
  }

  get attributes(): string[] {
    return ["id"];
  }

  processNode(
    _context: ProcessNodeContext,
    node: DomElement,
    children: ReactElement[]
  ): ReactElement {
    const id = node.attribs?.id ?? "";
    return createElement(
      FeatureLink,
      {
        title: id,
        onClick: action((viewState: ViewState) =>
          viewState.openFontesDocument(id)
        )
      },
      ...(children.length > 0
        ? children
        : [i18next.t(($) => $.fontes.openDocument)])
    );
  }
}
