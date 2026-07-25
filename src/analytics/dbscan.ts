// DBSCAN (Density-Based Spatial Clustering of Applications with Noise),
// implemented from scratch — no external clustering service, so every step
// is explainable rather than a black box.
//
// THE IDEA: a "place" in someone's life is a spot where GPS pings piled up
// — you were there long enough, or came back often enough, that pings
// clustered densely nearby. Two parameters define "densely":
//   - eps: how close two pings need to be (in meters) to count as neighbors
//   - minPts: how many neighbors a ping needs (itself included) before its
//     neighborhood counts as dense, rather than just a one-off pass-through
//
// Once the algorithm finishes, every point is one of three things:
//   - CORE point: has >= minPts neighbors within eps. Core points are the
//     solid interior of a place and can pull MORE points into the cluster.
//   - BORDER point: doesn't have enough neighbors on its own, but sits
//     within eps of a core point, so it gets absorbed anyway (e.g. the
//     edge of a parking lot right next to your office).
//   - NOISE: neither of the above — a spot visited once, in passing,
//     nowhere near anything recurring. Not part of any place.
//
// Clusters grow outward from every core point, breadth-first, pulling in
// every point reachable through a chain of core points ("density-
// reachability"). That's why DBSCAN finds arbitrarily-shaped clusters (a
// place that's actually a long park path, say) instead of assuming round
// blobs and needing the number of clusters picked in advance, the way
// k-means does.
//
// Performance: a naive regionQuery (linear scan for neighbors) makes this
// O(n²). See spatialGrid.ts for how that's avoided — this file only cares
// about the clustering LOGIC, not how neighbors are found fast.

import { haversineDistanceMeters } from './geo'
import { SpatialGrid } from './spatialGrid'

export const NOISE = -1
const UNVISITED = -2

export interface DbscanOptions {
  epsMeters: number
  minPts: number
}

// `weights` lets each input "point" stand in for more than one real ping —
// used when the caller has pre-aggregated near-duplicate points (see
// dedupeForClustering.ts) so the minPts density check still reflects the
// TRUE number of pings nearby, not just the number of distinct aggregated
// cells. Pass null to treat every point as weight 1 (the plain, textbook
// DBSCAN behavior).
export function dbscan(
  lat: Float64Array,
  lng: Float64Array,
  weights: Float64Array | null,
  { epsMeters, minPts }: DbscanOptions,
): Int32Array {
  const n = lat.length
  const labels = new Int32Array(n).fill(UNVISITED)
  const grid = new SpatialGrid(lat, lng, epsMeters)

  function regionQuery(i: number): number[] {
    const candidates = grid.candidatesNear(lat[i], lng[i])
    const neighbors: number[] = []
    for (const j of candidates) {
      if (haversineDistanceMeters(lat[i], lng[i], lat[j], lng[j]) <= epsMeters) {
        neighbors.push(j)
      }
    }
    return neighbors
  }

  function neighborhoodWeight(neighbors: number[]): number {
    if (!weights) return neighbors.length
    let sum = 0
    for (const j of neighbors) sum += weights[j]
    return sum
  }

  let nextClusterId = 0

  for (let i = 0; i < n; i++) {
    if (labels[i] !== UNVISITED) continue

    const seeds = regionQuery(i)
    if (neighborhoodWeight(seeds) < minPts) {
      labels[i] = NOISE // may still get reclaimed as a BORDER point later
      continue
    }

    const clusterId = nextClusterId++
    labels[i] = clusterId

    // Breadth-first expansion. A plain array used as an index-based queue
    // (never .shift()) so growing a large cluster stays O(size), not O(size²)
    // — BUT that only holds if every point enters the queue at most once.
    // The label is therefore set the moment a point is ADDED to the queue,
    // not when it's popped and processed. Labeling on pop instead (the more
    // "obvious" way to write this) lets the same still-unlabeled point get
    // rediscovered and re-pushed by every other core point that also has it
    // as a neighbor before it's finally popped — harmless for a sparse
    // cluster, but on a genuinely dense one (thousands of pings all within
    // eps of each other, e.g. "home") every core point rediscovers nearly
    // the whole remaining cluster, which is O(size) extra pushes PER pop —
    // O(size²) overall, and the queue balloons until it throws rather than
    // finishes. Marking on push is what actually keeps this linear.
    const queue: number[] = []
    for (const s of seeds) {
      if (s === i) continue
      if (labels[s] === UNVISITED) {
        labels[s] = clusterId
        queue.push(s)
      } else if (labels[s] === NOISE) {
        labels[s] = clusterId // border point reclaimed, doesn't expand further
      }
    }

    let qi = 0
    while (qi < queue.length) {
      const j = queue[qi++]
      const jNeighbors = regionQuery(j)
      if (neighborhoodWeight(jNeighbors) < minPts) continue // j is a border point, doesn't expand

      // j is ALSO core — everything density-reachable from it belongs too.
      for (const k of jNeighbors) {
        if (labels[k] === UNVISITED) {
          labels[k] = clusterId
          queue.push(k)
        } else if (labels[k] === NOISE) {
          labels[k] = clusterId
        }
      }
    }
  }

  return labels
}
