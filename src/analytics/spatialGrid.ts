// A uniform spatial hash grid, used to make DBSCAN's neighbor queries fast.
//
// WHY: textbook DBSCAN's regionQuery(point) — "find every other point
// within eps meters" — is a linear scan over ALL points if done naively,
// making the whole algorithm O(n²). For a location history with hundreds
// of thousands to millions of points, that's far too slow.
//
// A grid with cell size == eps fixes this: any point within eps of P must
// live in P's own cell or one of the 8 cells touching it (a cell is eps
// wide, so nothing farther than one cell away can possibly be within eps).
// So a region query only has to look at 9 cells instead of the whole
// dataset — for realistic, spatially-clustered movement data (a handful of
// places you actually spend time, not points spread evenly over the globe)
// that keeps each query close to O(1), making the whole clustering pass
// close to O(n) instead of O(n²).
//
// The grid itself is built on an approximate LOCAL METER projection
// (equirectangular, centered on the dataset's mean latitude) rather than
// raw lat/lng degrees, because a degree of longitude shrinks toward the
// poles (cos(latitude)) while a degree of latitude doesn't — using raw
// degrees would make grid cells wider than they are tall everywhere except
// the equator. The projection only has to be good enough that physically
// nearby points land in nearby cells; the actual "is this within eps"
// check (done by the caller, in dbscan.ts) always uses real haversine
// distance, so the projection's inaccuracy can never produce a wrong
// cluster — only, in principle, a few more candidates than strictly
// necessary to check.

const METERS_PER_DEGREE_LAT = 111_320

export class SpatialGrid {
  private metersPerDegreeLng: number
  private cells = new Map<string, number[]>()

  constructor(
    private lat: Float64Array,
    private lng: Float64Array,
    private cellSizeMeters: number,
  ) {
    let latSum = 0
    for (let i = 0; i < lat.length; i++) latSum += lat[i]
    const refLat = lat.length > 0 ? latSum / lat.length : 0
    this.metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((refLat * Math.PI) / 180)

    for (let i = 0; i < lat.length; i++) {
      const key = this.cellKeyFor(lat[i], lng[i])
      let bucket = this.cells.get(key)
      if (!bucket) {
        bucket = []
        this.cells.set(key, bucket)
      }
      bucket.push(i)
    }
  }

  private cellIndexFor(lat: number, lng: number): [cx: number, cy: number] {
    const y = lat * METERS_PER_DEGREE_LAT
    const x = lng * this.metersPerDegreeLng
    return [Math.floor(x / this.cellSizeMeters), Math.floor(y / this.cellSizeMeters)]
  }

  private cellKeyFor(lat: number, lng: number): string {
    const [cx, cy] = this.cellIndexFor(lat, lng)
    return `${cx}:${cy}`
  }

  /** Indices of every point in the same cell as (lat, lng) or one of its 8 neighbors. */
  candidatesNear(lat: number, lng: number): number[] {
    const [cx, cy] = this.cellIndexFor(lat, lng)
    const result: number[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(`${cx + dx}:${cy + dy}`)
        if (bucket) result.push(...bucket)
      }
    }
    return result
  }
}
