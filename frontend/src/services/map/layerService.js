import * as Cesium from 'cesium';

/**
 * DRAS v2.0 — Cesium Layer & Environment Service
 * Handles base map switching, terrain loading, day/night lighting, and layer visibility.
 */

export const BASEMAP_PROVIDERS = {
  SATELLITE: {
    name: 'Satellite (Esri World Imagery)',
    type: 'arcgis',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    credit: '© Esri World Imagery'
  },
  STANDARD: {
    name: 'Standard (Voyager)',
    type: 'url_template',
    url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    maxLevel: 19,
    credit: '© CartoDB Voyager | © OpenStreetMap contributors'
  },
  DARK: {
    name: 'Dark Matter',
    type: 'url_template',
    url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    maxLevel: 19,
    credit: '© CartoDB Dark Matter'
  }
};

let activeSwitchId = 0;

export const layerService = {
  /**
   * Switches base imagery layer between Satellite, Standard, and Dark
   */
  setBaseMap: async (viewer, baseMapType = 'SATELLITE') => {
    if (!viewer || !viewer.imageryLayers || !viewer.scene) return;
    if (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed()) return;

    const switchId = ++activeSwitchId;
    const config = BASEMAP_PROVIDERS[baseMapType] || BASEMAP_PROVIDERS.SATELLITE;

    try {
      let provider;
      if (config.type === 'arcgis') {
        try {
          provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(config.url, {
            enablePickFeatures: false
          });
        } catch (arcErr) {
          console.warn('ArcGisMapServerImageryProvider.fromUrl failed, using UrlTemplate fallback', arcErr);
          provider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19
          });
        }
      } else {
        provider = new Cesium.UrlTemplateImageryProvider({
          url: config.url,
          maximumLevel: config.maxLevel || 19,
          credit: config.credit
        });
      }

      if (switchId !== activeSwitchId) return;
      if (!viewer || !viewer.imageryLayers || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;

      // Cleanly replace imagery layer
      viewer.imageryLayers.removeAll();
      viewer._currentBaseLayer = viewer.imageryLayers.addImageryProvider(provider);
    } catch (e) {
      if (switchId !== activeSwitchId) return;
      console.warn('Failed to switch base map provider, using emergency fallback', e);
      try {
        if (!viewer || !viewer.imageryLayers || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
        viewer.imageryLayers.removeAll();
        const fallback = new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19
        });
        viewer._currentBaseLayer = viewer.imageryLayers.addImageryProvider(fallback);
      } catch (err2) {
        console.error('All base map providers failed', err2);
      }
    }
  },

  /**
   * Toggles 3D terrain support. Gracefully falls back to WGS84 Ellipsoid if ion token is absent.
   */
  setTerrain: async (viewer, enableTerrain = true, ionToken = '') => {
    if (!viewer) return { active: false, type: 'ellipsoid' };

    if (!enableTerrain) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      return { active: false, type: 'ellipsoid' };
    }

    if (ionToken && ionToken.trim().length > 10) {
      try {
        Cesium.Ion.defaultAccessToken = ionToken.trim();
        const terrain = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        });
        viewer.terrainProvider = terrain;
        return { active: true, type: 'cesium_world_terrain' };
      } catch (err) {
        console.warn('Cesium World Terrain unavailable with provided token, using WGS84 Ellipsoid', err);
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        return { active: false, type: 'ellipsoid_fallback' };
      }
    } else {
      // Free default: standard WGS84 Ellipsoid terrain
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      return { active: false, type: 'ellipsoid' };
    }
  },

  /**
   * Configures Earth solar lighting (Day / Night / Automatic)
   */
  setEarthLighting: (viewer, lightingMode = 'DAY') => {
    if (!viewer || !viewer.scene || !viewer.scene.globe) return;

    const globe = viewer.scene.globe;

    if (lightingMode === 'DAY') {
      globe.enableLighting = false;
    } else if (lightingMode === 'NIGHT') {
      globe.enableLighting = true;
      // Set clock to night-time illumination
      const nightUtc = Cesium.JulianDate.fromDate(new Date('2026-09-20T00:00:00Z'));
      viewer.clock.currentTime = nightUtc;
      viewer.clock.shouldAnimate = false;
    } else if (lightingMode === 'AUTO') {
      globe.enableLighting = true;
      viewer.clock.currentTime = Cesium.JulianDate.now();
      viewer.clock.shouldAnimate = true;
    }
  }
};
