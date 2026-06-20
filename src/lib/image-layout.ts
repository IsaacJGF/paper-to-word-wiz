export type ImagePlacementAlign = "left" | "center" | "right";
export type ImagePlacementMode = "floating" | "block";

export type ImagePlacementLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  align?: ImagePlacementAlign;
  mode?: ImagePlacementMode;
};

export const DEFAULT_IMAGE_PLACEMENT_LAYOUT: ImagePlacementLayout = {
  x: 8,
  y: 12,
  width: 42,
  height: 28,
  rotation: 0,
  align: "center",
  mode: "floating",
};

export const DEFAULT_REFERENCE_IMAGE_BLOCK_LAYOUT: ImagePlacementLayout = {
  x: 0,
  y: 0,
  width: 70,
  height: 30,
  rotation: 0,
  align: "center",
  mode: "block",
};

export function normalizeImagePlacementLayout(value?: Partial<ImagePlacementLayout> | null): ImagePlacementLayout {
  const base = { ...DEFAULT_IMAGE_PLACEMENT_LAYOUT, ...(value ?? {}) };
  const width = clampNumber(base.width, 8, 95);
  const height = clampNumber(base.height, 8, 90);
  return {
    x: clampNumber(base.x, 0, 100 - width),
    y: clampNumber(base.y, 0, 100 - height),
    width,
    height,
    rotation: normalizeRotation(base.rotation),
    align: normalizeAlign(base.align),
    mode: normalizeMode(base.mode),
  };
}

export function clampNumber(value: unknown, min: number, max: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, n));
}

function normalizeRotation(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const normalized = ((n % 360) + 360) % 360;
  return Math.round(normalized * 10) / 10;
}

function normalizeAlign(value: unknown): ImagePlacementAlign {
  return value === "left" || value === "right" || value === "center" ? value : "center";
}

function normalizeMode(value: unknown): ImagePlacementMode {
  return value === "block" ? "block" : "floating";
}
