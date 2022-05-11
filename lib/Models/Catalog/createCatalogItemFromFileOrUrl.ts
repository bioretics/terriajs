import i18next from "i18next";
import { runInAction } from "mobx";
import isDefined from "../../Core/isDefined";
import TerriaError from "../../Core/TerriaError";
import ViewState from "../../ReactViewModels/ViewState";
import CatalogMemberFactory from "./CatalogMemberFactory";
import CommonStrata from "../Definition/CommonStrata";
import createUrlReferenceFromUrl from "./CatalogReferences/createUrlReferenceFromUrl";
import { BaseModel } from "../Definition/Model";
import Terria from "../Terria";
import upsertModelFromJson from "../Definition/upsertModelFromJson";
import ReferenceMixin from "../../ModelMixins/ReferenceMixin";

export default function createCatalogItemFromFileOrUrl(
  terria: Terria,
  viewState: ViewState,
  fileOrUrl: File | string,
  dataType?: string
): Promise<BaseModel | undefined> {
  dataType = isDefined(dataType) ? dataType : "auto";

  let isUrl: boolean, name: string;
  if (typeof fileOrUrl === "string") {
    name = fileOrUrl;
    isUrl = true;
  } else {
    name = fileOrUrl.name;
    isUrl = false;
  }

  if (dataType === "auto") {
    return createUrlReferenceFromUrl(name, terria, isUrl).then(newItem => {
      if (!isDefined(newItem)) {
        terria.raiseErrorToUser(
          new TerriaError({
            title: i18next.t("models.catalog.unsupportedFileTypeTitle"),
            message: i18next.t("models.catalog.unsupportedFileTypeMessage", {
              appName: terria.appName,
              link:
                '<a href="https://github.com/TerriaJS/nationalmap/wiki/csv-geo-au">csv-geo-au format</a>'
            })
          })
        );
        return undefined;
      }
      // It's a file or service we support directly
      // In some cases (web services), the item will already have been loaded by this point.
      return loadItem(newItem, fileOrUrl);
    });
  } else {
    // User has provided a type, so we go with that.
    return loadItem(
      createCatalogMember(terria, { type: dataType, name }),
      fileOrUrl
    );
  }
}

function createCatalogMember(
  terria: Terria,
  json: { type: string; name: string }
) {
  return upsertModelFromJson(
    CatalogMemberFactory,
    terria,
    "",
    CommonStrata.definition,
    json,
    {}
  ).throwIfUndefined({
    message: `Failed to create catalog member from JSON: ${json.name}`
  });
}

async function loadItem(
  newCatalogItem: BaseModel,
  fileOrUrl: File | string
): Promise<BaseModel> {
  if (
    ReferenceMixin.isMixedInto(newCatalogItem) &&
    newCatalogItem.target !== undefined
  ) {
    return loadItem(newCatalogItem.target, fileOrUrl);
  }

  if (typeof fileOrUrl === "string") {
    newCatalogItem.setTrait(CommonStrata.user, "url", fileOrUrl);
  } else if (hasFileInput(newCatalogItem)) {
    newCatalogItem.setFileInput(fileOrUrl);
  }

  return newCatalogItem;
}

export interface HasFileInput extends BaseModel {
  setFileInput(file: File): void;
}

export function hasFileInput(model: BaseModel): model is HasFileInput {
  return "setFileInput" in model;
}
