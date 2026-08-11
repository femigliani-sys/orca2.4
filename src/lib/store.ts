/**
 * Mini store reativo: permite que hooks (useSyncExternalStore) re-renderizem
 * quando o banco local (modo demonstração) muda.
 */
type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

export function notify(): void {
  version += 1;
  listeners.forEach((l) => l());
}
