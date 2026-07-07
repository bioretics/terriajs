import FileSaver from "file-saver";

export default function downloadChartPoints(format, terria, chartItems, xAxis) {
  const payload = generatePointExportPayload(terria, chartItems, xAxis);

  const formats = {
    geojson: {
      filename: "chart-points.geojson",
      mimeType: "application/geo+json;charset=utf-8",
      content: generateGeoJson(payload)
    },
    kml: {
      filename: "chart-points.kml",
      mimeType: "application/vnd.google-earth.kml+xml;charset=utf-8",
      content: generateKml(payload)
    },
    csv: {
      filename: "chart-points.csv",
      mimeType: "text/csv;charset=utf-8",
      content: generateCsv(payload)
    },
    dxf: {
      filename: "chart-points.dxf",
      mimeType: "application/dxf;charset=utf-8",
      content: generateDxf(payload, chartItems)
    }
  };

  const selectedFormat = formats[format];
  if (!selectedFormat) {
    return;
  }

  FileSaver.saveAs(
    new Blob([selectedFormat.content], { type: selectedFormat.mimeType }),
    selectedFormat.filename
  );
}

function generatePointExportPayload(terria, chartItems, xAxis) {
  const geom = terria?.measurableGeomList?.[terria?.measurableGeometryIndex];

  if (geom) {
    return chartItems.flatMap((chartItem) => {
      const series = getGeometrySeries(geom, chartItem.key);
      if (!series) {
        return [];
      }

      return series.points.map((point, index) => ({
        seriesName: chartItem.name,
        seriesKey: chartItem.key,
        pointIndex: index,
        x: series.distances
          ? cumulativeDistance(series.distances, index)
          : null,
        y: point.height,
        longitude: degrees(point.longitude),
        latitude: degrees(point.latitude),
        height: point.height,
        description: series.descriptions?.[index] ?? ""
      }));
    });
  }

  return chartItems.flatMap((chartItem) =>
    chartItem.points.map((point, index) => ({
      seriesName: chartItem.name,
      seriesKey: chartItem.key,
      pointIndex: index,
      x: serializeChartValue(point.x, xAxis),
      y: point.y,
      longitude: null,
      latitude: null,
      height: null,
      description: ""
    }))
  );
}

function getGeometrySeries(geom, chartItemKey) {
  if (chartItemKey === "path") {
    return {
      points: geom.stopPoints ?? [],
      distances: geom.stopGroundDistances ?? [],
      descriptions: geom.pointDescriptions ?? []
    };
  }

  if (chartItemKey === "path_sampled") {
    return {
      points: geom.sampledPoints ?? [],
      distances: geom.sampledDistances ?? [],
      descriptions: geom.pointDescriptions ?? []
    };
  }

  return undefined;
}

function cumulativeDistance(distances, pointIndex) {
  return distances
    .slice(0, pointIndex + 1)
    .reduce((acc, distance) => acc + (distance ?? 0), 0);
}

function degrees(radians) {
  return (radians * 180) / Math.PI;
}

function serializeChartValue(value, xAxis) {
  if (value instanceof Date) {
    return xAxis?.scale === "time" ? value.toISOString() : value.getTime();
  }

  return value;
}

function generateCsv(rows) {
  const headers = [
    "series_name",
    "series_key",
    "point_index",
    "x",
    "y",
    "longitude",
    "latitude",
    "height",
    "description"
  ];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.seriesName,
        row.seriesKey,
        row.pointIndex,
        row.x,
        row.y,
        row.longitude,
        row.latitude,
        row.height,
        row.description
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n");
}

function generateGeoJson(rows) {
  return JSON.stringify({
    type: "FeatureCollection",
    name: "chart-points",
    features: rows.map((row) => ({
      type: "Feature",
      properties: {
        series_name: row.seriesName,
        series_key: row.seriesKey,
        point_index: row.pointIndex,
        x: row.x,
        y: row.y,
        height: row.height,
        description: row.description
      },
      geometry:
        row.longitude !== null && row.latitude !== null
          ? {
              type: "Point",
              coordinates: [row.longitude, row.latitude, row.height]
            }
          : {
              type: "Point",
              coordinates: [row.x, row.y]
            }
    }))
  });
}

