let workerPromise;

async function getWorker() {
  workerPromise ??= import(new URL("../../dist/server/index.js", import.meta.url).href)
    .then((module) => module.default);
  return workerPromise;
}

export async function render(pathname = "/") {
  const worker = await getWorker();
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

export async function renderText(pathname = "/") {
  const response = await render(pathname);
  return { response, html: await response.text() };
}
