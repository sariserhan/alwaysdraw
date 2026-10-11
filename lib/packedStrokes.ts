import type { ServerStroke } from "./types";

// A lossless transport format, not a raster snapshot. Repeated author/brush
// metadata is sent once per page; coordinates retain their original precision.
export type StrokeStyle = Pick<ServerStroke,
  "clientId" | "username" | "countryCode" | "mode" | "brushType" | "color" | "width" | "opacity">;
export type PackedStrokes = {
  styles: StrokeStyle[];
  strokes: { id: string; style: number; seq: number; time: number; clientTime: number;
    xy: number[]; tiles?: string[] }[];
};

export function packStrokes(rows: ServerStroke[]): PackedStrokes {
  const styles: StrokeStyle[] = [];
  const indexes = new Map<string, number>();
  const strokes = rows.map((row) => {
    const style: StrokeStyle = {
      clientId: row.clientId, mode: row.mode, color: row.color, width: row.width,
      ...(row.username !== undefined && { username: row.username }),
      ...(row.countryCode !== undefined && { countryCode: row.countryCode }),
      ...(row.brushType !== undefined && { brushType: row.brushType }),
      ...(row.opacity !== undefined && { opacity: row.opacity }),
    };
    const key = JSON.stringify(style);
    let index = indexes.get(key);
    if (index === undefined) {
      index = styles.length;
      indexes.set(key, index);
      styles.push(style);
    }
    return {
      id: row.clientStrokeId, style: index, seq: row.sequence,
      time: row.serverTimestamp, clientTime: row.clientTimestamp,
      xy: row.points.flatMap(({ x, y }) => [x, y]),
      ...(row.tiles !== undefined && { tiles: row.tiles }),
    };
  });
  return { styles, strokes };
}

export function unpackStrokes(page: PackedStrokes): ServerStroke[] {
  return page.strokes.map((row) => {
    const style = page.styles[row.style];
    if (!style || row.xy.length % 2) throw new Error("Invalid packed stroke page");
    const points = [];
    for (let i = 0; i < row.xy.length; i += 2) points.push({ x: row.xy[i], y: row.xy[i + 1] });
    return {
      ...style, clientStrokeId: row.id, sequence: row.seq,
      serverTimestamp: row.time, clientTimestamp: row.clientTime, points,
      ...(row.tiles !== undefined && { tiles: row.tiles }),
    };
  });
}
