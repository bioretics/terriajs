import { TFunction } from "i18next";
import { toJS } from "mobx";
import React from "react";
import { withTranslation } from "react-i18next";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import { JsonObject } from "../../Core/Json";
import GeoJsonMixin, { FEATURE_ID_PROP } from "../../ModelMixins/GeojsonMixin";
import TerriaFeature from "../../Models/Feature/Feature";
import ViewState from "../../ReactViewModels/ViewState";
import Icon from "../../Styled/Icon";
import { DownloadLink } from "../../ViewModels/MeasurableGeometry/MeasurableGeometryDownload";
import MeasurableGeometryExporter from "../../ViewModels/MeasurableGeometry/MeasurableGeometryExporter";
import { MeasurableGeometry } from "../../ViewModels/MeasurableGeometry/MeasurableGeometryManager";
import { withViewState } from "../Context";
import Styles from "./feature-info-download.scss";
import Dropdown from "../Generic/Dropdown";
import { propertyGetTimeValues } from "./getFeatureProperties";

interface PropsType {
  name: string;
  feature: TerriaFeature;
  catalogItem?: unknown;
  viewState: ViewState;
  t: TFunction;
}

interface StateType {
  links: DownloadLink[];
}

class FeatureInfoGeometryDownload extends React.Component<
  PropsType,
  StateType
> {
  state: StateType = { links: [] };

  componentDidMount() {
    this.generateLinks();
  }

  componentDidUpdate(prevProps: PropsType) {
    if (
      prevProps.feature !== this.props.feature ||
      prevProps.catalogItem !== this.props.catalogItem
    ) {
      this.generateLinks();
    }
  }

  private async generateLinks() {
    const converted = toMeasurableGeometries(
      this.props.feature,
      this.props.catalogItem
    );
    if (!converted) {
      this.setState({ links: [] });
      return;
    }

    try {
      const links = await MeasurableGeometryExporter.generateAllDownloadLinks(
        converted.geoms[0],
        this.props.name,
        converted.geoms.length > 1,
        Ellipsoid.WGS84,
        converted.geoms
      );
      this.setState({ links });
    } catch (error) {
      console.error("Unable to generate geometry download links:", error);
      this.setState({ links: [] });
    }
  }

  render() {
    const { t } = this.props;
    if (this.state.links.length === 0) return null;

    const icon = (
      <span className={Styles.iconDownload}>
        <Icon glyph={Icon.GLYPHS.opened} />
      </span>
    );

    return (
      <Dropdown
        options={this.state.links}
        textProperty="label"
        theme={{
          dropdown: Styles.download,
          list: Styles.dropdownList,
          button: Styles.dropdownButton,
          icon: icon
        }}
      >
        {t("featureInfo.downloadGeometry")}
      </Dropdown>
    );
  }
}

function toMeasurableGeometries(
  feature: TerriaFeature,
  catalogItem: unknown
): { geoms: MeasurableGeometry[] } | undefined {
  const pickedProperties =
    propertyGetTimeValues(feature, JulianDate.now()) ?? {};
  const featureProperties = { ...toJS(pickedProperties) };
  delete featureProperties[FEATURE_ID_PROP];

  const source = getSourceGeoJsonFeature(pickedProperties, catalogItem);
  if (source) {
    return geoJsonGeometryToGeoms(
      source.geometry as JsonObject,
      (source.properties as JsonObject) ?? featureProperties
    );
  }

  return entityGraphicsToGeoms(feature, featureProperties);
}

function getSourceGeoJsonFeature(
  pickedProperties: JsonObject,
  catalogItem: unknown
): JsonObject | undefined {
  if (!GeoJsonMixin.isMixedInto(catalogItem) || !catalogItem.readyData) {
    return undefined;
  }

  const featureId = pickedProperties[FEATURE_ID_PROP];
  if (featureId === undefined || featureId === null) return undefined;

  const sourceFeature = catalogItem.readyData.features.find(
    (f) => f.properties?.[FEATURE_ID_PROP] === featureId
  );
  if (!sourceFeature?.geometry) return undefined;

  const copy = toJS(sourceFeature) as unknown as JsonObject;
  const properties = { ...((copy.properties as JsonObject) ?? {}) };
  delete properties[FEATURE_ID_PROP];
  return { ...copy, properties };
}

