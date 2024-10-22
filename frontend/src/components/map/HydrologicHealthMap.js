import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "!mapbox-gl"; // eslint-disable-line import/no-webpack-loader-syntax
import styled, { ThemeProvider } from "styled-components/macro";
import ResetZoomControl from "./ResetZoomControl";
import { STARTING_LOCATION } from "../../constants";
import ToggleBasemapControl from "./ToggleBasemapControl";
import debounce from "lodash.debounce";
import ReactDOM from "react-dom";
import { jssPreset, StylesProvider } from "@material-ui/core/styles";
import { ThemeProvider as MuiThemeProvider } from "@material-ui/styles";
import createTheme from "../../theme";
import Popup from "../../pages/publicMap/popup";
import { create } from "jss";
import { useSelector } from "react-redux";
import Legend from "./components/Legend";
import LegendControl from "./LegendControl";

const jss = create({
  ...jssPreset(),
  insertionPoint: document.getElementById("jss-insertion-point"),
});

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const Root = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const TimeseriesComparisonMap = ({
  selectedYearsOfHistory,
  dataPointsData,
  dataPointsError,
  dataPointsIsLoading,
  hucData,
  hucError,
  hucIsLoading,
}) => {
  const theme = useSelector((state) => state.themeReducer);
  const [mapIsLoaded, setMapIsLoaded] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  const [map, setMap] = useState();

  const popUpRef = useRef(
    new mapboxgl.Popup({
      maxWidth: "400px",
      offset: 15,
      focusAfterOpen: false,
    })
  );
  const mapContainer = useRef(null); // create a reference to the map container

  const DUMMY_BASEMAP_LAYERS = [
    { url: "streets-v11", icon: "commute" },
    { url: "outdoors-v11", icon: "park" },
    { url: "satellite-streets-v11", icon: "satellite_alt" },
  ];

  const locationsLayer = {
    id: "locations",
    type: "circle",
    source: "locations",
    paint: {
      "circle-stroke-width": 1,
      "circle-stroke-color": "black",
      "circle-radius": 7,
      "circle-color": [
        "case",
        ["<", ["get", "hydroHealthPct"], 50],
        "#E0393D",
        ["<=", ["get", "hydroHealthPct"], 69],
        "#E1AC3E",
        ["<=", ["get", "hydroHealthPct"], 89],
        "#E1E63E",
        ["<=", ["get", "hydroHealthPct"], 109],
        "#6EE53D",
        ["<=", ["get", "hydroHealthPct"], 129],
        "#8AF7E3",
        ["<=", ["get", "hydroHealthPct"], 149],
        "#33B6E8",
        ["<=", ["get", "hydroHealthPct"], 1000],
        "#3539FC",
        "black",
      ],
    },
    lreProperties: {
      popup: {
        titleField: "description",
        excludeFields: ["index", "description"],
      },
    },
  };

  const huc8Fill = {
    id: "huc-8-boundaries-fill",
    name: "HUC 8 Boundaries",
    type: "fill",
    source: "huc-8-boundaries",
    "source-layer": "WBDHU08_UpperSnake-6vc1aa",
    paint: {
      "fill-color": [
        "case",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          50,
        ],
        "#E0393D",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          69,
        ],
        "#E1AC3E",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          89,
        ],
        "#E1E63E",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          109,
        ],
        "#6EE53D",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          129,
        ],
        "#8AF7E3",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          149,
        ],
        "#33B6E8",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          1000,
        ],
        "#3539FC",
        "black",
      ],
      "fill-opacity": [
        "case",
        ["boolean", ["to-boolean", ["feature-state", "1"]]],
        0.7,
        0.2,
      ],
    },
    lreProperties: {
      layerGroup: "huc-8-boundaries",
    },
    drawOrder: 99,
  };

  const huc8Line = {
    id: "huc-8-boundaries-line",
    name: "HUC 8 Boundaries",
    type: "line",
    source: "huc-8-boundaries",
    "source-layer": "WBDHU08_UpperSnake-6vc1aa",
    paint: {
      "line-color": "#60BAF0",
      "line-width": 2,
    },
    lreProperties: {
      layerGroup: "huc-8-boundaries",
    },
    drawOrder: 99,
  };

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/" + DUMMY_BASEMAP_LAYERS[0].url,
      center: STARTING_LOCATION,
      zoom: 6,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-left");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        // When active the map will receive updates to the device's location as it changes.
        trackUserLocation: true,
        // Draw an arrow next to the location dot to indicate which direction the device is heading.
        showUserHeading: true,
      }),
      "top-left"
    );
    map.addControl(new mapboxgl.FullscreenControl());
    // Add locate control to the map.
    map.addControl(new ResetZoomControl(), "top-left");

    DUMMY_BASEMAP_LAYERS.forEach((layer) => {
      return map.addControl(new ToggleBasemapControl(layer.url, layer.icon));
    });

    map.on("load", () => {
      setMapIsLoaded(true);
      setMap(map);
    });
  }, []); // eslint-disable-line

  //resizes map when mapContainerRef dimensions changes (sidebar toggle)
  useEffect(() => {
    if (map) {
      const resizer = new ResizeObserver(debounce(() => map.resize(), 100));
      resizer.observe(mapContainer.current);
      return () => {
        resizer.disconnect();
      };
    }
  }, [map]);

  useEffect(() => {
    if (
      mapIsLoaded &&
      hucData?.length > 0 &&
      dataPointsData?.length > 0 &&
      typeof map != "undefined"
    ) {
      if (!map.getSource("locations")) {
        map.addSource("huc-8-boundaries", {
          type: "vector",
          url: "mapbox://idahoswc.1rdlvyx6",
          promoteId: "Name",
        });

        hucData.forEach((row) => {
          row.forEach((item) => {
            map.setFeatureState(
              {
                source: "huc-8-boundaries",
                sourceLayer: "WBDHU08_UpperSnake-6vc1aa",
                id: item.huc8_name,
              },
              { [item.yrs_inc_in_avg]: item.hydro_health_pct }
            );
          });
        });

        map.addLayer(huc8Fill);
        map.addLayer(huc8Line);

        map.addSource("locations", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: dataPointsData.map((location, i) => {
              return {
                id: i,
                type: "Feature",
                properties: {
                  description: location.loc_name,
                  index: location.loc_ndx,
                  locType: location.loc_type_name,
                  huc8: location.huc8_name,
                  huc10: location.huc10_name,
                  indicator: location.indicator,
                  medianIndicator: location.median_indicator,
                  hydroHealthPct: location.hydro_health_pct,
                  yearsIncludedInAverage: location.yrs_inc_in_avg,
                },
                geometry: {
                  type: location.location_geometry.type,
                  coordinates: location.location_geometry.coordinates,
                },
              };
            }),
          },
        });
        // Add a layer showing the places.
        map.addLayer(locationsLayer);

        map.setFilter("locations", [
          "==",
          ["get", "yearsIncludedInAverage"],
          selectedYearsOfHistory,
        ]);

        map.on("click", "huc-8-boundaries-fill", (e) => {
          const feature = map
            .queryRenderedFeatures(e.point)
            .filter((feature) => feature?.properties?.Name)[0];

          const description = feature.properties.Name;

          const huc8Popup = new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(description)
            .addTo(map);

          map.on("closeAllPopups", () => {
            huc8Popup.remove();
          });
        });

        map.on("click", "locations", (e) => {
          map.fire("closeAllPopups");

          const features = map.queryRenderedFeatures(e.point);
          const myFeatures = features.filter(
            (feature) => feature.source === "locations"
          );
          const coordinates = [e.lngLat.lng, e.lngLat.lat];
          const popupNode = document.createElement("div");
          ReactDOM.render(
            //MJB adding style providers to the popup
            <StylesProvider jss={jss}>
              <MuiThemeProvider theme={createTheme(theme.currentTheme)}>
                <ThemeProvider theme={createTheme(theme.currentTheme)}>
                  <Popup
                    layers={[locationsLayer]}
                    features={myFeatures}
                    height="100%"
                    width="100%"
                  />
                </ThemeProvider>
              </MuiThemeProvider>
            </StylesProvider>,
            popupNode
          );
          popUpRef.current
            .setLngLat(coordinates)
            .setDOMContent(popupNode)
            .addTo(map);
        });

        // Change the cursor to a pointer when the mouse is over the places layer.
        map.on("mouseenter", "locations", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        // Change it back to a pointer when it leaves.
        map.on("mouseleave", "locations", () => {
          map.getCanvas().style.cursor = "";
        });
      }
    } //eslint-disable-next-line
  }, [
    dataPointsIsLoading,
    hucIsLoading,
    mapIsLoaded,
    map,
    dataPointsData,
    hucData,
  ]);

  useEffect(() => {
    if (map !== undefined && map.getLayer("locations")) {
      map.setFilter("locations", [
        "==",
        ["get", "yearsIncludedInAverage"],
        selectedYearsOfHistory,
      ]);
      map.setPaintProperty("huc-8-boundaries-fill", "fill-color", [
        "case",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          50,
        ],
        "#E0393D",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          69,
        ],
        "#E1AC3E",
        [
          "<",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          89,
        ],
        "#E1E63E",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          109,
        ],
        "#6EE53D",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          129,
        ],
        "#8AF7E3",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          149,
        ],
        "#33B6E8",
        [
          "<=",
          [
            "coalesce",
            ["feature-state", ["literal", "" + selectedYearsOfHistory]],
            1001,
          ],
          1000,
        ],
        "#3539FC",
        "black",
      ]);
    }
  }, [selectedYearsOfHistory]); // eslint-disable-line

  const monitoringLegendColors = [
    { name: `≥ 150%`, color: `#3439FC` },
    { name: `130% - 149%`, color: `#36B8EA` },
    { name: `110% - 129%`, color: `#8BF9E5` },
    { name: `90% - 109%`, color: `#6FE73F` },
    { name: `70% - 89%`, color: `#E0E53C` },
    { name: `50% - 69%`, color: `#E0AB3D` },
    { name: `< 50%`, color: `#E13A3E` },
    { name: `No data`, color: `black` },
  ];

  if (dataPointsError)
    return "An error has occurred: " + dataPointsError.message;

  if (hucError) return "An error has occurred: " + hucError.message;

  return (
    <Root>
      <MapContainer ref={mapContainer} />
      {legendVisible && <Legend legendColors={monitoringLegendColors} />}
      <LegendControl
        open={legendVisible}
        onToggle={() => setLegendVisible(!legendVisible)}
      />
    </Root>
  );
};

export default TimeseriesComparisonMap;
