import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import ArcGisFeatureServerCatalogItemTraits from "./ArcGisFeatureServerCatalogItemTraits";
import {
  RER_POI_CATALOG_ITEM_TYPE,
  RER_POI_DEFAULT_NAME
} from "../../ModelMixins/RerPoiHelpers";

@traitClass({
  description:
    "Specialized ArcGIS Feature Server catalog item for Regione Emilia-Romagna RER3D POI dynamic loading.",
  example: {
    url: "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0",
    type: RER_POI_CATALOG_ITEM_TYPE,
    name: RER_POI_DEFAULT_NAME,
    id: "rer3d-poi"
  }
})
export default class RerPoiCatalogItemTraits extends ArcGisFeatureServerCatalogItemTraits {
  forceCesiumPrimitives: boolean = true;
}
