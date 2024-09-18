import { createServer } from "http";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
// notice that the result of `remix vite:build` is "just a module"
import * as build from "./build/server/index.js";

const app = express();

// You need to create the HTTP server from the Express app
const httpServer = createServer(app);

// And then attach the socket.io server to the HTTP server
const io = new Server(httpServer);

const nsp = io.of('/socket.io');

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
    :{build}
});

// handle SSR requests
app.all("*", remixHandler);

// and your app is "just a request handler"
//app.all("*", createRequestHandler({ build }));

// handle asset requests
if ("production" === "production") {
   app.use(express.static("build/client"));
}

const port = 7009;

// instead of running listen on the Express app, do it on the HTTP server
httpServer.listen(port, () => {
  console.log(`Express server listening at :${port}`);
});

io.listen(7008);
