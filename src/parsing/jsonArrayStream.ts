// A hand-rolled, incremental JSON array-element extractor.
//
// WHY this exists: Google Takeout / Timeline exports can be hundreds of MB.
// `JSON.parse(wholeFileText)` would require holding the entire parsed object
// tree in memory at once and blocks until the whole file has been read — the
// opposite of "stream/chunk it". Real streaming JSON parsers exist, but the
// only thing we actually need here is much simpler: find one top-level array
// (e.g. `"locations": [ ... ]`) and hand back each `{...}` element inside it
// as soon as it is complete, so the caller can parse+normalize+discard one
// small record at a time instead of ever materializing the whole array.
//
// This is a small bracket-depth automaton:
//  - "seeking": buffering incoming text until we see `"<key>": [` for one of
//    the candidate keys, so we know which array we're extracting.
//  - "in-array": scanning character by character, tracking nesting depth and
//    whether we're inside a JSON string (so braces inside string VALUES
//    don't get mistaken for structural braces). Whenever depth returns to 0
//    after opening a `{`, that `{...}` span is one complete element.
//  - Once an element is extracted, everything up to and including it is
//    dropped from the buffer, so memory use stays bounded to roughly one
//    chunk plus one in-flight element, never the whole file.

export type ElementHandler = (rawJson: string) => void

export interface ArrayElementExtractor {
  /** Feed the next chunk of decoded text. */
  push(chunk: string): void
  /** The array key we ended up matching, once known (null while seeking). */
  readonly matchedKey: string | null
  /** True once the closing `]` of the matched array has been consumed. */
  readonly isDone: boolean
}

type Phase = 'seeking' | 'in-array' | 'done'

export function createArrayElementExtractor(
  candidateKeys: readonly string[],
  onElement: ElementHandler,
): ArrayElementExtractor {
  let buffer = ''
  let phase: Phase = 'seeking'
  let matchedKey: string | null = null

  // In-array scanning state. `pos` is a cursor into `buffer` that persists
  // ACROSS push() calls — it must NOT reset to 0 every time a new chunk
  // arrives. Buffer is only trimmed (and pos reset to 0) once a complete
  // element has just been consumed; the rest of the time an incoming chunk
  // is appended to the end of `buffer` and scanning simply resumes from
  // where it left off. Restarting the scan at index 0 on every push() would
  // re-visit characters already folded into `depth`/`inString` (e.g. the
  // `{` that opened the in-progress element), double-counting them and
  // desyncing the whole parse the moment an element straddles a chunk
  // boundary — which, on a multi-hundred-MB file, is basically every chunk.
  let pos = 0
  let depth = 0
  let elementStart = -1
  let inString = false
  let escapeNext = false

  function tryMatchArrayStart(): void {
    for (const key of candidateKeys) {
      const marker = `"${key}"`
      const keyIndex = buffer.indexOf(marker)
      if (keyIndex === -1) continue

      let i = keyIndex + marker.length
      while (i < buffer.length && /\s/.test(buffer[i])) i++
      if (i >= buffer.length) return // need more data to see past the key
      if (buffer[i] !== ':') continue // same substring, not actually the key

      i++
      while (i < buffer.length && /\s/.test(buffer[i])) i++
      if (i >= buffer.length) return // need more data to see the value
      if (buffer[i] !== '[') continue // key's value isn't an array, keep looking

      matchedKey = key
      phase = 'in-array'
      buffer = buffer.slice(i + 1)
      pos = 0
      return
    }
  }

  function scanInArray(): void {
    while (pos < buffer.length) {
      const ch = buffer[pos]

      if (inString) {
        if (escapeNext) escapeNext = false
        else if (ch === '\\') escapeNext = true
        else if (ch === '"') inString = false
        pos++
        continue
      }

      if (ch === '"') {
        inString = true
        pos++
        continue
      }

      if (depth === 0) {
        if (ch === '{') {
          elementStart = pos
          depth = 1
        } else if (ch === ']') {
          phase = 'done'
          buffer = ''
          return
        }
        // Anything else at depth 0 (commas, whitespace) is just separator noise.
        pos++
        continue
      }

      // Inside an element: track nesting so a closing brace of a nested
      // object/array doesn't get mistaken for the element's own end.
      if (ch === '{' || ch === '[') {
        depth++
      } else if (ch === '}' || ch === ']') {
        depth--
        if (depth === 0) {
          onElement(buffer.slice(elementStart, pos + 1))
          elementStart = -1
          buffer = buffer.slice(pos + 1)
          pos = 0
          continue
        }
      }
      pos++
    }
  }

  return {
    push(chunk: string) {
      if (phase === 'done') return
      buffer += chunk
      if (phase === 'seeking') tryMatchArrayStart()
      if (phase === 'in-array') scanInArray()
    },
    get matchedKey() {
      return matchedKey
    },
    get isDone() {
      return phase === 'done'
    },
  }
}

