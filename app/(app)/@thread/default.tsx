/**
 * Every route that is not a thread fills the top bar's thread slot with
 * nothing. A parallel route needs a default for the segments it does not match,
 * and "there is no thread here" is a real answer rather than a missing one.
 */
export default function NoThread() {
  return null;
}
