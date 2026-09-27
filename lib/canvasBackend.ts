import { api } from "@/convex/_generated/api";
import { WORLD_WIDTH, WORLD_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT } from "@/convex/constants";

export interface CanvasBackend {
  strokesApi: {
    submit: typeof api.strokes.submit | typeof api.boardStrokes.submit;
    listSince: typeof api.strokes.listSince | typeof api.boardStrokes.listSince;
  };
  presenceApi: {
    heartbeat: typeof api.presence.heartbeat | typeof api.boardPresence.heartbeat;
    list: typeof api.presence.list | typeof api.boardPresence.list;
  };
  commentsApi: {
    create: typeof api.comments.create | typeof api.boardComments.create;
    remove: typeof api.comments.remove | typeof api.boardComments.remove;
    list: typeof api.comments.list | typeof api.boardComments.list;
    adminRemove: typeof api.comments.adminRemove | typeof api.boardComments.adminRemove;
  };
  reportsApi: {
    create: typeof api.reports.create | typeof api.boardReports.create;
  };
  worldWidth: number;
  worldHeight: number;
  /** True for Board only: a press in the letterboxed margin is ignored
   * rather than clamped onto the nearest edge. The wall keeps its
   * long-standing forgiving clamp — its "void" is just unzoomed emptiness,
   * not a permanent frame around the drawable area. */
  rejectsOffCanvasInput: boolean;
  /** False for Board: camera is locked to an auto-fit zoom, never
   * user-adjustable (see GlobalCanvas.tsx's camera-lock logic). */
  supportsZoomPan: boolean;
  /** False for Board: redundant when the whole world is always fully
   * visible on screen at once. */
  showMinimap: boolean;
  /** False for Board: its world is small enough that every stroke/cursor
   * is always "visible" — no tile-scoped subscriptions needed. */
  usesTileScoping: boolean;
}

export const wallBackend: CanvasBackend = {
  strokesApi: { submit: api.strokes.submit, listSince: api.strokes.listSince },
  presenceApi: { heartbeat: api.presence.heartbeat, list: api.presence.list },
  commentsApi: {
    create: api.comments.create,
    remove: api.comments.remove,
    list: api.comments.list,
    adminRemove: api.comments.adminRemove,
  },
  reportsApi: { create: api.reports.create },
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  rejectsOffCanvasInput: false,
  supportsZoomPan: true,
  showMinimap: true,
  usesTileScoping: true,
};

export const boardBackend: CanvasBackend = {
  strokesApi: { submit: api.boardStrokes.submit, listSince: api.boardStrokes.listSince },
  presenceApi: { heartbeat: api.boardPresence.heartbeat, list: api.boardPresence.list },
  commentsApi: {
    create: api.boardComments.create,
    remove: api.boardComments.remove,
    list: api.boardComments.list,
    adminRemove: api.boardComments.adminRemove,
  },
  reportsApi: { create: api.boardReports.create },
  worldWidth: BOARD_WIDTH,
  worldHeight: BOARD_HEIGHT,
  rejectsOffCanvasInput: true,
  supportsZoomPan: false,
  showMinimap: false,
  usesTileScoping: false,
};
