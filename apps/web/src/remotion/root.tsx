import { Composition } from "remotion";

import { prMergeVideoInputSchema } from "../schemas/pr-merge-video";
import { starVideoInputSchema } from "../schemas/star-video";
import {
  DEFAULT_PR_MERGE_VIDEO_PROPS,
  PR_MERGE_VIDEO_DURATION_IN_FRAMES,
  PR_MERGE_VIDEO_FPS,
  PR_MERGE_VIDEO_HEIGHT,
  PR_MERGE_VIDEO_WIDTH,
} from "./pr-merge-video/constants";
import { PrMergeVideo } from "./pr-merge-video/pr-merge-video";
import {
  DEFAULT_STAR_VIDEO_PROPS,
  VIDEO_DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./star-video/constants";
import { StarVideo } from "./star-video/star-video";

export function RemotionRoot() {
  return (
    <>
      <Composition
        component={StarVideo}
        defaultProps={DEFAULT_STAR_VIDEO_PROPS}
        durationInFrames={VIDEO_DURATION_IN_FRAMES}
        fps={VIDEO_FPS}
        height={VIDEO_HEIGHT}
        id="StarVideo"
        schema={starVideoInputSchema}
        width={VIDEO_WIDTH}
      />
      <Composition
        component={PrMergeVideo}
        defaultProps={DEFAULT_PR_MERGE_VIDEO_PROPS}
        durationInFrames={PR_MERGE_VIDEO_DURATION_IN_FRAMES}
        fps={PR_MERGE_VIDEO_FPS}
        height={PR_MERGE_VIDEO_HEIGHT}
        id="PrMergeVideo"
        schema={prMergeVideoInputSchema}
        width={PR_MERGE_VIDEO_WIDTH}
      />
    </>
  );
}
