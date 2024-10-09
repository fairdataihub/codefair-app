export default defineEventHandler((event) => {
  console.info("New request: " + event.node.req.url);
});