function geoJsonGeometryToGeoms(
  geometry: JsonObject,
  properties: JsonObject
): { geoms: MeasurableGeometry[] } | undefined {
  const coordinates = geometry.coordinates as any;

  switch (geometry.type) {
    case "Point":
      return {
        geoms: [buildGeom([toCartographic(coordinates)], properties, "points")]
      };
    case "MultiPoint":
      return {
        geoms: [
          buildGeom(
            (coordinates as any[]).map(toCartographic),
            properties,
            "points"
          )
        ]
      };
    case "LineString":
      return {
        geoms: [
          buildGeom(
            (coordinates as any[]).map(toCartographic),
            properties,
            "line"
          )
        ]
      };
    case "MultiLineString":
      return {
        geoms: (coordinates as any[]).map((line) =>
          buildGeom(line.map(toCartographic), properties, "line")
        )
      };
    case "Polygon":
      return {
        geoms: [
          buildGeom(
            dropClosingPoint((coordinates[0] as any[]).map(toCartographic)),
            properties,
            "polygon"
          )
        ]
      };
    case "MultiPolygon":
      return {
        geoms: (coordinates as any[]).map((polygon) =>
          buildGeom(
            dropClosingPoint((polygon[0] as any[]).map(toCartographic)),
            properties,
            "polygon"
          )
        )
      };
    default:
      return undefined;
  }
}

function entityGraphicsToGeoms(
  feature: TerriaFeature,
  properties: JsonObject
): { geoms: MeasurableGeometry[] } | undefined {
  const time = JulianDate.now();

  const hierarchy = feature.polygon?.hierarchy?.getValue(time);
  if (hierarchy?.positions?.length > 0) {
    const points = hierarchy.positions.map((p: any) =>
      Cartographic.fromCartesian(p)
    );
    return {
      geoms: [buildGeom(dropClosingPoint(points), properties, "polygon")]
    };
  }

  const linePositions = feature.polyline?.positions?.getValue(time);
  if (Array.isArray(linePositions) && linePositions.length > 1) {
    return {
      geoms: [
        buildGeom(
          linePositions.map((p) => Cartographic.fromCartesian(p)),
          properties,
          "line"
        )
      ]
    };
  }

  const position = feature.position?.getValue(time);
  if (position) {
    return {
      geoms: [
        buildGeom([Cartographic.fromCartesian(position)], properties, "points")
      ]
    };
  }

  return undefined;
}

function buildGeom(
  stopPoints: Cartographic[],
  properties: JsonObject,
  kind: "points" | "line" | "polygon"
): MeasurableGeometry {
  const stopGeodeticDistances = stopPoints.map((point, index) => {
    if (index === 0) return 0;
    return new EllipsoidGeodesic(stopPoints[index - 1], point, Ellipsoid.WGS84)
      .surfaceDistance;
  });
  const stopAirDistances = stopPoints.map((point, index) => {
    if (index === 0) return 0;
    const heightDiff = point.height - stopPoints[index - 1].height;
    return Math.hypot(stopGeodeticDistances[index], heightDiff);
  });
  const sum = (values: number[]) =>
    values.reduce((acc, value) => acc + value, 0);

  const pathNotes =
    typeof properties.path_notes === "string" ? properties.path_notes : "";

  return {
    isClosed: kind === "polygon",
    hasArea: kind === "polygon",
    onlyPoints: kind === "points",
    stopPoints,
    stopGeodeticDistances,
    stopAirDistances,
    stopGroundDistances: stopAirDistances,
    geodeticDistance: sum(stopGeodeticDistances),
    airDistance: sum(stopAirDistances),
    groundDistance: sum(stopAirDistances),
    pathNotes,
    featureProperties: properties
  };
}

function toCartographic(coordinates: any[]): Cartographic {
  return Cartographic.fromDegrees(
    coordinates[0],
    coordinates[1],
    coordinates[2] ?? 0
  );
}

function dropClosingPoint(ring: Cartographic[]): Cartographic[] {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (
      first.longitude === last.longitude &&
      first.latitude === last.latitude
    ) {
      return ring.slice(0, -1);
    }
  }
  return ring;
}

export default withTranslation()(withViewState(FeatureInfoGeometryDownload));
