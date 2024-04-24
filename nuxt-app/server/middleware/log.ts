export default defineEventHandler((event) => {
    console.log("New request: " + event.node.req.url);
    console.log("Request headers: " + JSON.stringify(event.node));
    //console.log("Request payload: " + JSON.stringify(event, null, 2));
    //console.log(event.node.res)
    // console.log("Request payload: " + JSON.stringify(event.node.req.body));

  });