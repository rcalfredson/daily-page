import { performance } from 'node:perf_hooks';

import sharp from 'sharp';

export const FOREST_ASSET_TRANSPORT_RUNS = 'color-runs';
export const FOREST_ASSET_TRANSPORT_RASTER = 'lossless-raster';

const rasterAssetCache = new Map();

export function resolveForestAssetTransport(value) {
  return value === FOREST_ASSET_TRANSPORT_RASTER
    ? FOREST_ASSET_TRANSPORT_RASTER : FOREST_ASSET_TRANSPORT_RUNS;
}

export function clearForestSceneRasterAssetCache() {
  rasterAssetCache.clear();
}

export function forestSceneRasterAssetCacheSize() {
  return rasterAssetCache.size;
}

function colorChannels(color) {
  const value = color.startsWith('#') ? color.slice(1) : color;
  if (value.length === 3) {
    return [...value].map(channel => Number.parseInt(`${channel}${channel}`, 16));
  }
  if (value.length === 6) {
    return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
  }
  throw new Error(`Unsupported forest raster color: ${color}`);
}

function layerPixels(layer, dimensions) {
  const pixels = Buffer.alloc(dimensions.width * dimensions.height * 4);
  for (const run of layer.runs) {
    const [red, green, blue] = colorChannels(run.color);
    for (let x = run.x; x < run.x + run.width; x += 1) {
      const offset = ((run.y * dimensions.width) + x) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

async function encodeRasterLayer(layer, dimensions) {
  const png = await sharp(layerPixels(layer, dimensions), {
    raw: { ...dimensions, channels: 4 }
  }).png({ compressionLevel: 9 }).toBuffer();
  return {
    id: layer.id,
    mediaType: 'image/png',
    encoding: 'base64',
    data: png.toString('base64')
  };
}

async function encodeRasterAsset(asset) {
  const { layers, ...metadata } = asset;
  return {
    ...metadata,
    transport: FOREST_ASSET_TRANSPORT_RASTER,
    layers: await Promise.all(layers.map(layer => encodeRasterLayer(layer, asset.dimensions)))
  };
}

export async function encodeForestSceneAssets(assets, transport) {
  const startedAt = performance.now();
  let encodedAssetCount = 0;
  let reusedEncodedAssetCount = 0;
  let transportedAssets = assets;

  if (transport === FOREST_ASSET_TRANSPORT_RASTER) {
    transportedAssets = [];
    for (const asset of assets) {
      if (!rasterAssetCache.has(asset.cacheKey)) {
        rasterAssetCache.set(asset.cacheKey, encodeRasterAsset(asset));
        encodedAssetCount += 1;
      } else {
        reusedEncodedAssetCount += 1;
      }
      const cached = rasterAssetCache.get(asset.cacheKey);
      try {
        const rasterAsset = await cached;
        if (rasterAssetCache.get(asset.cacheKey) === cached) {
          rasterAssetCache.set(asset.cacheKey, rasterAsset);
        }
        transportedAssets.push(rasterAsset);
      } catch (error) {
        if (rasterAssetCache.get(asset.cacheKey) === cached) {
          rasterAssetCache.delete(asset.cacheKey);
        }
        throw error;
      }
    }
  }

  const serialized = JSON.stringify(transportedAssets);
  return {
    assets: transportedAssets,
    diagnostics: {
      durationMilliseconds: performance.now() - startedAt,
      encodedAssetCount,
      reusedEncodedAssetCount,
      encodedPayloadBytes: Buffer.byteLength(serialized, 'utf8')
    }
  };
}
