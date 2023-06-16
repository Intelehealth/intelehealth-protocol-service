const { user_settings } = require("../models");
const admin = require("firebase-admin");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.json")[env];
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");

const serviceAccount = require(__dirname + "/../config/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://intelehealth-3-0-default-rtdb.firebaseio.com",
});

module.exports = function (server) {
  const db = admin.database();
  const DB_NAME = `${config.domain.replace(/\./g, "_")}/rtc_notify`;
  // const DB_NAME = "rtc_notify_dev";
  console.log("DB_NAME:>>>>>>> ", DB_NAME);
  const rtcNotifyRef = db.ref(DB_NAME);
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

    function callInRoom(room, count, connectToDrId) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const user = users[socketId];
          if (user && user.uuid === connectToDrId) {
            io.sockets
              .to(socketId)
              .emit("incoming_call", { patientUuid: room });
            users[socketId].callStatus = "calling";
            users[socketId].room = room;
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

    socket.on("create_or_join_hw", function ({ room, connectToDrId }) {
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
        io.sockets.in(room).emit("bye", data);
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
        callInRoom(room, 1, connectToDrId);
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

    socket.on("create or join", function (room) {
      log("Received request to create or join room " + room);

      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom
        ? Object.keys(clientsInRoom.sockets).length
        : 0;
      log("Room " + room + " now has " + numClients + " client(s)");
      socket.on("message", function (message) {
        log("Client said: ", message);
        io.sockets.in(room).emit("message", message);
      });

      socket.on("videoOff", function (data) {
        io.sockets.in(room).emit("videoOff", data);
      });

      socket.on("videoOn", function (data) {
        io.sockets.in(room).emit("videoOn", data);
      });

      socket.on("audioOff", function (data) {
        io.sockets.in(room).emit("audioOff", data);
      });

      socket.on("audioOn", function (data) {
        io.sockets.in(room).emit("audioOn", data);
      });

      socket.on("bye", async function (data) {
        const nurseId = data?.nurseId;

        markHangUp(room);
        console.log("received bye");
        io.sockets.in(room).emit("message", "bye");
        io.sockets.in(room).emit("bye", data);
        io.sockets.emit("log", ["received bye", data]);

        if (nurseId) {
          await rtcNotifyRef
            .child(nurseId)
            .child("VIDEO_CALL")
            .child("callEnded")
            .set(true);
        }
      });

      socket.on("no_answer", function (data) {
        console.log("no_answer");
        io.sockets.in(room).emit("bye");
        io.sockets.emit("log", ["no_answer", data]);
      });

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

    socket.on("call", async function (dataIds = {}) {
      const { nurseId, doctorName, roomId } = dataIds;
      console.log("dataIds: ----->>>> ", dataIds);
      let isCalling = false;
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          const userObj = users[socketId];
          if (userObj.uuid === nurseId) {
            io.sockets.to(socketId).emit("call", dataIds);
            isCalling = true;
          }
        }
      }
      let data = "";
      if (!isCalling) {
        const room = roomId;
        setTimeout(() => {
          var clientsInRoom = io.sockets.adapter.rooms[room];
          var numClients = clientsInRoom
            ? Object.keys(clientsInRoom.sockets).length
            : 0;

          if (numClients < 2) {
            socket.emit("toast", {
              duration: 2000,
              message:
                "Not able to reach the health worker at this moment. Please try again after sometime.",
            });
          }
        }, 10000);
      }
      console.log(nurseId, "----<<>>>");
      try {
        data = await user_settings.findOne({
          where: { user_uuid: nurseId },
        });
      } catch (error) {}

      function generateUUID() {
        let d = new Date().getTime();
        if (
          typeof performance !== "undefined" &&
          typeof performance.now === "function"
        ) {
          d += performance.now(); //use high-precision timer if available
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          function (c) {
            let r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          }
        );
      }

      await rtcNotifyRef.update({
        [nurseId]: {
          VIDEO_CALL: {
            id: generateUUID(),
            ...dataIds,
            callEnded: false,
            doctorName,
            nurseId,
            roomId,
            timestamp: Date.now(),
            device_token:
              data && data.device_reg_token ? data.device_reg_token : "",
          },
        },
      });
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

    socket.on("getAdminUnreadCount", async function () {
      const unreadcount = await sequelize.query(
        "SELECT COUNT(sm.message) AS unread FROM supportmessages sm WHERE sm.to = 'System Administrator' AND sm.isRead = 0",
        { type: QueryTypes.SELECT }
      );
      socket.emit("adminUnreadCount", unreadcount[0].unread);
    });

    socket.on("hw_call_reject", async function (toUserUuid) {
      for (const socketId in users) {
        if (Object.hasOwnProperty.call(users, socketId)) {
          if (users[socketId].uuid === toUserUuid) {
            io.to(socketId).emit("hw_call_reject", 'app');
          }
        }
      }
    });
  });
  global.io = io;
};
