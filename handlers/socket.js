const { sendCloudNotification } = require("./helper");
const { user_settings } = require("../models");

module.exports = function (server) {
  const io = require("socket.io")(server);
  global.users = {};
  io.on("connection", (socket) => {
    if (!users[socket.id]) {
      users[socket.id] = {
        uuid: socket.handshake.query.userId,
        status: "online",
        name: socket.handshake.query.name,
        callStatus: null,
      };
    }
    console.log("socket: >>>>>", socket.handshake.query.userId);

    socket.emit("myId", socket.id);

    io.sockets.emit("allUsers", users);

    socket.on("disconnect", () => {
      console.log("disconnected:>> ", socket.id);
      delete users[socket.id];
      io.sockets.emit("allUsers", users);
    });

    function log() {
      var array = ["Message from server:"];
      array.push.apply(array, arguments);
      socket.emit("log", array);
    }

    function callInRoom(room, count) {
      let isCalled = false;
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const user = users[socketId];
          if (!isCalled && !user.callStatus && socket.id !== socketId) {
            io.sockets
              .to(socketId)
              .emit("incoming_call", { patientUuid: room });
            isCalled = true;
            users[socketId].callStatus = "calling";
            users[socketId].room = room;
            if (Array.isArray(users[socketId].called)) {
              users[socketId].called.push(socket.id);
            } else {
              users[socketId].called = [socket.id];
            }
            io.sockets.emit("allUsers", users);
            setTimeout(() => {
              if (
                users[socketId] &&
                users[socketId].callStatus === "calling" &&
                count < 3
              ) {
                callInRoom(room, ++count);
              }
            }, 5000);
          }
        }
      }
      setTimeout(() => {
        for (const socketId in users) {
          if (Object.hasOwnProperty.call(users, socketId)) {
            if (
              users[socketId] &&
              users[socketId].room &&
              users[socketId].room === room &&
              users[socketId].callStatus === "calling"
            ) {
              users[socketId].callStatus = null;
              io.sockets.emit("allUsers", users);
            }
          }
        }
      }, 100000);
    }

    function markConnected(room) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (
            users[socketId] &&
            users[socketId].room &&
            users[socketId].room === room
          ) {
            users[socketId].callStatus = "In Call";
            io.sockets.emit("allUsers", users);
          }
        }
      }
    }

    function markHangUp(room) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (
            users[socketId] &&
            users[socketId].room &&
            users[socketId].room === room
          ) {
            users[socketId].callStatus = null;
            users[socketId].room = null;
            io.sockets.emit("allUsers", users);
          }
        }
      }
    }

    socket.on("create_or_join_hw", function ({ room }) {
      log("Received request to create or join room " + room);

      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom
        ? Object.keys(clientsInRoom.sockets).length
        : 0;
      log("Room " + room + " now has " + numClients + " client(s)");
      socket.on("message", function (message) {
        log("Client said: ", message);
        socket.broadcast.to(room).emit("message", message);
        // io.sockets.in(room).emit("message", message);
      });

      socket.on("bye", function (data) {
        console.log("received bye");
        markHangUp(room);
        io.sockets.in(room).emit("bye");
        io.sockets.emit("log", ["received bye", data]);
      });

      socket.on("no_answer", function (data) {
        console.log("no_answer");
        io.sockets.in(room).emit("bye");
        io.sockets.emit("log", ["no_answer", data]);
      });

      console.log("numClients: ", numClients);
      if (numClients === 0) {
        // socket.broadcast.to(room).emit("incoming_call", { patientUuid: room });
        callInRoom(room, 1);
        // io.sockets.emit("incoming_call", { patientUuid: room });
        socket.join(room);
        log("Client ID " + socket.id + " created room " + room);
        socket.emit("created", room, socket.id);
      } else if (numClients === 1) {
        log("Client ID " + socket.id + " joined room " + room);
        // io.sockets.broadcast.to(room).emit("join", room);
        // io.sockets.in(room).emit("join", room);
        socket.join(room);
        socket.emit("joined", room, socket.id);
        socket.broadcast.to(room).emit("ready");
        // io.sockets.in(room).emit("ready");
        if (users[socket.id]) {
          users[socket.id].room = room;
        }
        markConnected(room);
      } else {
        socket.emit("full", room);
      }
    });

    // socket.on("create or join", function (room) {
    //   log("Received request to create or join room " + room);

    //   var clientsInRoom = io.sockets.adapter.rooms[room];
    //   var numClients = clientsInRoom
    //     ? Object.keys(clientsInRoom.sockets).length
    //     : 0;
    //   log("Room " + room + " now has " + numClients + " client(s)");
    //   socket.on("message", function (message) {
    //     log("Client said: ", message);
    //     io.sockets.in(room).emit("message", message);
    //   });

    //   socket.on("bye", function (data) {
    //     console.log("received bye");
    //     io.sockets.in(room).emit("message", "bye");
    //     io.sockets.in(room).emit("bye");
    //     io.sockets.emit("log", ["received bye", data]);
    //   });

    //   socket.on("no_answer", function (data) {
    //     console.log("no_answer");
    //     io.sockets.in(room).emit("bye");
    //     io.sockets.emit("log", ["no_answer", data]);
    //   });

    //   if (numClients === 0) {
    //     socket.join(room);
    //     log("Client ID " + socket.id + " created room " + room);
    //     socket.emit("created", room, socket.id);
    //   } else if (numClients === 1) {
    //     log("Client ID " + socket.id + " joined room " + room);
    //     io.sockets.in(room).emit("join", room);
    //     socket.join(room);
    //     socket.emit("joined", room, socket.id);
    //     io.sockets.in(room).emit("ready");
    //   } else {
    //     socket.emit("full", room);
    //   }
    // });
    // socket.on("call", async function (dataIds) {
    //   const { nurseId } = dataIds;
    //   let isCalling = false;
    //   for (const socketId in users) {
    //     if (Object.hasOwnProperty.call(users, socketId)) {
    //       const userObj = users[socketId];
    //       if (userObj.uuid === nurseId) {
    //         io.sockets.to(socketId).emit("call", dataIds);
    //         isCalling = true;
    //       }
    //     }
    //   }
    //   if (!isCalling) {
    //     const data = await user_settings.findOne({
    //       where: { user_uuid: nurseId },
    //     });
    //     if (data && data.device_reg_token) {
    //       const response = await sendCloudNotification({
    //         title: "Incoming call",
    //         body: "Doctor is trying to call you.",
    //         data: { ...dataIds, actionType: "VIDEO_CALL" },
    //         regTokens: [data.device_reg_token],
    //       }).catch((err) => {
    //         console.log("err: ", err);
    //       });
    //       io.sockets.emit("log", ["notification response", response, data]);
    //     } else {
    //       io.sockets.emit("log", [
    //         `data/device reg token not found in db for ${nurseId}`,
    //         data,
    //       ]);
    //     }
    //   }
    // });

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
  });
  global.io = io;
};
