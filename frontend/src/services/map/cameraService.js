import * as Cesium from 'cesium';

/**
 * DRAS v2.0 — Google-Earth-Style Camera Controller
 * Manages smooth fly-to transitions, orbital descent, tilt, and route framing.
 */

export const SCENARIO_VIEWPOINTS = {
  1: { // Woolsey Fire 2018 (California, USA)
    name: 'Woolsey Fire 2018 (Malibu Impact Core)',
    lat: 34.045,
    lon: -118.688,
    range: 1400,
    baseElevation: 0,
    pitch: -45,
    heading: 10
  },
  2: { // Chamoli Flash Flood 2021 (Uttarakhand, India)
    name: 'Chamoli Glacial Surge 2021 (Raini-Tapovan Corridor)',
    lat: 30.441,
    lon: 79.620,
    range: 1700,
    baseElevation: 0,
    pitch: -38,
    heading: 10
  },
  3: { // Cyclone Fani 2019 (Odisha, India)
    name: 'Cyclone Fani 2019 (Puri Coastal Nexus)',
    lat: 19.805,
    lon: 85.825,
    range: 1400,
    baseElevation: 0,
    pitch: -45,
    heading: 0
  },
  4: { // Dharali Flash Flood 2025 (Uttarakhand, India)
    name: 'Dharali Cloudburst 2025 (Debris Fan Confluence)',
    lat: 31.033,
    lon: 78.745,
    range: 1100,
    baseElevation: 0,
    pitch: -40,
    heading: 20
  }
};

let orbitListener = null;

export const cameraService = {
  /**
   * Dramatic flight from orbit down to disaster scenario building level
   */
  flyToScenario: (viewer, scenarioId = 1, isInitial = false) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera) return;

      const vp = SCENARIO_VIEWPOINTS[scenarioId] || SCENARIO_VIEWPOINTS[1];
      const baseElev = vp.baseElevation || 0;
      const targetAlt = baseElev + (vp.range * 0.95);

      if (isInitial) {
        // 1. Position camera directly above the incident area at medium altitude
        try {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(vp.lon, vp.lat - 0.02, Math.max(2800, targetAlt * 2.2)),
            orientation: new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(vp.heading), Cesium.Math.toRadians(-55), 0)
          });
        } catch (e) {
          // Fallback
        }

        // 2. Smoothly descend to building level
        setTimeout(() => {
          try {
            if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
            if (!viewer.camera) return;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                vp.lon,
                vp.lat - (vp.range / 111000) * 0.45,
                targetAlt
              ),
              orientation: {
                heading: Cesium.Math.toRadians(vp.heading),
                pitch: Cesium.Math.toRadians(vp.pitch),
                roll: 0.0
              },
              duration: 1.8,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
            });
          } catch (err) {}
        }, 200);
      } else {
        // Standard scenario transition
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            vp.lon,
            vp.lat - (vp.range / 111000) * 0.45,
            targetAlt
          ),
          orientation: {
            heading: Cesium.Math.toRadians(vp.heading),
            pitch: Cesium.Math.toRadians(vp.pitch),
            roll: 0.0
          },
          duration: 2.0,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
      }
    } catch (e) {}
  },

  /**
   * Smoothly flies to a specific building
   */
  flyToBuilding: (viewer, lon, lat, estimatedHeight = 15) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera || !lon || !lat) return;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0018, Math.max(160, estimatedHeight * 10)),
        orientation: {
          heading: Cesium.Math.toRadians(12),
          pitch: Cesium.Math.toRadians(-32),
          roll: 0.0
        },
        duration: 1.6,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
      });
    } catch (e) {}
  },

  /**
   * Smoothly fits camera to encompass the full route
   */
  flyToRoute: (viewer, routeCoords = []) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera || !routeCoords || routeCoords.length < 2) return;

      const positions = [];
      for (const pt of routeCoords) {
        positions.push(Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 0));
      }

      const sphere = Cesium.BoundingSphere.fromPoints(positions);
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(25),
          Cesium.Math.toRadians(-38),
          sphere.radius * 2.2
        ),
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
      });
    } catch (e) {}
  },

  /**
   * Resets heading to North smoothly
   */
  resetNorth: (viewer) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera) return;

      const currentPitch = viewer.camera.pitch;
      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: 0,
          pitch: currentPitch,
          roll: 0
        },
        duration: 1.0
      });
    } catch (e) {}
  },

  /**
   * Toggles between top-down 2.5D (-90°) and 3D perspective (-35°)
   */
  toggleTilt: (viewer) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera) return;

      const currentPitchDeg = Cesium.Math.toDegrees(viewer.camera.pitch);
      const targetPitch = currentPitchDeg < -60 ? -35 : -88;

      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: viewer.camera.heading,
          pitch: Cesium.Math.toRadians(targetPitch),
          roll: 0
        },
        duration: 1.2
      });
    } catch (e) {}
  },

  /**
   * Continuous smooth orbit around current center
   */
  toggleOrbit: (viewer, isOrbiting, setIsOrbiting) => {
    if (!viewer) return;

    if (isOrbiting) {
      if (orbitListener) {
        viewer.clock.onTick.removeEventListener(orbitListener);
        orbitListener = null;
      }
      setIsOrbiting(false);
    } else {
      orbitListener = () => {
        viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0015);
      };
      viewer.clock.onTick.addEventListener(orbitListener);
      setIsOrbiting(true);
    }
  },

  stopOrbit: (viewer) => {
    if (viewer && orbitListener) {
      viewer.clock.onTick.removeEventListener(orbitListener);
      orbitListener = null;
    }
  },

  /**
   * Smoothly zoom in towards target
   */
  zoomIn: (viewer, factor = 0.4) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera) return;
      const height = viewer.camera.positionCartographic?.height || 2000;
      viewer.camera.zoomIn(Math.max(50, height * factor));
    } catch (e) {}
  },

  /**
   * Smoothly zoom out away from target
   */
  zoomOut: (viewer, factor = 0.5) => {
    try {
      if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
      if (!viewer.camera) return;
      const height = viewer.camera.positionCartographic?.height || 2000;
      viewer.camera.zoomOut(Math.max(80, height * factor));
    } catch (e) {}
  }
};
