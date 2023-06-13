import { computed } from "mobx";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import StratumOrder from "../Models/Definition/StratumOrder";
import SearchableCatalogItemTraits from "../Traits/TraitsClasses/SearchableCatalogItemTraits";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import SearchResult from "../Models/SearchProviders/SearchResult";
import createZoomToFunction from "../Map/Vector/zoomRectangleFromPoint";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import EntityCollection from "terriajs-cesium/Source/DataSources/EntityCollection";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";

export interface SearchableData {
  searchField: string;
  latitude: number;
  longitude: number;
}

type MixinModel = Model<SearchableCatalogItemTraits>;

function SearchableCatalogItemMixin<T extends Constructor<MixinModel>>(
  Base: T
) {
  abstract class SearchableCatalogItemMixin extends Base {
    @computed
    get hasSearchableCatalogItemMixin() {
      return true;
    }

    abstract searchWithinItemData(text: string): SearchResult[] | undefined;

    search(
      text: string,
      elements: SearchableData[] | undefined
    ): SearchResult[] | undefined {
      const bboxSize = 0.005;
      const time = 2.0;

      if (!elements) return;

      const filteredElements = elements.filter((element) => {
        return element.searchField.toLowerCase().includes(text);
      });

      if (filteredElements.length === 0) return;

      const results = filteredElements.map((element) => {
        return new SearchResult({
          name: element.searchField,
          isImportant: false,
          clickAction: () =>
            this.terria.currentViewer.zoomTo(
              createZoomToFunction(
                element.latitude,
                element.longitude,
                bboxSize
              ),
              time
            ),
          location: { latitude: element.latitude, longitude: element.longitude }
        });
      });

      return results.filter((res) => res !== undefined) as SearchResult[];
    }

    searchInEntityCollection(
      text: string,
      entityCollection: EntityCollection | undefined
    ): SearchResult[] | undefined {
      const bboxSize = 0.005;
      const time = 2.0;

      if (!entityCollection) return;

      const filtered = entityCollection.values.filter((entity) => {
        return (
          (entity.billboard ||
            entity.point ||
            entity.polyline ||
            entity.polygon) &&
          (entity.properties?.[this.nameOfCatalogItemSearchField]
            .valueOf()
            .toLowerCase()
            .includes(text) ||
            entity.name?.toLowerCase().includes(text))
        );
      });
      if (filtered.length === 0) return;
      const results = filtered.map((entity) => {
        let cartesianPosition: Cartesian3;
        let cartoPosition: Cartographic;

        if (entity.position) {
          cartesianPosition = entity.position.getValue(JulianDate.now());
          if (!cartesianPosition) return;
          cartoPosition = Cartographic.fromCartesian(cartesianPosition);
        } else if (entity.polyline) {
          cartoPosition = Rectangle.center(
            Rectangle.fromCartesianArray(
              entity.polyline?.positions?.getValue(JulianDate.now()) ?? []
            )
          );
        } else if (entity.polygon) {
          cartoPosition = Rectangle.center(
            Rectangle.fromCartesianArray(
              (
                entity.polygon?.hierarchy?.getValue(JulianDate.now()) as
                  | PolygonHierarchy
                  | undefined
              )?.positions ?? []
            )
          );
        } else return;

        const lat = CesiumMath.toDegrees(cartoPosition.latitude);
        const lon = CesiumMath.toDegrees(cartoPosition.longitude);

        return new SearchResult({
          name:
            entity.name ??
            (entity.properties![
              this.nameOfCatalogItemSearchField
            ].valueOf() as string),
          isImportant: false,
          clickAction: () =>
            this.terria.currentViewer.zoomTo(
              createZoomToFunction(lat, lon, bboxSize),
              time
            ),
          location: { latitude: lat, longitude: lon }
        });
      });

      return results.filter((res) => res !== undefined) as SearchResult[];
    }
  }
  return SearchableCatalogItemMixin;
}

namespace SearchableCatalogItemMixin {
  export interface Instance
    extends InstanceType<ReturnType<typeof SearchableCatalogItemMixin>> {}

  export function isMixedInto(model: any): model is Instance {
    return model?.hasSearchableCatalogItemMixin;
  }

  export const stratumName = "searchableCatalogItemStratum";
  StratumOrder.addLoadStratum(stratumName);
}

export default SearchableCatalogItemMixin;