function generateKml(rows) {
  const placemarks = rows
    .map((row) => {
      const coordinates =
        row.longitude !== null && row.latitude !== null
          ? `${row.longitude},${row.latitude},${row.height ?? 0}`
          : `${row.x},${row.y},0`;

      return `
        <Placemark>
          <name>${escapeXml(row.seriesName)} ${escapeXml(row.pointIndex)}</name>
          <description><![CDATA[
            <div><strong>Series:</strong> ${escapeXml(row.seriesName)}</div>
            <div><strong>Key:</strong> ${escapeXml(row.seriesKey)}</div>
            <div><strong>Point:</strong> ${escapeXml(row.pointIndex)}</div>
            <div><strong>x:</strong> ${escapeXml(row.x)}</div>
            <div><strong>y:</strong> ${escapeXml(row.y)}</div>
            <div><strong>Longitude:</strong> ${escapeXml(row.longitude)}</div>
            <div><strong>Latitude:</strong> ${escapeXml(row.latitude)}</div>
            <div><strong>Height:</strong> ${escapeXml(row.height)}</div>
            <div><strong>Description:</strong> ${escapeXml(
              row.description
            )}</div>
          ]]></description>
          <Point>
            <coordinates>${coordinates}</coordinates>
          </Point>
        </Placemark>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      <name>chart-points</name>
      ${placemarks}
    </Document>
  </kml>`;
}

function generateDxf(rows, chartItems) {
  const colorBySeries = new Map(
    chartItems.map((item) => [item.key, item.getColor()])
  );
  const seriesGroups = groupRowsBySeries(rows);

  const layers = new Map();
  const entities = [];

  seriesGroups.forEach(({ name, rows: seriesRows }, seriesKey) => {
    const aci = nearestAci(parseColor(colorBySeries.get(seriesKey)));

    const vertices = seriesRows
      .filter((row) => isFiniteNumber(row.x) && isFiniteNumber(row.y))
      .map((row) => [roundTo(row.x, 3), roundTo(row.y, 3)]);

    if (vertices.length === 0) {
      return;
    }

    const layer = sanitizeDxfLayerName(name);
    layers.set(layer, aci);
    if (vertices.length > 1) {
      entities.push(dxfPolyline(layer, vertices));
    }
    vertices.forEach((vertex) => entities.push(dxfPoint(layer, vertex)));
  });

  const header = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "0",
    "ENDSEC"
  ];

  const tables = [
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LTYPE",
    "70",
    "1",
    "0",
    "LTYPE",
    "2",
    "CONTINUOUS",
    "70",
    "0",
    "3",
    "Solid line",
    "72",
    "65",
    "73",
    "0",
    "40",
    "0.0",
    "0",
    "ENDTAB",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(layers.size + 1),
    "0",
    "LAYER",
    "2",
    "0",
    "70",
    "0",
    "62",
    "7",
    "6",
    "CONTINUOUS",
    ...Array.from(layers.entries()).flatMap(([layerName, layerAci]) => [
      "0",
      "LAYER",
      "2",
      layerName,
      "70",
      "0",
      "62",
      String(layerAci),
      "6",
      "CONTINUOUS"
    ]),
    "0",
    "ENDTAB",
    "0",
    "ENDSEC"
  ];

  const entitiesSection = [
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...entities.flat(),
    "0",
    "ENDSEC"
  ];

  return [...header, ...tables, ...entitiesSection, "0", "EOF"].join("\r\n");
}

function dxfPolyline(layer, vertices) {
  const tags = [
    "0",
    "POLYLINE",
    "8",
    layer,
    "66",
    "1",
    "70",
    "0",
    "10",
    "0",
    "20",
    "0",
    "30",
    "0"
  ];
  vertices.forEach(([x, y]) => {
    tags.push(
      "0",
      "VERTEX",
      "8",
      layer,
      "10",
      String(x),
      "20",
      String(y),
      "30",
      "0",
      "70",
      "0"
    );
  });
  tags.push("0", "SEQEND", "8", layer);
  return tags;
}

function dxfPoint(layer, [x, y]) {
  return [
    "0",
    "POINT",
    "8",
    layer,
    "10",
    String(x),
    "20",
    String(y),
    "30",
    "0"
  ];
}

function groupRowsBySeries(rows) {
  const bySeries = new Map();
  rows.forEach((row) => {
    if (!bySeries.has(row.seriesKey)) {
      bySeries.set(row.seriesKey, { name: row.seriesName, rows: [] });
    }
    bySeries.get(row.seriesKey).rows.push(row);
  });
  return bySeries;
}

function sanitizeDxfLayerName(name) {
  const sanitized = String(name ?? "layer")
    .replace(/[<>/\\":;?*|=`]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 255);
  return sanitized || "layer";
}

function parseColor(colorStr) {
  const str = String(colorStr ?? "").trim();
  if (str.startsWith("#")) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  return [255, 255, 255];
}

const ACI_PALETTE = [
  { aci: 1, rgb: [255, 0, 0] },
  { aci: 2, rgb: [255, 255, 0] },
  { aci: 3, rgb: [0, 255, 0] },
  { aci: 4, rgb: [0, 255, 255] },
  { aci: 5, rgb: [0, 0, 255] },
  { aci: 6, rgb: [255, 0, 255] },
  { aci: 7, rgb: [255, 255, 255] },
  { aci: 8, rgb: [128, 128, 128] }
];

function nearestAci([r, g, b]) {
  let best = ACI_PALETTE[0];
  let bestDist = Infinity;
  ACI_PALETTE.forEach((entry) => {
    const [er, eg, eb] = entry.rgb;
    const dist = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  });
  return best.aci;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function roundTo(value, decimals) {
  if (!isFiniteNumber(value)) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
