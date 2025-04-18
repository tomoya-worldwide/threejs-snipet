const demos = import.meta.glob('./demos/**/*.ts') as Record<
  string,
  () => Promise<{ default: () => void }>
>;

export async function runDemoFromURL(): Promise<void> {
  const id   = new URLSearchParams(location.search).get('demo') ?? '001_basic_cube';
  const path = Object.keys(demos).find((p) => p.includes(id));

  if (!path) {
    console.error(`demo "${id}" not found`);
    return;
  }

  const mod = await demos[path](); 
  mod.default();
}