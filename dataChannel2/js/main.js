'use strict';
// 支持 平台：macOS、windows、Android；浏览器：chrome、firefox。
/**
 * firefox的RTCIceCandidate必须要有以下两个参数
 * sdpMLineIndex
 * sdpMid
 * chrome则不需要
 */

////////////////////////////////////////////////////
// 全局变量

var isRoomCreators = false;
var isBothInRoom = false;
var isDoOffered = false;
var room = 'testRoom';
var socket;
var peerConn;
var dataChannel;
var pcConfig = {
  iceServers: [{
    urls: 'turn:139.199.82.200:3478',
    username: 'yhd',
    credential: 'yhd1234',
  },]
};

var joinButton = document.querySelector('button#joinButton');
var joinRoomStatus = document.querySelector('span#joinRoomStatus');

var connectButton = document.querySelector('button#connectButton');
var connectPeerStatus = document.querySelector('span#connectPeerStatus');

var closeButton = document.querySelector('button#closeButton');
var leaveButton = document.querySelector('button#leaveButton');

var sender = document.querySelector('textarea#sender');
var receiver = document.querySelector('textarea#receiver');

var sendButton = document.querySelector('button#sendButton');

////////////////////////////////////////////////////
// 控件组事件

joinButton.addEventListener('click', joinRoom);
connectButton.addEventListener('click', connectPeer);
closeButton.addEventListener('click', function() {
  sendMessage('connection close');
  closeConnection();
});
leaveButton.addEventListener('click', leaveRoom);
sendButton.addEventListener('click', sendData);

////////////////////////////////////////////////////
// 控件组方法

function joinRoom() {
  socket = io.connect();

  socket.on('created', function(room) {
    console.log('created room: ', room);
    isRoomCreators = true;

    joinRoomStatus.innerHTML = 'create and join the room success';
    joinButton.disabled = true;
    connectButton.disabled = false;
    leaveButton.disabled = false;
  });

  socket.on('joined', function(room) {
    console.log('joined room: ', room);

    joinRoomStatus.innerHTML = 'join the room success';
    joinButton.disabled = true;
    connectButton.disabled = false;
    leaveButton.disabled = false;
  });

  socket.on('ready', function() {
    console.log('both sides are in the room');
    isBothInRoom = true;
  });

  socket.on('full', function(room) {
    console.log('room: ' + room + ' is full');

    joinRoomStatus.innerHTML = 'room is full';
  });

  socket.on('message', function(message) {
    console.log('received message: ', message);
    if (message === 'dataChannel ready') {
      if (peerConn) {
        if (isRoomCreators) {
          doOffer();
        } else {
          sendMessage('doOffer');
        }
      }
    } else if (message === 'doOffer') {
      doOffer();
    } else if (message.type === 'offer') {
      peerConn.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer') {
      peerConn.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate') {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.sdpMLineIndex,
        sdpMid: message.sdpMid,
        candidate: message.candidate,
      });
      peerConn.addIceCandidate(candidate);
    } else if (message === 'connection close') {
      closeConnection();
    } else if (message === 'leave room') {
      otherLeaveRoom();
    }
  });

  console.log('attempted to create or join room: ', room);
  socket.emit('create or join', room);
}

function connectPeer() {
  if (!isBothInRoom) {
    connectPeerStatus.innerHTML = 'other is not in room';
    return;
  }
  connectButton.disabled = true;
  connectPeerStatus.innerHTML = 'connecting peer';

  console.log('creating RTCPeerConnection');
  try {
    peerConn = new RTCPeerConnection(pcConfig);
    peerConn.onicecandidate = function(event) {
      console.log('onicecandidate, event: ', event);
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      } else {
        console.log('end of candidate');
      }
    };
    console.log('created RTCPeerConnection');
  } catch (e) {
    console.log('failed to create RTCPeerConnection, exception: ' + e.message);
    return;
  }
  
  if (isRoomCreators) {
    console.log('creating dataChannel');
    dataChannel = peerConn.createDataChannel('testLabel', {
      ordered: true,
    });
    initDataChannel(dataChannel);
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel: ', event.channel);
      dataChannel = event.channel;
      initDataChannel(dataChannel);
    };
  }
  sendMessage('dataChannel ready');
}

function closeConnection() {
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  if (peerConn) {
    peerConn.close();
    peerConn = null;
  }
  isDoOffered = false;
  
  connectPeerStatus.innerHTML = 'not connect peer';
  connectButton.disabled = false;
  closeButton.disabled = true;
  sendButton.disabled = true;
}

function leaveRoom() {
  sendMessage('leave room');
  closeConnection();
  connectButton.disabled = true;

  if (socket) {
    socket.close();
    socket = false;
  }
  isRoomCreators = false;
  isBothInRoom = false;
  
  joinRoomStatus.innerHTML = 'not join the room';
  joinButton.disabled = false;
  leaveButton.disabled = true;
}

function otherLeaveRoom() {
  closeConnection();
  isRoomCreators = true;
  isBothInRoom = false;
  joinRoomStatus.innerHTML = 'create and join the room success';
}

function sendData() {
  var content = sender.value;

  if (!dataChannel) {
    console.log('dataChannel has not been initiated');
  } else if (dataChannel.readyState === 'closed') {
    console.log('dataChannel was closed');
  } else if (dataChannel.readyState === 'connecting') {
    console.log('dataChannel is connecting');
  } else {
    console.log('dataChannel.readyState: ', dataChannel.readyState);
    dataChannel.send(content);
  }
}

////////////////////////////////////////////////////
// 拓展方法

function sendMessage(message) {
  console.log('sending message: ', message);
  socket.emit('message', message);
}

function initDataChannel(dataChannel) {
  dataChannel.onopen = function() {
    console.log('dataChannel opened');

    connectPeerStatus.innerHTML = 'connect peer success';
    closeButton.disabled = false;
    sendButton.disabled = false;
  };

  dataChannel.onclose = function() {
    console.log('dataChannel closed');
  }

  dataChannel.onmessage = function(event) {
    receiver.value = event.data;
  };

  dataChannel.onerror = function (error) {
    console.log("dataChannel error: ", error);
  };
}

// 这里注意！必须是peerConn.createDataChannel()端才能发送offer，否则通道不会打开
function doOffer() {
  if (isDoOffered) {
    return;
  }
  console.log('sending offer');
  peerConn.createOffer(function(description) {
    peerConn.setLocalDescription(description);
    sendMessage(description);
  }, function(e) {
    console.log('createOffer error: ', e);
  });
  isDoOffered = true;
}

function doAnswer() {
  console.log('sending answer');
  peerConn.createAnswer(function(description) {
      peerConn.setLocalDescription(description);
      sendMessage(description);
    }, function(e) {
    console.log('createAnswer error: ', e);
  });
}

// 关闭，刷新，后退都会触发
window.onbeforeunload = function() {
  sendMessage('leave room');
};