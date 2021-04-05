module.exports = function (server) {
  const io = require("socket.io")(server);
  let users = {};
  io.on("connection", (socket) => {
    if (!users[socket.id]) {
      users[socket.id] = socket.id;
    }

    socket.emit("myId", socket.id);

    io.sockets.emit("allUsers", users);

    socket.on("disconnect", () => {
      delete users[socket.id];
    });

    function log() {
      var array = ["Message from server:"];
      array.push.apply(array, arguments);
      socket.emit("log", array);
    }

    socket.on("message", function (message) {
      log("Client said: ", message);
      socket.broadcast.emit("message", message);
    });

    socket.on("create or join", function (room) {
      log("Received request to create or join room " + room);

      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom
        ? Object.keys(clientsInRoom.sockets).length
        : 0;
      log("Room " + room + " now has " + numClients + " client(s)");

      if (numClients === 0) {
        socket.join(room);
        log("Client ID " + socket.id + " created room " + room);
        socket.emit("created", room, socket.id);
      } else if (numClients === 1) {
        log("Client ID " + socket.id + " joined room " + room);
        io.sockets.in(room).emit("join", room);
        socket.join(room);
        socket.emit("joined", room, socket.id);
        io.sockets.in(room).emit("ready");
      } else {
        socket.emit("full", room);
      }
    });

    socket.on("ipaddr", function () {
      var ifaces = os.networkInterfaces();
      for (var dev in ifaces) {
        ifaces[dev].forEach(function (details) {
          if (details.family === "IPv4" && details.address !== "127.0.0.1") {
            socket.emit("ipaddr", details.address);
          }
        });
      }
    });

    socket.on("bye", function () {
      console.log("received bye");
    });
  });
  global.io = io;
};
