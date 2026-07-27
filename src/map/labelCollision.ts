/**
 * Decides which map labels may be drawn when several want the same space.
 *
 * The pins are ranked (place 01 is the one the reader most needs to see), so
 * this is a priority problem rather than a layout one: walk the labels in
 * rank order, keep a label if its box is still free, and drop it if it would
 * land on one already kept. Dropping rather than nudging is deliberate — a
 * label shifted far enough to clear a neighbour no longer points at its own
 * dot, which is worse than not being drawn, since the dot itself remains and
 * its name is one hover away.
 *
 * Pure and separate from the map so it can be reasoned about — and tested —
 * without a Leaflet instance, a browser, or a particular zoom level.
 */
export interface LabelBox {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Boxes are inflated by this many pixels before being tested, so labels are
 * kept visibly apart rather than merely non-overlapping. Two chips sharing an
 * edge read as one wider chip.
 */
const GAP_PX = 6

function intersects(a: LabelBox, b: LabelBox, gap: number): boolean {
  return !(
    a.right + gap < b.left ||
    b.right + gap < a.left ||
    a.bottom + gap < b.top ||
    b.bottom + gap < a.top
  )
}

/**
 * @param boxes label boxes in PRIORITY order — index 0 wins every conflict.
 * @returns one flag per input box: true to draw the label, false to suppress
 *          it and leave the bare dot.
 */
export function selectVisibleLabels(boxes: LabelBox[], gap: number = GAP_PX): boolean[] {
  const visible: boolean[] = new Array(boxes.length).fill(false)
  const placed: LabelBox[] = []

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    // A label with no measurable size hasn't been laid out yet; treating it
    // as visible would let it block the ones that follow.
    if (box.right <= box.left || box.bottom <= box.top) continue

    if (placed.some((other) => intersects(box, other, gap))) continue

    visible[i] = true
    placed.push(box)
  }

  return visible
}
