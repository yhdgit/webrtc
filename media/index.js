'use strict';

var nodeStatic = require('node-static');
var https = require('https');
var socketIO = require('socket.io');
var fs = require("fs");

var options = {
  key: fs.readFileSync('./certificate/privatekey.pem'),
  cert: fs.readFileSync('./certificate/certificate.pem')
};

var fileServer = new(nodeStatic.Server)();
var app = https.createServer(options, function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);
var io = socketIO.listen(app);

io.sockets.on('connection', function(socket) {
  socket.on('create or join', function(room) {
    console.log('Received request to create or join room: ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    console.log('Room: ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      console.log('Client ID: ' + socket.id + ' created room: ' + room);
      socket.emit('created', room);
    } else if (numClients === 1) {
      io.sockets.in(room).emit('other joining', room); // 获取该房间的socket，并通知有其他人加入
      socket.join(room);
      console.log('Client ID: ' + socket.id + ' joined room: ' + room);
      socket.emit('joined', room); // 通知自己加入了那个房间
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('message', function(message) {
    console.log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });
});
