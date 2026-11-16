export function updateWasStoppedByUser(
  value: boolean,
  ref: { current: boolean },
  setState: (value: boolean) => void
) {
  ref.current = value;
  setState(value);
}
