'use strict';

var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var server = http.createServer(function(req, res) {
  fileServer.serve(req, res);
});
server.listen(8080);

var io = socketIO.listen(server);
io.sockets.on('connection', function(socket) {
  socket.on('create or join', function(room) {
    console.log('received request to create or join room: ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    console.log('room: ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      console.log('clientID: ' + socket.id + ' created room: ' + room);
      socket.emit('created', room);
    } else if (numClients === 1) {
      io.sockets.in(room).emit('other joining', room); // 获取该房间的所有socket，并通知有其他人加入
      socket.join(room);
      console.log('clientID: ' + socket.id + ' joined room: ' + room);
      socket.emit('joined', room);
      io.sockets.in(room).emit('ready');
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('message', function(message) {
    console.log('client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });
});
