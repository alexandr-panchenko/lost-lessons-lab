export type RenderQuality = {
  antialias: boolean;
  lowDetail: boolean;
  resolution: number;
};

export function chooseRenderQuality(input: {
  devicePixelRatio: number;
  hardwareConcurrency: number;
  reducedMotion: boolean;
}): RenderQuality {
  const lowDetail = input.reducedMotion || input.hardwareConcurrency <= 2;
  return {
    antialias: !lowDetail,
    lowDetail,
    resolution: lowDetail ? 1 : Math.min(input.devicePixelRatio || 1, 2),
  };
}

export function shouldForceRendererFailure(scope: object): boolean {
  return Reflect.get(scope, "__LOST_LESSONS_TEST_RENDERER_FAILURE__") === true;
}