export interface ObjectCapture {
  push(chunk: string): void
  /** The captured `{...}` text once complete, else null. */
  readonly captured: string | null
  readonly isDone: boolean
}

/**
 * Captures one small top-level OBJECT by key, e.g. `"userLocationProfile": {…}`.
 *
 * Separate from the array extractor above because the job is different: that
 * one streams out thousands of elements and must never hold more than one,
 * while this one wants a single object small enough to keep whole. What the
 * two share is the constraint that matters — the object being sought can sit
 * anywhere in a file far too large to buffer (in a real Timeline export it
 * comes last, behind several megabytes of `rawSignals`), so while seeking,
 * the buffer is trimmed to just enough tail to catch a key split across a
 * chunk boundary.
 */
export function createObjectCapture(key: string): ObjectCapture {
  const marker = `"${key}"`
  // Enough tail to hold the key plus the whitespace and colon that may
  // follow it before the opening brace lands in the next chunk.
  const KEEP_TAIL = marker.length + 16

  let buffer = ''
  let phase: 'seeking' | 'capturing' | 'done' = 'seeking'
  let captured: string | null = null
  let depth = 0
  let inString = false
  let escapeNext = false

  function seek(): void {
    const keyIndex = buffer.indexOf(marker)
    if (keyIndex === -1) {
      if (buffer.length > KEEP_TAIL) buffer = buffer.slice(-KEEP_TAIL)
      return
    }

    let i = keyIndex + marker.length
    while (i < buffer.length && /\s/.test(buffer[i])) i++
    if (i >= buffer.length) return
    if (buffer[i] !== ':') {
      // Same substring appearing as a value; skip past it and keep looking.
      buffer = buffer.slice(keyIndex + marker.length)
      return
    }

    i++
    while (i < buffer.length && /\s/.test(buffer[i])) i++
    if (i >= buffer.length) return
    if (buffer[i] !== '{') {
      buffer = buffer.slice(i)
      return
    }

    buffer = buffer.slice(i)
    phase = 'capturing'
  }

  function capture(): void {
    for (let pos = 0; pos < buffer.length; pos++) {
      const ch = buffer[pos]

      if (inString) {
        if (escapeNext) escapeNext = false
        else if (ch === '\\') escapeNext = true
        else if (ch === '"') inString = false
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') {
        depth--
        if (depth === 0) {
          captured = buffer.slice(0, pos + 1)
          buffer = ''
          phase = 'done'
          return
        }
      }
    }
    // The whole buffer is part of the object and none of it can be dropped,
    // so it is kept — bounded by the object's own size, which for a profile
    // is kilobytes.
  }

  return {
    push(chunk: string) {
      if (phase === 'done') return
      buffer += chunk
      if (phase === 'seeking') seek()
      if (phase === 'capturing') capture()
    },
    get captured() {
      return captured
    },
    get isDone() {
      return phase === 'done'
    },
  }
}
