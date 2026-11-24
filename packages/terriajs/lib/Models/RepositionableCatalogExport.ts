import { JsonObject } from "../Core/Json";
import CatalogMemberMixin from "../ModelMixins/CatalogMemberMixin";
import { BaseModel } from "./Definition/Model";
import saveModelToJson from "./Definition/saveModelToJson";

interface ModelWithMembers extends BaseModel {
  memberModels?: ReadonlyArray<BaseModel>;
}

export interface RepositionableCatalogExport {
  readonly blob: Blob;
  readonly filename: string;
}

function getExportFilename(item: BaseModel): string {
  const name =
    CatalogMemberMixin.isMixedInto(item) && item.name
      ? item.name
      : (item.uniqueId ?? "repositioned-layer");
  const safeName = name
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safeName || "repositioned-layer"}.json`;
}

export function exportRepositionableCatalog(
  item: BaseModel
): RepositionableCatalogExport {
  if (item.uniqueId === undefined) {
    throw new Error("Cannot export a repositionable item without an ID.");
  }

  const models: Record<string, JsonObject> = {};
  const visited = new Set<string>();

  const addModel = (model: BaseModel) => {
    if (model.uniqueId === undefined || visited.has(model.uniqueId)) return;
    visited.add(model.uniqueId);
    models[model.uniqueId] = saveModelToJson(model, {
      includeStrata: ["definition", "user"]
    });

    const members = (model as ModelWithMembers).memberModels;
    members?.forEach(addModel);
  };

  addModel(item);

  const initSource: JsonObject = {
    models,
    workbench: [item.uniqueId]
  };
  const blob = new Blob([JSON.stringify(initSource, null, 2)], {
    type: "application/json"
  });

  return {
    blob,
    filename: getExportFilename(item)
  };
}
