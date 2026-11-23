import Cesium3dTilesMixin from "../ModelMixins/Cesium3dTilesMixin";
import CompositeCatalogItem from "./Catalog/CatalogItems/CompositeCatalogItem";
import Cesium from "./Cesium";
import Repositionable3DTiles from "./Repositionable3DTiles";

export default class RepositionableComposite {
  private readonly controllers: Repositionable3DTiles[];

  private constructor(
    readonly item: CompositeCatalogItem,
    controllers: Repositionable3DTiles[]
  ) {
    this.controllers = controllers;
  }

  static create(
    item: CompositeCatalogItem,
    cesium: Cesium
  ): RepositionableComposite | undefined {
    if (item.isLoadingMapItems) return;

    const memberItems = item.memberModels.filter(
      Cesium3dTilesMixin.isMixedInto
    );
    const controllers = memberItems
      .map((member) => Repositionable3DTiles.create(member, cesium))
      .filter(
        (controller): controller is Repositionable3DTiles =>
          controller !== undefined
      );

    if (controllers.length === 0) return;
    return new RepositionableComposite(item, controllers);
  }

  save() {
    this.controllers.forEach((controller) => controller.save());
  }

  cancel() {
    this.controllers.forEach((controller) => controller.cancel());
  }
}
