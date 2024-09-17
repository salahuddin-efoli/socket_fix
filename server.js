import { createServer } from "http";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";

const app = express();

// You need to create the HTTP server from the Express app
const httpServer = createServer(app);

// And then attach the socket.io server to the HTTP server
const io = new Server(httpServer);
const nsp = io.of('/socket.io');

io.engine.on("connection_error", (err) => {
 console.log("=============================", err); 
 console.log(err.req);      // the request object
  console.log(err.code);     // the error code, for example 1
  console.log(err.message);  // the error message, for example "Session ID unknown"
  console.log(err.context);  // some additional error context
});
// Then you can use `io` to listen the `connection` event and get a socket
// from a client
nsp.on("connection", (socket) => {
  // from this point you are on the WS connection with a specific client
  socket.on("createReplyInMerchant", (data) => {
    socket.broadcast.emit("serverResForSupport", data);
  });

  socket.on("createReplyInSupport", (data) => {
    socket.broadcast.emit("serverResForMerchant", data);
  });

  socket.on("newTicketInMerchant", (data) => {
    socket.broadcast.emit("newTicketInMerchantToSupport", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});
//when expres js sent response, significantly reduce the size of the data sent from server to the client
app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

//if project is in development phase, vite server is created
let viteDevServer;

if("dev" !== "production") {
    viteDevServer =  await import("vite").then((vite) =>
    vite.createServer({
        server: { middlewareMode: true },
    }),
    );
    // Use Vite's middlewares in development
    app.use(viteDevServer.middlewares);
}

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build/server/index.js"),
});
// handle SSR requests
app.all("*", remixHandler);

// handle asset requests
if ("production" === "production") {
    app.use(
      "/assets",
      express.static("build/client/assets", { immutable: true, maxAge: "1y" })
    );
}

const port = 7009;

// instead of running listen on the Express app, do it on the HTTP server
httpServer.listen(port, () => {
  console.log(`Express server listening at :${port}`);
});

io.listen(7008);
